document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // 阻止表单默认提交行为

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorElement = document.getElementById('login-error');
    const submitButton = this.querySelector('button[type="submit"]');

    const username = usernameInput.value;
    const password = passwordInput.value;

    // 重置错误信息并禁用按钮
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    submitButton.disabled = true;
    submitButton.textContent = '登录中...';

    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            // 登录成功，跳转到 dashboard
            window.location.href = '/admin/dashboard.html';
        } else {
            const errorData = await response.json();
            errorElement.textContent = errorData.error || '用户名或密码错误';
            errorElement.style.display = 'block';
        }
    } catch (error) {
        console.error('登录请求失败:', error);
        errorElement.textContent = '登录请求失败，请检查网络连接。';
        errorElement.style.display = 'block';
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
        submitButton.textContent = '登录';
    }
});

// --- 添加Passkey相关功能 ---

// 检测浏览器是否支持WebAuthn
const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined && 
           typeof window.PublicKeyCredential === 'function';
};

// 页面加载时检查WebAuthn支持并显示/隐藏相关按钮
document.addEventListener('DOMContentLoaded', function() {
    const passkeyButton = document.getElementById('passkey-login-button');
    if (passkeyButton) {
        if (isWebAuthnSupported()) {
            passkeyButton.style.display = 'block';
        } else {
            passkeyButton.style.display = 'none';
        }
    }
});

// Passkey登录按钮点击事件
document.getElementById('passkey-login-button')?.addEventListener('click', async function() {
    const errorElement = document.getElementById('login-error');
    this.disabled = true;
    errorElement.style.display = 'none';
    
    try {
        // 1. 开始认证流程
        const startResponse = await fetch('/admin/api/passkey/begin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!startResponse.ok) {
            throw new Error('开始认证流程失败');
        }
        
        const { authId, publicKey } = await startResponse.json();
        
        // 2. 准备认证选项
        const options = {
            ...publicKey,
            challenge: base64UrlToBuffer(publicKey.challenge)
        };
        
        // 3. 调用浏览器的证书API
        const credential = await navigator.credentials.get({
            publicKey: options
        });
        
        // 4. 处理认证结果
        const authResult = {
            authId,
            credential: {
                id: credential.id,
                rawId: arrayBufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    authenticatorData: arrayBufferToBase64Url(credential.response.authenticatorData),
                    clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
                    signature: arrayBufferToBase64Url(credential.response.signature),
                    userHandle: credential.response.userHandle ? 
                                arrayBufferToBase64Url(credential.response.userHandle) : null
                }
            }
        };
        
        // 5. 发送认证结果到服务器
        const completeResponse = await fetch('/admin/api/passkey/complete-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authResult)
        });
        
        const completeData = await completeResponse.json();
        
        if (completeResponse.ok && completeData.success) {
            // 认证成功，重定向到指定页面
            window.location.href = completeData.redirect || '/admin/dashboard.html';
        } else {
            // 认证失败
            throw new Error(completeData.error || '认证失败');
        }
        
    } catch (error) {
        console.error('Passkey登录失败:', error);
        errorElement.textContent = `Passkey登录失败: ${error.message || '未知错误'}`;
        errorElement.style.display = 'block';
    } finally {
        this.disabled = false;
    }
});

// 辅助函数：Base64Url转ArrayBuffer
function base64UrlToBuffer(base64Url) {
    const padding = '='.repeat((4 - base64Url.length % 4) % 4);
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

// 辅助函数：ArrayBuffer转Base64Url
function arrayBufferToBase64Url(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 