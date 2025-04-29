/**
 * Cloudflare Pages Function for verifying WebAuthn/Passkey registration
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { verifyRegistrationResponse } from '@simplewebauthn/server';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 仅管理员可以注册 Passkey
    const userInfo = await validateAdminSession(request, env);
    if (!userInfo) {
      return new Response(JSON.stringify({ error: '未授权，请先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 确定用户 ID (这里用用户名)
    const userId = userInfo.username;
    
    // 获取存储的注册挑战
    const challengeKey = `passkey:challenge:${userId}`;
    const storedChallenge = await env.blog_data.get(challengeKey);
    
    if (!storedChallenge) {
      return new Response(JSON.stringify({ error: '注册会话已过期，请重新开始注册' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 从请求获取验证数据
    const data = await request.json();
    const { attestationResponse } = data;

    if (!attestationResponse) {
      return new Response(JSON.stringify({ error: '请求缺少必要数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 确定期望的原点和RP ID
    const origin = request.headers.get('Origin');
    const rpID = new URL(origin).hostname;

    // 验证注册响应
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: storedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: '验证失败', verification }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 清理注册挑战
    await env.blog_data.delete(challengeKey);

    // 提取凭据ID和公钥
    const { credentialID, credentialPublicKey } = verification.registrationInfo;
    const base64CredentialID = Buffer.from(credentialID).toString('base64url');
    const base64PublicKey = Buffer.from(credentialPublicKey).toString('base64url');

    // 获取用户现有凭据列表
    const credentialsKey = `passkey:credentials:${userId}`;
    let credentials = await env.blog_data.get(credentialsKey, { type: 'json' }) || [];

    // 为新凭据创建友好名称
    const deviceName = data.deviceName || `设备 ${credentials.length + 1}`;
    const now = new Date().toISOString();

    // 添加新凭据
    credentials.push({
      credentialID: base64CredentialID,
      publicKey: base64PublicKey,
      name: deviceName,
      createdAt: now,
      lastUsed: now,
      counter: verification.registrationInfo.counter,
      transports: attestationResponse.response.transports || [],
    });

    // 存储更新的凭据列表
    await env.blog_data.put(credentialsKey, JSON.stringify(credentials));

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Passkey注册成功',
      deviceName
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('验证Passkey注册出错:', error);
    return new Response(JSON.stringify({ error: '验证注册失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 从请求中提取并验证管理员会话
 */
async function validateAdminSession(request, env) {
  // 获取 Cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies['admin_session'];

  if (!sessionToken) {
    return null; // 没有会话令牌
  }

  // 从 KV 获取会话数据
  const sessionKey = `session:${sessionToken}`;
  const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });

  if (!sessionData) {
    return null; // 无效会话
  }

  return sessionData; // 包含用户信息的会话
}

/**
 * 从 Cookie 头解析 Cookie
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
} 