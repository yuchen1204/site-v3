/**
 * 工具函数库，用于Passkey认证相关操作
 */

/**
 * 生成一个随机挑战字符串
 * @returns {string} 一个Base64URL编码的随机挑战字符串
 */
export function generateChallenge() {
  // 生成32字节的随机数
  const randBytes = new Uint8Array(32);
  crypto.getRandomValues(randBytes);
  // 转换为Base64URL编码字符串
  return bufferToBase64URLString(randBytes);
}

/**
 * 将Base64URL编码的字符串转换为ArrayBuffer
 * @param {string} base64URLString - 要转换的Base64URL字符串
 * @returns {ArrayBuffer} 转换后的ArrayBuffer
 */
export function base64URLStringToBuffer(base64URLString) {
  // 从Base64URL格式转换为Base64
  const base64String = base64URLString
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // 添加必要的填充
  const paddedBase64 = base64String.padEnd(
    base64String.length + (4 - (base64String.length % 4 || 4)) % 4,
    '='
  );
  
  // 解码Base64字符串
  const binary = atob(paddedBase64);
  
  // 转换为ArrayBuffer
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return buffer;
}

/**
 * 将ArrayBuffer转换为Base64URL编码的字符串
 * @param {ArrayBuffer} buffer - 要转换的ArrayBuffer
 * @returns {string} 转换后的Base64URL字符串
 */
export function bufferToBase64URLString(buffer) {
  // 转换为字节数组
  const bytes = new Uint8Array(buffer);
  let binary = '';
  
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  // 转换为Base64
  const base64 = btoa(binary);
  
  // 转换为Base64URL格式
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 验证原始签名数据
 * 注意：这是一个简化示例，实际生产环境需要更复杂的实现
 * @param {Object} publicKey - 存储的公钥信息
 * @param {Object} authResponse - 认证响应
 * @param {string} challenge - 预期的挑战
 * @returns {boolean} 验证是否成功
 */
export function verifySignature(publicKey, authResponse, challenge) {
  // 本示例中，我们只验证挑战是否匹配
  // 在实际生产环境中，需要实现完整的签名验证逻辑
  try {
    const clientDataJSON = JSON.parse(atob(authResponse.clientDataJSON));
    return clientDataJSON.challenge === challenge;
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
} 