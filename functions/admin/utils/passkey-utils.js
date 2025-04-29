/**
 * Passkey 工具函数
 * 
 * 用于处理 WebAuthn/Passkey 相关的常用操作
 */

/**
 * 生成随机缓冲区
 * @param {number} size - 缓冲区大小（字节）
 * @returns {Uint8Array} - 随机缓冲区
 */
export function generateRandomBuffer(size) {
  return crypto.getRandomValues(new Uint8Array(size));
}

/**
 * 将 ArrayBuffer 或 Uint8Array 转换为 Base64URL 编码的字符串
 * @param {ArrayBuffer|Uint8Array} buffer - 输入缓冲区
 * @returns {string} - Base64URL 编码的字符串
 */
export function bufferToBase64url(buffer) {
  // 确保是 Uint8Array
  const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  
  // 转换为普通字符串
  const binary = Array.from(uint8Array)
    .map(byte => String.fromCharCode(byte))
    .join('');
  
  // 转换为 Base64
  const base64 = btoa(binary);
  
  // 转换为 Base64URL (替换 +, /, 移除 =)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 将 Base64URL 字符串转换为 Uint8Array
 * @param {string} base64url - Base64URL 编码的字符串
 * @returns {Uint8Array} - 解码后的缓冲区
 */
export function base64urlToBuffer(base64url) {
  // 转换回标准 Base64
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // 添加可能缺失的填充
  while (base64.length % 4) {
    base64 += '=';
  }
  
  // 解码
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * 生成会话令牌
 * @returns {string} - 随机会话令牌
 */
export function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 从请求中获取会话 Cookie
 * @param {Request} request - 请求对象
 * @returns {string|null} - 会话令牌或 null
 */
export function getSessionToken(request) {
  return request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1] || null;
}

/**
 * 检查用户是否已注册 Passkey
 * @param {Object} env - 环境对象，包含 KV 绑定
 * @param {string} username - 用户名
 * @returns {Promise<boolean>} - 是否已注册
 */
export async function hasUserPasskey(env, username) {
  const userPasskey = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
  return !!userPasskey;
} 