import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

/**
 * 生成 Passkey 认证选项
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 检查必要的环境变量
  const RP_ID = env.RP_ID;
  const ADMIN_USERNAME = env.ADMIN_USERNAME;

  if (!RP_ID || !ADMIN_USERNAME) {
    console.error('Passkey 相关环境变量 (RP_ID, ADMIN_USERNAME) 未设置');
    return new Response(JSON.stringify({ error: '服务器配置错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const { username } = await request.json();

    // 再次验证用户名
    if (username !== ADMIN_USERNAME) {
        return new Response(JSON.stringify({ error: '无效的用户名' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }
    
    const userId = `admin_${username}`;

    // 从 KV 获取该用户的 Passkey 凭证
    const kvKey = `passkey:${username}`;
    let userAuthenticators = await env.blog_data.get(kvKey, { type: 'json' }) || [];

    if (!userAuthenticators || userAuthenticators.length === 0) {
      return new Response(JSON.stringify({ error: '未找到该用户的 Passkey 凭证' }), {
        status: 404, // Not Found
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 将存储的 Base64URL credentialID 转回 Uint8Array
    const allowCredentials = userAuthenticators.map(auth => ({
        id: isoBase64URL.toBuffer(auth.credentialID),
        type: 'public-key',
        transports: auth.transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      // 允许用户使用此 RP ID 下的任何已注册凭证
      allowCredentials: allowCredentials,
      userVerification: 'preferred', // 偏好用户验证
    });

    // 将 challenge 临时存储在 KV 中，以便后续验证
    const challengeKey = `challenge:${userId}:login`;
    await env.blog_data.put(challengeKey, options.challenge, { expirationTtl: 300 });

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });

  } catch (error) {
    console.error('生成 Passkey 认证选项失败:', error);
    return new Response(JSON.stringify({ error: '生成认证选项时出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 