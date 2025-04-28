/**
 * Cloudflare Pages Function for passkey authentication
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
    const { username } = await request.json();
    
    if (!username) {
      return new Response(JSON.stringify({ error: '用户名不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查用户是否存在
    const adminUsername = env.ADMIN_USERNAME;
    if (username !== adminUsername) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查用户是否有Passkey
    const passkeyInfo = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    if (!passkeyInfo) {
      return new Response(JSON.stringify({ error: '该用户未注册Passkey', noPasskey: true }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 生成挑战
    const challenge = generateChallenge();
    
    // 构建认证选项
    const options = {
      challenge: challenge,
      rpId: new URL(request.url).hostname,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: [{
        id: passkeyInfo.id,
        type: 'public-key'
      }]
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
    console.error('Passkey认证请求处理出错:', error);
    return new Response(JSON.stringify({ error: 'Passkey认证请求处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 