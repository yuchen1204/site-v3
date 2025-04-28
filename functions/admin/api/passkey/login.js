/**
 * Cloudflare Pages Function for passkey authentication (login)
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '../../utils/passkey-helpers.js';

// 生成session令牌的函数（与现有login.js保持一致）
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 获取验证选项（第一步）
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    // 查询参数中获取用户名
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    
    if (!username) {
      return new Response(JSON.stringify({ error: '缺少用户名参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证用户名是否有效（与环境变量中的管理员用户名匹配）
    const ADMIN_USERNAME = env.ADMIN_USERNAME;
    if (username !== ADMIN_USERNAME) {
      return new Response(JSON.stringify({ error: '用户名无效' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 查询用户现有的Passkey
    const passkeys = await env.blog_data.get(`passkeys:${username}`, { type: 'json' });
    
    if (!passkeys || !passkeys.length) {
      return new Response(JSON.stringify({ error: '该用户尚未注册Passkey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 提取凭证ID列表用于验证选项
    const allowCredentials = passkeys.map(key => ({
      id: key.id,
      type: 'public-key',
      transports: key.transports
    }));
    
    // 生成验证选项
    const options = await generateAuthenticationOptions({
      rpID: new URL(request.url).hostname,
      allowCredentials,
      userVerification: 'preferred'
    });
    
    // 创建临时会话保存挑战
    const tempSessionToken = generateSessionToken();
    const tempSessionKey = `temp_session:${tempSessionToken}`;
    
    await env.blog_data.put(tempSessionKey, JSON.stringify({
      username,
      challenge: options.challenge
    }), {
      expirationTtl: 300 // 5分钟过期
    });
    
    // 设置临时会话cookie，用于后续验证
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `temp_session=${tempSessionToken}; HttpOnly; Path=/admin; Max-Age=300; SameSite=Strict`
    });
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: headers
    });
  } catch (error) {
    console.error('生成Passkey验证选项出错:', error);
    return new Response(JSON.stringify({ error: '生成Passkey验证选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 验证Passkey响应（第二步）
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    // 获取验证数据
    const credential = await request.json();
    
    // 从临时会话cookie中获取之前保存的挑战
    const tempSessionCookie = request.headers.get('Cookie')?.match(/temp_session=([^;]+)/)?.[1];
    
    if (!tempSessionCookie) {
      return new Response(JSON.stringify({ error: '会话无效，请重新开始登录流程' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const tempSessionKey = `temp_session:${tempSessionCookie}`;
    const tempSessionData = await env.blog_data.get(tempSessionKey, { type: 'json' });
    
    if (!tempSessionData || !tempSessionData.challenge) {
      return new Response(JSON.stringify({ error: '会话无效或已过期，请重新开始登录流程' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const username = tempSessionData.username;
    
    // 获取用户的Passkey
    const passkeys = await env.blog_data.get(`passkeys:${username}`, { type: 'json' });
    
    if (!passkeys || !passkeys.length) {
      return new Response(JSON.stringify({ error: '找不到用户的Passkey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 找到匹配的Passkey
    const credentialIDBuffer = Buffer.from(credential.id, 'base64url');
    const matchingPasskey = passkeys.find(key => 
      Buffer.from(key.id, 'base64url').equals(credentialIDBuffer)
    );
    
    if (!matchingPasskey) {
      return new Response(JSON.stringify({ error: '无效的凭证' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证响应
    const verification = await verifyAuthenticationResponse({
      credential,
      expectedChallenge: tempSessionData.challenge,
      expectedOrigin: new URL(request.url).origin,
      expectedRPID: new URL(request.url).hostname,
      authenticator: {
        credentialID: matchingPasskey.id,
        credentialPublicKey: matchingPasskey.publicKey,
        counter: matchingPasskey.counter
      }
    });
    
    if (verification.verified) {
      // 更新计数器
      matchingPasskey.counter = verification.authenticationInfo.counter;
      await env.blog_data.put(`passkeys:${username}`, JSON.stringify(passkeys));
      
      // 删除临时会话
      await env.blog_data.delete(tempSessionKey);
      
      // 创建正式会话
      const sessionToken = generateSessionToken();
      const sessionKey = `session:${sessionToken}`;
      
      await env.blog_data.put(sessionKey, JSON.stringify({
        username: username,
        loggedInAt: Date.now(),
        loginMethod: 'passkey'
      }), {
        expirationTtl: 3600 // 1小时
      });
      
      // 设置会话cookie，删除临时会话cookie
      const headers = new Headers({
        'Content-Type': 'application/json;charset=UTF-8',
        'Set-Cookie': [
          `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`,
          `temp_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict`
        ].join(', ')
      });
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: headers
      });
    } else {
      return new Response(JSON.stringify({ error: 'Passkey验证失败' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
  } catch (error) {
    console.error('Passkey登录验证出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey登录验证失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 