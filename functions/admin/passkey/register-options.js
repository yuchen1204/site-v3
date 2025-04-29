import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// 辅助函数：将 ArrayBuffer 转换为 Base64URL 字符串
// Cloudflare KV 不能直接存储 ArrayBuffer，需要转换
// function arrayBufferToBase64Url(buffer) {
//   return isoBase64URL.fromBuffer(buffer);
// }
// Note: @simplewebauthn/server helpers might handle this, check documentation if needed.

/**
 * 生成 Passkey 注册选项
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  // 检查必要的环境变量
  const RP_ID = env.RP_ID; // e.g., 'yourdomain.com'
  const RP_NAME = env.RP_NAME; // e.g., '个人网站 V3'
  const ADMIN_USERNAME = env.ADMIN_USERNAME; // 获取配置的管理员用户名
  
  if (!RP_ID || !RP_NAME || !ADMIN_USERNAME) {
    console.error('Passkey 相关环境变量 (RP_ID, RP_NAME, ADMIN_USERNAME) 未设置');
    return new Response(JSON.stringify({ error: '服务器配置错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const { username } = await request.json();

    // 验证是否是允许注册的管理员用户名
    if (username !== ADMIN_USERNAME) {
        return new Response(JSON.stringify({ error: '无效的用户名' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    // 理论上，后台用户是固定的，但为了演示，我们使用 username
    const userId = `admin_${username}`; // 使用唯一的内部用户ID
    const userDisplayName = username;

    // 从 KV 获取该用户已有的 Passkey 凭证 (authenticators)
    const kvKey = `passkey:${username}`;
    let userAuthenticators = await env.blog_data.get(kvKey, { type: 'json' }) || [];
    
    // SimpleWebAuthn 需要 authenticator 的 credentialID 是 Uint8Array
    // 从 KV 读取时是 Base64URL 编码的字符串，需要转换回来
    userAuthenticators = userAuthenticators.map(auth => ({
        ...auth,
        credentialID: isoBase64URL.toBuffer(auth.credentialID),
        // 如果 credentialPublicKey 也存储为 Base64URL，也需要转换
        // credentialPublicKey: isoBase64URL.toBuffer(auth.credentialPublicKey), 
    }));

    const options = await generateRegistrationOptions({
      rpID: RP_ID,
      rpName: RP_NAME,
      userID: userId,
      userName: username, // 通常用于显示，可以是 email 或 username
      userDisplayName: userDisplayName,
      // 不要注册已有的凭证
      excludeCredentials: userAuthenticators.map(auth => ({
        id: auth.credentialID,
        type: 'public-key',
        transports: auth.transports, // 可选，但推荐包含
      })),
      // 设置认证器偏好 (可选)
      authenticatorSelection: {
        // authenticatorAttachment: 'platform', // 偏好平台认证器 (如 Face ID, Windows Hello)
        residentKey: 'required', // 要求创建可发现凭证 (Discoverable Credential / Resident Key)
        userVerification: 'preferred', // 偏好用户验证 (生物识别, PIN)
      },
      // 设置 attestation 类型 (可选，direct 通常足够)
      attestationType: 'none', // 'none' 更简单, 'direct' 或 'indirect' 提供更多关于认证器的信息
    });

    // 将 challenge 临时存储在 KV 中，以便后续验证
    // 使用 userId 作为 key 的一部分，并设置较短的过期时间 (例如 5 分钟)
    const challengeKey = `challenge:${userId}:register`;
    await env.blog_data.put(challengeKey, options.challenge, { expirationTtl: 300 }); 

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });

  } catch (error) {
    console.error('生成 Passkey 注册选项失败:', error);
    return new Response(JSON.stringify({ error: '生成注册选项时出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 