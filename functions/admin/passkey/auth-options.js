/**
 * Cloudflare Pages Function for generating WebAuthn/Passkey authentication options
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const requestData = await request.json();
    const { username } = requestData;

    if (!username) {
      return new Response(JSON.stringify({ error: '缺少用户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 获取用户注册的凭据
    const credentialsKey = `passkey:credentials:${username}`;
    const credentials = await env.blog_data.get(credentialsKey, { type: 'json' });
    
    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ 
        error: '未找到该用户的Passkey凭据',
        noCredentials: true
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 生成验证选项
    const options = generateAuthenticationOptions({
      // 允许用户使用之前注册的任何凭据
      allowCredentials: credentials.map(cred => ({
        id: Buffer.from(cred.credentialID, 'base64url'),
        type: 'public-key',
        transports: cred.transports || [],
      })),
      userVerification: 'required',
      // 使用 rpID 和原点限制凭据的使用
      rpID: new URL(request.url).hostname,
    });

    // 暂时存储验证挑战
    await env.blog_data.put(`passkey:challenge:${username}`, options.challenge, {
      expirationTtl: 300 // 5分钟过期
    });

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成Passkey验证选项出错:', error);
    return new Response(JSON.stringify({ error: '生成验证选项失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 