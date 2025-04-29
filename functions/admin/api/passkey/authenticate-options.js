/**
 * 获取WebAuthn/Passkey认证选项
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含验证选项
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // 1. 获取网站名称和域名信息（应该从环境变量或配置中获取）
    const rpName = '个人网站管理后台';
    const rpID = new URL(context.request.url).hostname;
    
    // 2. 从KV获取已注册的Passkey
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 如果没有已注册的Passkey，返回错误
    if (!passkeys || passkeys.length === 0) {
      return new Response(JSON.stringify({
        error: '没有找到已注册的Passkey，请先使用密码登录并注册Passkey'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 3. 构建验证选项
    const options = {
      rpID,
      challenge: generateChallenge(),
      allowCredentials: passkeys.map(passkey => ({
        id: passkey.credentialID,
        type: 'public-key',
        transports: passkey.transports || ['internal', 'usb', 'ble', 'nfc']
      })),
      timeout: 60000, // 60秒超时
      userVerification: 'preferred' // 优先使用用户验证（如指纹、面容ID等）
    };
    
    // 4. 将当前验证会话信息存储到KV中，供后续验证使用
    const sessionID = Math.random().toString(36).substring(2, 15);
    await env.blog_data.put(`passkey:challenge:${sessionID}`, JSON.stringify({
      challenge: options.challenge,
      timestamp: Date.now()
    }), { expirationTtl: 300 }); // 5分钟过期
    
    // 5. 设置临时session cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `passkey_session=${sessionID}; HttpOnly; Path=/admin; Max-Age=300; SameSite=Strict`
    });
    
    return new Response(JSON.stringify(options), {
      headers,
      status: 200
    });
  } catch (error) {
    console.error('获取Passkey验证选项出错:', error);
    return new Response(JSON.stringify({ error: '获取验证选项出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
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