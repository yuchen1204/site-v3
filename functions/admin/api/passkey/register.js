/**
 * Cloudflare Pages Function for registering a passkey
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

import { generateChallenge, base64URLStringToBuffer, bufferToBase64URLString } from '../../utils/passkey-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取当前已登录的用户名
    const sessionToken = getCookieValue(request, 'admin_session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: '未登录，无法注册Passkey' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '无效的会话，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const username = sessionData.username;
    
    // 生成随机挑战用于Passkey注册
    const challenge = generateChallenge();
    
    // 创建PublicKeyCredentialCreationOptions
    const options = {
      challenge: challenge,
      rp: {
        name: '个人网站后台',
        id: new URL(request.url).hostname
      },
      user: {
        id: bufferToBase64URLString(new TextEncoder().encode(username)),
        name: username,
        displayName: username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false
      }
    };
    
    // 保存挑战到KV，以便后续验证
    await env.blog_data.put(`passkey_challenge:${username}`, JSON.stringify({
      challenge: challenge,
      timestamp: Date.now()
    }), { expirationTtl: 300 }); // 5分钟有效期
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('Passkey注册请求处理出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey注册请求处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  return cookies[name];
} 