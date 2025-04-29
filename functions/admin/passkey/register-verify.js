import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// 辅助函数：将 ArrayBuffer 转换为 Base64URL 字符串
function arrayBufferToBase64Url(buffer) {
  return isoBase64URL.fromBuffer(buffer);
}

/**
 * 验证 Passkey 注册结果并存储凭证
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 检查必要的环境变量
  const RP_ID = env.RP_ID;
  const RP_NAME = env.RP_NAME;
  const EXPECTED_ORIGIN = env.EXPECTED_ORIGIN; // e.g., 'https://yourdomain.com'
  const ADMIN_USERNAME = env.ADMIN_USERNAME;

  if (!RP_ID || !RP_NAME || !EXPECTED_ORIGIN || !ADMIN_USERNAME) {
    console.error('Passkey 相关环境变量 (RP_ID, RP_NAME, EXPECTED_ORIGIN, ADMIN_USERNAME) 未设置');
    return new Response(JSON.stringify({ error: '服务器配置错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const { username, data: registrationResponse } = await request.json();

    // 再次验证用户名
    if (username !== ADMIN_USERNAME) {
        return new Response(JSON.stringify({ error: '无效的用户名' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    const userId = `admin_${username}`;

    // 从 KV 中获取之前存储的 challenge
    const challengeKey = `challenge:${userId}:register`;
    const expectedChallenge = await env.blog_data.get(challengeKey);

    if (!expectedChallenge) {
      return new Response(JSON.stringify({ error: '未找到 Challenge 或已过期' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 验证注册响应
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true, // 确保用户已验证 (例如，通过生物识别或PIN)
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      // 清除已使用的 challenge
      await env.blog_data.delete(challengeKey);

      const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = registrationInfo;

      // 从 KV 获取该用户当前的 authenticators
      const kvKey = `passkey:${username}`;
      let userAuthenticators = await env.blog_data.get(kvKey, { type: 'json' }) || [];
      
      // 检查凭证是否已存在
      const existingAuthenticator = userAuthenticators.find(auth => 
         arrayBufferToBase64Url(credentialID) === auth.credentialID
      );

      if (existingAuthenticator) {
        console.warn('尝试注册已存在的 Passkey 凭证');
        // 可以选择更新现有凭证的 counter 或直接返回成功
         return new Response(JSON.stringify({ verified: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
         });
      } 

      // 创建新的 authenticator 对象用于存储
      const newAuthenticator = {
        credentialID: arrayBufferToBase64Url(credentialID), // 存储为 Base64URL
        credentialPublicKey: arrayBufferToBase64Url(credentialPublicKey), // 存储为 Base64URL
        counter: counter,
        credentialDeviceType: credentialDeviceType, // 'singleDevice' 或 'multiDevice'
        credentialBackedUp: credentialBackedUp, // 是否已备份
        transports: registrationResponse.response.transports || [], // 获取 transports 信息
      };

      // 将新的 authenticator 添加到用户列表中并存回 KV
      userAuthenticators.push(newAuthenticator);
      await env.blog_data.put(kvKey, JSON.stringify(userAuthenticators));

      return new Response(JSON.stringify({ verified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    } else {
      // 验证失败，清除 challenge
      await env.blog_data.delete(challengeKey);
      return new Response(JSON.stringify({ error: 'Passkey 验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

  } catch (error) {
    console.error('验证 Passkey 注册失败:', error);
    // 尝试清除可能未清除的 challenge
    try {
      const { username } = await request.json();
      const userId = `admin_${username}`;
      const challengeKey = `challenge:${userId}:register`;
      await env.blog_data.delete(challengeKey);
    } catch (cleanupError) {
       console.error('清理 challenge 时出错:', cleanupError); 
    }
    
    return new Response(JSON.stringify({ error: '验证注册响应时出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 