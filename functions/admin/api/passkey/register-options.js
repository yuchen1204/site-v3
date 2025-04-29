/**
 * 生成Passkey注册选项的API
 * 
 * 基于WebAuthn标准，为用户生成Passkey注册选项
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 确保用户已经通过基础认证
    const sessionCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: '需要先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionCookie}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData) {
      return new Response(JSON.stringify({ error: '登录会话无效' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从请求中获取用户名称
    const { username } = await request.json();
    if (!username) {
      return new Response(JSON.stringify({ error: '缺少用户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查用户是否已经注册了passkey
    const existingUser = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    
    // 生成注册选项 (依照WebAuthn规范)
    const registrationOptions = {
      challenge: generateRandomBuffer(32),
      rp: {
        name: '个人网站 V3',
        id: new URL(request.url).hostname
      },
      user: {
        id: generateRandomBuffer(16),
        name: username,
        displayName: username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      timeout: 60000, // 1分钟
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'preferred'
      }
    };
    
    // 将挑战(challenge)存储在会话中，以便后续验证
    sessionData.currentChallenge = bufferToBase64url(registrationOptions.challenge);
    await env.blog_data.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 3600 });
    
    // 将challenge转换为Base64URL编码的字符串
    registrationOptions.challenge = bufferToBase64url(registrationOptions.challenge);
    registrationOptions.user.id = bufferToBase64url(registrationOptions.user.id);
    
    return new Response(JSON.stringify(registrationOptions), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成注册选项出错:', error);
    return new Response(JSON.stringify({ error: '生成注册选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 工具函数：生成随机缓冲区
function generateRandomBuffer(size) {
  return crypto.getRandomValues(new Uint8Array(size));
}

// 工具函数：缓冲区转Base64URL
function bufferToBase64url(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 