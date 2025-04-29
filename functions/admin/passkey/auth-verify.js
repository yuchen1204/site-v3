/**
 * Cloudflare Pages Function for verifying WebAuthn/Passkey authentication
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

// 简单的 session token 生成 (与常规登录保持一致)
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 从请求获取验证数据
    const data = await request.json();
    const { username, assertionResponse } = data;

    if (!username || !assertionResponse) {
      return new Response(JSON.stringify({ error: '请求缺少必要数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 获取存储的验证挑战
    const challengeKey = `passkey:challenge:${username}`;
    const storedChallenge = await env.blog_data.get(challengeKey);
    
    if (!storedChallenge) {
      return new Response(JSON.stringify({ error: '验证会话已过期，请重新开始验证' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 获取用户的凭据列表
    const credentialsKey = `passkey:credentials:${username}`;
    const credentials = await env.blog_data.get(credentialsKey, { type: 'json' });
    
    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: '未找到该用户的Passkey凭据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 从认证响应中找到使用的凭据ID
    const authenticatedCredential = credentials.find(
      cred => cred.credentialID === assertionResponse.id
    );

    if (!authenticatedCredential) {
      return new Response(JSON.stringify({ error: '使用了未注册的凭据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 确定期望的原点和RP ID
    const origin = request.headers.get('Origin');
    const rpID = new URL(origin).hostname;

    // 验证认证响应
    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: storedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticatedCredential.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(authenticatedCredential.publicKey, 'base64url'),
        counter: authenticatedCredential.counter,
      },
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: '验证失败', verification }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 清理验证挑战
    await env.blog_data.delete(challengeKey);

    // 更新凭据计数器
    authenticatedCredential.counter = verification.authenticationInfo.newCounter;
    authenticatedCredential.lastUsed = new Date().toISOString();
    await env.blog_data.put(credentialsKey, JSON.stringify(credentials));

    // 创建会话 (与常规登录相同的会话机制)
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;

    // 存储会话数据
    await env.blog_data.put(sessionKey, JSON.stringify({ 
      username, 
      loggedInAt: Date.now(),
      authMethod: 'passkey' 
    }), {
      expirationTtl: 3600 // 1小时
    });
    
    // 设置会话Cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Passkey验证成功',
      deviceName: authenticatedCredential.name
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('验证Passkey认证出错:', error);
    return new Response(JSON.stringify({ error: '验证认证失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 