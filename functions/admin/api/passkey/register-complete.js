/**
 * Cloudflare Pages Function for completing passkey registration
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

import { base64URLStringToBuffer, bufferToBase64URLString } from '../../utils/passkey-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取当前已登录的用户名
    const sessionToken = getCookieValue(request, 'admin_session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: '未登录，无法完成Passkey注册' }), {
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
    
    // 获取验证响应
    const credential = await request.json();
    
    // 获取之前存储的挑战
    const storedChallengeData = await env.blog_data.get(`passkey_challenge:${username}`, { type: 'json' });
    if (!storedChallengeData || !storedChallengeData.challenge) {
      return new Response(JSON.stringify({ error: '无效或已过期的挑战' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证挑战是否一致
    const expectedChallenge = storedChallengeData.challenge;
    
    // 提取验证响应中的关键信息
    const { id, rawId, type, response } = credential;
    
    if (type !== 'public-key') {
      return new Response(JSON.stringify({ error: '无效的验证类型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证挑战响应 (简化版) - 生产环境需要更严格的验证
    const clientDataJSON = JSON.parse(atob(response.clientDataJSON));
    if (clientDataJSON.challenge !== expectedChallenge) {
      return new Response(JSON.stringify({ error: '挑战验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 存储Passkey信息
    const passkeyInfo = {
      id: id,
      rawId: rawId,
      publicKey: response.attestationObject,
      username: username,
      createdAt: Date.now()
    };
    
    // 保存Passkey到KV
    await env.blog_data.put(`passkey:${username}`, JSON.stringify(passkeyInfo));
    
    // 清除挑战信息
    await env.blog_data.delete(`passkey_challenge:${username}`);
    
    return new Response(JSON.stringify({ success: true, message: 'Passkey注册成功' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('Passkey注册完成处理出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey注册完成处理失败' }), {
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