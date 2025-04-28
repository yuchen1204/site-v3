/**
 * Passkey工具函数
 * 用于处理浏览器端的WebAuthn操作
 */

// 检查浏览器是否支持WebAuthn
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined && 
         typeof window.PublicKeyCredential === 'function';
}

// 将Base64URL字符串转换为ArrayBuffer
function base64UrlToArrayBuffer(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = 4 - (base64.length % 4);
  const padding = padLen < 4 ? '='.repeat(padLen) : '';
  const binary = window.atob(base64 + padding);
  const buffer = new ArrayBuffer(binary.length);
  const uint8Array = new Uint8Array(buffer);
  
  for (let i = 0; i < binary.length; i++) {
    uint8Array[i] = binary.charCodeAt(i);
  }
  
  return buffer;
}

// 将ArrayBuffer转换为Base64URL字符串
function arrayBufferToBase64Url(buffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// 准备注册选项
function prepareRegistrationOptions(options) {
  const challenge = base64UrlToArrayBuffer(options.challenge);
  
  // 转换user.id为ArrayBuffer
  options.user.id = base64UrlToArrayBuffer(btoa(options.user.id));
  
  // 转换excludeCredentials中的id为ArrayBuffer
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map(credential => {
      return {
        ...credential,
        id: base64UrlToArrayBuffer(credential.id)
      };
    });
  }
  
  return {
    ...options,
    challenge
  };
}

// 准备认证选项
function prepareAuthenticationOptions(options) {
  const challenge = base64UrlToArrayBuffer(options.challenge);
  
  // 转换allowCredentials中的id为ArrayBuffer
  if (options.allowCredentials) {
    options.allowCredentials = options.allowCredentials.map(credential => {
      return {
        ...credential,
        id: base64UrlToArrayBuffer(credential.id)
      };
    });
  }
  
  return {
    ...options,
    challenge
  };
}

// 准备注册响应
function prepareRegistrationResponse(credential) {
  return {
    id: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
      transports: credential.response.getTransports ? credential.response.getTransports() : []
    }
  };
}

// 准备认证响应
function prepareAuthenticationResponse(credential) {
  return {
    id: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: arrayBufferToBase64Url(credential.response.authenticatorData),
      signature: arrayBufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? arrayBufferToBase64Url(credential.response.userHandle) : null
    }
  };
}

// 注册新的Passkey凭证
async function registerPasskey(username) {
  try {
    // 显示加载指示器
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('loading-text').textContent = '正在生成注册选项...';
    
    // 1. 从服务器获取注册选项
    const optionsResponse = await fetch('/admin/api/passkey/register');
    
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || '获取注册选项失败');
    }
    
    const options = await optionsResponse.json();
    
    // 2. 准备选项
    const publicKeyOptions = prepareRegistrationOptions(options);
    
    document.getElementById('loading-text').textContent = '请在设备上完成验证...';
    
    // 3. 创建凭证
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions
    });
    
    document.getElementById('loading-text').textContent = '正在验证注册...';
    
    // 4. 准备响应
    const credentialResponse = prepareRegistrationResponse(credential);
    
    // 5. 发送到服务器进行验证
    const verificationResponse = await fetch('/admin/api/passkey/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentialResponse)
    });
    
    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      throw new Error(error.error || '验证注册失败');
    }
    
    const result = await verificationResponse.json();
    
    // 隐藏加载指示器
    document.getElementById('loading-indicator').style.display = 'none';
    
    return result;
  } catch (error) {
    console.error('Passkey注册失败:', error);
    
    // 隐藏加载指示器
    document.getElementById('loading-indicator').style.display = 'none';
    
    throw error;
  }
}

// 使用Passkey进行登录
async function loginWithPasskey(username) {
  try {
    // 显示加载指示器
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('loading-text').textContent = '正在生成验证选项...';
    
    // 1. 从服务器获取验证选项
    const optionsResponse = await fetch(`/admin/api/passkey/login?username=${encodeURIComponent(username)}`);
    
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || '获取验证选项失败');
    }
    
    const options = await optionsResponse.json();
    
    // 2. 准备选项
    const publicKeyOptions = prepareAuthenticationOptions(options);
    
    document.getElementById('loading-text').textContent = '请在设备上完成验证...';
    
    // 3. 获取凭证
    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions
    });
    
    document.getElementById('loading-text').textContent = '正在验证登录...';
    
    // 4. 准备响应
    const credentialResponse = prepareAuthenticationResponse(credential);
    
    // 5. 发送到服务器进行验证
    const verificationResponse = await fetch('/admin/api/passkey/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentialResponse)
    });
    
    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      throw new Error(error.error || '验证登录失败');
    }
    
    const result = await verificationResponse.json();
    
    // 隐藏加载指示器
    document.getElementById('loading-indicator').style.display = 'none';
    
    return result;
  } catch (error) {
    console.error('Passkey登录失败:', error);
    
    // 隐藏加载指示器
    document.getElementById('loading-indicator').style.display = 'none';
    
    throw error;
  }
}

// 导出工具函数
window.PasskeyUtils = {
  isWebAuthnSupported,
  registerPasskey,
  loginWithPasskey
}; 