/**
 * 获取WebAuthn/Passkey注册选项
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含注册选项
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 1. 从会话Cookie获取用户信息，确保用户已登录
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const admin_session = cookies.admin_session;
    
    if (!admin_session) {
      return new Response(JSON.stringify({ error: '未登录，请先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${admin_session}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData) {
      return new Response(JSON.stringify({ error: '会话无效或已过期，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 2. 获取用户名
    const username = sessionData.username || 'admin';
    
    // 3. 获取已注册的Passkey列表，用于排除已注册的设备
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 4. 获取网站信息
    const rpName = '个人网站管理后台';
    const rpID = new URL(request.url).hostname;
    
    // 5. 创建随机用户ID（如果不存在）
    let userId = await env.blog_data.get('admin:userid');
    if (!userId) {
      userId = crypto.randomUUID();
      await env.blog_data.put('admin:userid', userId);
    }
    
    // 6. 构建注册选项
    const options = {
      rp: {
        name: rpName,
        id: rpID
      },
      user: {
        id: userId,
        name: username,
        displayName: username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // 优先使用内置验证器（如指纹传感器）
        requireResidentKey: true,         // 要求客户端存储凭证
        userVerification: 'preferred'     // 优先使用用户验证
      },
      timeout: 60000,                    // 60秒超时
      attestation: 'none',               // 不需要验证信息
      excludeCredentials: passkeys.map(passkey => ({
        id: passkey.credentialID,
        type: 'public-key',
        transports: passkey.transports || ['internal', 'usb', 'ble', 'nfc']
      })),
      challenge: generateChallenge()      // 随机挑战
    };
    
    // 7. 存储注册会话信息，供后续验证使用
    const regSessionID = Math.random().toString(36).substring(2, 15);
    await env.blog_data.put(`passkey:reg:${regSessionID}`, JSON.stringify({
      challenge: options.challenge,
      username: username,
      timestamp: Date.now()
    }), { expirationTtl: 300 }); // 5分钟过期
    
    // 8. 设置临时会话cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `passkey_reg_session=${regSessionID}; HttpOnly; Path=/admin; Max-Age=300; SameSite=Strict`
    });
    
    return new Response(JSON.stringify(options), {
      headers,
      status: 200
    });
  } catch (error) {
    console.error('获取Passkey注册选项出错:', error);
    return new Response(JSON.stringify({ error: '获取注册选项出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 解析Cookie字符串
 * @param {string} cookieStr - Cookie字符串
 * @returns {Object} 解析后的Cookie对象
 */
function parseCookies(cookieStr) {
  const cookies = {};
  cookieStr.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = value;
  });
  return cookies;
}

/**
 * 生成随机挑战字符串
 * @returns {string} Base64URL编码的随机挑战
 */
function generateChallenge() {
  // 创建随机字节数组
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  // 转换为Base64URL格式
  return bufferToBase64URL(randomBytes);
}

/**
 * 将ArrayBuffer转换为Base64URL字符串
 * @param {ArrayBuffer} buffer - 要转换的二进制数据
 * @returns {string} Base64URL编码的字符串
 */
function bufferToBase64URL(buffer) {
  // 步骤1: 将ArrayBuffer转换为Base64字符串
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  // 步骤2: 将Base64转换为Base64URL (替换+为-，/为_，并移除末尾的=)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 