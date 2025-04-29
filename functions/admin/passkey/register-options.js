/**
 * Cloudflare Pages Function for generating WebAuthn/Passkey registration options
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
import { generateRegistrationOptions } from '@simplewebauthn/server';

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
    
    // 获取用户已有的凭据列表
    const existingCredentials = await getUserCredentials(userId, env);
    
    // 生成注册选项
    const rpName = '个人网站管理后台';
    const rpID = new URL(request.url).hostname;
    
    const options = generateRegistrationOptions({
      rpName,
      rpID,
      userID: userId,
      userName: userId,
      // 排除用户已有的凭据
      excludeCredentials: existingCredentials.map(cred => ({
        id: Buffer.from(cred.credentialID, 'base64url'),
        type: 'public-key',
        transports: cred.transports || ['internal'],
      })),
      authenticatorSelection: {
        // 要求用户认证
        userVerification: 'required',
        // 鼓励使用平台认证器 (如 Windows Hello, Touch ID)
        authenticatorAttachment: 'platform',
        // 要求常驻密钥
        residentKey: 'required',
      }
    });

    // 存储注册挑战以便后续验证
    await env.blog_data.put(`passkey:challenge:${userId}`, JSON.stringify(options.challenge), {
      expirationTtl: 300 // 5分钟过期
    });

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });
  } catch (error) {
    console.error('生成Passkey注册选项出错:', error);
    return new Response(JSON.stringify({ error: '生成注册选项失败: ' + error.message }), {
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

/**
 * 获取用户的凭据列表
 */
async function getUserCredentials(userId, env) {
  const credentialsKey = `passkey:credentials:${userId}`;
  const credentials = await env.blog_data.get(credentialsKey, { type: 'json' });
  return credentials || [];
} 