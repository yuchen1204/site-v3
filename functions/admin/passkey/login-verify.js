import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// 辅助函数：将 ArrayBuffer 转换为 Base64URL 字符串
function arrayBufferToBase64Url(buffer) {
  return isoBase64URL.fromBuffer(buffer);
}

// 简单的 session token 生成 (与 functions/admin/login.js 保持一致或抽取为公共函数)
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 验证 Passkey 认证结果并创建会话
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 检查必要的环境变量
  const RP_ID = env.RP_ID;
  const EXPECTED_ORIGIN = env.EXPECTED_ORIGIN;
  const ADMIN_USERNAME = env.ADMIN_USERNAME;

  if (!RP_ID || !EXPECTED_ORIGIN || !ADMIN_USERNAME) {
    console.error('Passkey 相关环境变量 (RP_ID, EXPECTED_ORIGIN, ADMIN_USERNAME) 未设置');
    return new Response(JSON.stringify({ error: '服务器配置错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const { username, data: authenticationResponse } = await request.json();

    // 再次验证用户名
    if (username !== ADMIN_USERNAME) {
      return new Response(JSON.stringify({ error: '无效的用户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const userId = `admin_${username}`;
    const kvKey = `passkey:${username}`;

    // 从 KV 获取该用户的 authenticators
    let userAuthenticators = await env.blog_data.get(kvKey, { type: 'json' });

    if (!userAuthenticators || userAuthenticators.length === 0) {
      return new Response(JSON.stringify({ error: '未找到该用户的 Passkey 凭证' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 查找本次登录使用的 authenticator
    const credentialIDFromResponse = authenticationResponse.id;
    const authenticator = userAuthenticators.find(
      auth => auth.credentialID === credentialIDFromResponse
    );

    if (!authenticator) {
      return new Response(JSON.stringify({ error: '未找到匹配的 Passkey 凭证' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 将存储的 Base64URL 公钥和 ID 转回 Uint8Array
    const authenticatorForVerification = {
        ...authenticator,
        credentialID: isoBase64URL.toBuffer(authenticator.credentialID),
        credentialPublicKey: isoBase64URL.toBuffer(authenticator.credentialPublicKey),
    };

    // 从 KV 中获取之前存储的 challenge
    const challengeKey = `challenge:${userId}:login`;
    const expectedChallenge = await env.blog_data.get(challengeKey);

    if (!expectedChallenge) {
      return new Response(JSON.stringify({ error: '未找到 Challenge 或已过期' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 验证认证响应
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      authenticator: authenticatorForVerification,
      requireUserVerification: true, // 再次确认用户验证
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // 清除已使用的 challenge
      await env.blog_data.delete(challengeKey);

      // 更新 authenticator 的 counter
      const { newCounter } = authenticationInfo;
      authenticator.counter = newCounter;
      // 更新 KV 中的 authenticators 列表
      const updatedAuthenticators = userAuthenticators.map(auth => 
        auth.credentialID === authenticator.credentialID ? authenticator : auth
      );
      await env.blog_data.put(kvKey, JSON.stringify(updatedAuthenticators));
      
      // --- 登录成功，创建会话 --- 
      const sessionToken = generateSessionToken();
      const sessionKey = `session:${sessionToken}`;

      // 将 session token 存储在 KV 中 (设置过期时间，例如 1 小时)
      await env.blog_data.put(sessionKey, JSON.stringify({ username: username, loggedInAt: Date.now() }), {
        expirationTtl: 3600 // 1 hour
      });
      
      // 设置 HttpOnly cookie
      const headers = new Headers({
        'Content-Type': 'application/json;charset=UTF-8',
        'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
      });
      // --- 会话创建结束 ---

      return new Response(JSON.stringify({ verified: true }), {
        status: 200,
        headers: headers // 返回包含 Set-Cookie 的头
      });
    } else {
      // 验证失败，清除 challenge
      await env.blog_data.delete(challengeKey);
      return new Response(JSON.stringify({ error: 'Passkey 登录验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

  } catch (error) {
    console.error('验证 Passkey 认证失败:', error);
    // 尝试清除可能未清除的 challenge
     try {
      const { username } = await request.json();
      const userId = `admin_${username}`;
      const challengeKey = `challenge:${userId}:login`;
      await env.blog_data.delete(challengeKey);
    } catch (cleanupError) {
       console.error('清理 challenge 时出错:', cleanupError);
    } 

    return new Response(JSON.stringify({ error: '验证认证响应时出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 