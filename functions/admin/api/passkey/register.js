/**
 * Cloudflare Pages Function for registering a new passkey
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { generateRegistrationOptions, verifyRegistrationResponse } from '../../utils/passkey-helpers.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    // 从 session 获取用户名
    const sessionCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: '未登录，无法注册Passkey' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionCookie}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData) {
      return new Response(JSON.stringify({ error: '会话无效，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const username = sessionData.username;
    
    // 生成注册选项
    const options = await generateRegistrationOptions({
      rpName: '个人网站管理后台',
      rpID: new URL(request.url).hostname,
      userID: username,
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform' // 或 'cross-platform'
      }
    });
    
    // 保存挑战到会话中以便验证
    sessionData.currentChallenge = options.challenge;
    await env.blog_data.put(sessionKey, JSON.stringify(sessionData), {
      expirationTtl: 3600 // 1小时
    });
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成Passkey注册选项出错:', error);
    return new Response(JSON.stringify({ error: '生成Passkey注册选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    // 获取验证数据
    const credential = await request.json();
    
    // 从会话中获取之前保存的挑战
    const sessionCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: '未登录，无法完成Passkey注册' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionCookie}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData || !sessionData.currentChallenge) {
      return new Response(JSON.stringify({ error: '会话无效或挑战已过期' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证响应
    const verification = await verifyRegistrationResponse({
      credential,
      expectedChallenge: sessionData.currentChallenge,
      expectedOrigin: new URL(request.url).origin,
      expectedRPID: new URL(request.url).hostname
    });
    
    if (verification.verified) {
      // 保存验证的凭证
      const passkeys = await env.blog_data.get(`passkeys:${sessionData.username}`, { type: 'json' }) || [];
      passkeys.push({
        id: verification.registrationInfo.credentialID,
        publicKey: verification.registrationInfo.credentialPublicKey,
        counter: verification.registrationInfo.counter,
        transports: credential.response.transports
      });
      
      await env.blog_data.put(`passkeys:${sessionData.username}`, JSON.stringify(passkeys));
      
      // 清除会话中的挑战
      delete sessionData.currentChallenge;
      await env.blog_data.put(sessionKey, JSON.stringify(sessionData), {
        expirationTtl: 3600
      });
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Passkey验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
  } catch (error) {
    console.error('Passkey注册验证出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey注册验证失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 