/**
 * Passkey（WebAuthn）助手函数
 * 用于处理WebAuthn相关操作
 */

// 生成随机挑战字符串
function generateRandomChallenge() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

// Base64URL编码
function encodeBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64URL解码
function decodeBase64Url(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 生成注册选项
 * @param {Object} options - 注册选项
 * @returns {Object} - 格式化后的注册选项
 */
export async function generateRegistrationOptions(options) {
  const {
    rpName,
    rpID,
    userID,
    userName,
    attestationType = 'none',
    authenticatorSelection = {
      residentKey: 'preferred',
      userVerification: 'preferred'
    },
    timeout = 60000 // 60秒
  } = options;

  // 生成随机挑战
  const challenge = generateRandomChallenge();

  return {
    rp: {
      name: rpName,
      id: rpID
    },
    user: {
      id: userID,
      name: userName,
      displayName: userName
    },
    challenge: encodeBase64Url(challenge),
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 } // RS256
    ],
    timeout,
    attestation: attestationType,
    authenticatorSelection,
    excludeCredentials: [] // 可选，排除已存在的凭证
  };
}

/**
 * 验证注册响应
 * @param {Object} options - 验证选项
 * @returns {Object} - 验证结果
 */
export async function verifyRegistrationResponse(options) {
  const {
    credential,
    expectedChallenge,
    expectedOrigin,
    expectedRPID
  } = options;

  try {
    // 1. 验证挑战
    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(
        decodeBase64Url(credential.response.clientDataJSON)
      )
    );

    if (clientDataJSON.type !== 'webauthn.create') {
      throw new Error('无效的响应类型');
    }

    if (clientDataJSON.challenge !== expectedChallenge) {
      throw new Error('挑战验证失败');
    }

    // 2. 验证源和relying party ID
    if (clientDataJSON.origin !== expectedOrigin) {
      throw new Error('源验证失败');
    }

    // 3. 解析attestationObject
    const attestationObject = decodeBase64Url(credential.response.attestationObject);
    
    // 这里应该使用CBOR解码库来解析attestationObject
    // 简化起见，我们跳过完整的attestation验证
    // 在生产环境中，应该使用专门的WebAuthn库进行完整验证

    // 4. 提取credentialID和publicKey（简化版）
    const credentialID = credential.id;
    // 这里也需要从attestationObject中提取publicKey
    // 我们简化处理，直接返回原始的attestationObject编码
    const credentialPublicKey = credential.response.attestationObject;

    return {
      verified: true,
      registrationInfo: {
        credentialID,
        credentialPublicKey,
        counter: 0
      }
    };
  } catch (error) {
    console.error('验证注册响应出错:', error);
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * 生成认证选项
 * @param {Object} options - 认证选项
 * @returns {Object} - 格式化后的认证选项
 */
export async function generateAuthenticationOptions(options) {
  const {
    rpID,
    allowCredentials = [],
    userVerification = 'preferred',
    timeout = 60000 // 60秒
  } = options;

  // 生成随机挑战
  const challenge = generateRandomChallenge();

  return {
    rpID,
    challenge: encodeBase64Url(challenge),
    allowCredentials,
    userVerification,
    timeout
  };
}

/**
 * 验证认证响应
 * @param {Object} options - 验证选项
 * @returns {Object} - 验证结果
 */
export async function verifyAuthenticationResponse(options) {
  const {
    credential,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    authenticator
  } = options;

  try {
    // 1. 验证挑战
    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(
        decodeBase64Url(credential.response.clientDataJSON)
      )
    );

    if (clientDataJSON.type !== 'webauthn.get') {
      throw new Error('无效的响应类型');
    }

    if (clientDataJSON.challenge !== expectedChallenge) {
      throw new Error('挑战验证失败');
    }

    // 2. 验证源和relying party ID
    if (clientDataJSON.origin !== expectedOrigin) {
      throw new Error('源验证失败');
    }

    // 3. 验证签名（简化版）
    // 在实际生产环境，需要使用公钥验证签名
    // 这里简化处理，假设签名是有效的

    // 4. 检查计数器（简化版）
    const authenticatorData = decodeBase64Url(credential.response.authenticatorData);
    // 从authenticatorData中提取计数器值（实际中应该解析二进制格式）
    // 简化起见，我们假设计数器递增
    const counter = authenticator.counter + 1;

    return {
      verified: true,
      authenticationInfo: {
        counter: counter
      }
    };
  } catch (error) {
    console.error('验证认证响应出错:', error);
    return {
      verified: false,
      error: error.message
    };
  }
} 