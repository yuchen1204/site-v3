/**
 * Cloudflare Pages Function for verifying passkey authentication
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

import { base64URLStringToBuffer } from '../../utils/passkey-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { username, credential } = await request.json();
    
    if (!username || !credential) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 获取存储的挑战
    const storedChallengeData = await env.blog_data.get(`passkey_challenge:${username}`, { type: 'json' });
    if (!storedChallengeData || !storedChallengeData.challenge) {
      return new Response(JSON.stringify({ error: '无效或已过期的挑战' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 获取用户的Passkey信息
    const passkeyInfo = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    if (!passkeyInfo) {
      return new Response(JSON.stringify({ error: '未找到Passkey信息' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证挑战响应 (简化版) - 生产环境需要更严格的验证
    const { id, rawId, type, response } = credential;
    
    if (type !== 'public-key') {
      return new Response(JSON.stringify({ error: '无效的验证类型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 解析客户端数据
    const clientDataJSON = JSON.parse(atob(response.clientDataJSON));
    
    // 验证挑战是否一致
    if (clientDataJSON.challenge !== storedChallengeData.challenge) {
      return new Response(JSON.stringify({ error: '挑战验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证凭证ID是否匹配
    if (id !== passkeyInfo.id) {
      return new Response(JSON.stringify({ error: '凭证ID不匹配' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 清除挑战信息
    await env.blog_data.delete(`passkey_challenge:${username}`);
    
    // 验证成功，生成会话
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    // 将会话信息存储到KV
    await env.blog_data.put(sessionKey, JSON.stringify({
      username: username,
      loggedInAt: Date.now(),
      loginMethod: 'passkey'
    }), { expirationTtl: 3600 }); // 1小时过期
    
    // 返回成功并设置cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: headers
    });
  } catch (error) {
    console.error('Passkey验证处理出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey验证处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 简单的session token生成函数
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 