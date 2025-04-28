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

// Passkey登录按钮点击事件
document.getElementById('passkey-login-button').addEventListener('click', async function() {
    const errorElement = document.getElementById('login-error');
    const button = this;
    
    // 重置错误信息并更新按钮状态
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> 验证中...';

    try {
        // 第一步：从服务器获取验证选项
        const getOptionsResponse = await fetch('/admin/api/passkey/get-authentication-options', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!getOptionsResponse.ok) {
            throw new Error('获取验证选项失败');
        }

        const options = await getOptionsResponse.json();
        
        // 将base64字符串转换为正确的格式
        options.challenge = base64UrlToArrayBuffer(options.challenge);
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(credential => {
                return {
                    ...credential,
                    id: base64UrlToArrayBuffer(credential.id)
                };
            });
        }

        // 第二步：调用浏览器的WebAuthn API进行验证
        const credential = await navigator.credentials.get({
            publicKey: options
        });

        // 第三步：将验证结果发送到服务器验证
        const verificationData = {
            id: credential.id,
            rawId: arrayBufferToBase64Url(credential.rawId),
            response: {
                authenticatorData: arrayBufferToBase64Url(credential.response.authenticatorData),
                clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
                signature: arrayBufferToBase64Url(credential.response.signature),
                userHandle: credential.response.userHandle ? arrayBufferToBase64Url(credential.response.userHandle) : null
            },
            type: credential.type
        };

        const verifyResponse = await fetch('/admin/api/passkey/verify-authentication', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(verificationData)
        });

        if (verifyResponse.ok) {
            // 登录成功，跳转到仪表盘
            window.location.href = '/admin/dashboard.html';
        } else {
            const errorData = await verifyResponse.json();
            throw new Error(errorData.error || '验证失败');
        }

    } catch (error) {
        console.error('Passkey登录失败:', error);
        
        // 根据错误类型显示友好的错误信息
        let errorMessage = '登录失败';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = '操作被取消或拒绝';
        } else if (error.name === 'SecurityError') {
            errorMessage = '安全错误: 可能的原因包括非HTTPS环境或不安全的上下文';
        } else if (error.name === 'AbortError') {
            errorMessage = '操作被中止';
        } else if (error.message) {
            errorMessage = `登录失败: ${error.message}`;
        }
        
        errorElement.textContent = errorMessage;
        errorElement.style.display = 'block';
    } finally {
        // 恢复按钮状态
        button.disabled = false;
        button.innerHTML = originalText;
    }
});

// 检查浏览器是否支持WebAuthn/Passkey
function checkWebAuthnSupport() {
    const passkeyButton = document.getElementById('passkey-login-button');
    const separator = document.querySelector('.separator');
    
    if (!window.PublicKeyCredential) {
        passkeyButton.disabled = true;
        passkeyButton.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i> 此浏览器不支持Passkey';
        passkeyButton.classList.replace('btn-outline-primary', 'btn-outline-secondary');
        passkeyButton.title = '请使用支持WebAuthn的现代浏览器（如Chrome、Firefox、Safari或Edge的最新版本）';
    } else {
        // 可选：检查是否有已注册的凭据
        checkForExistingPasskeys();
    }
}

// 检查用户是否有已注册的Passkey
async function checkForExistingPasskeys() {
    try {
        const response = await fetch('/admin/api/passkey/check-existing', {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            const passkeyButton = document.getElementById('passkey-login-button');
            
            if (!data.hasPasskeys) {
                // 没有注册的Passkey，更新按钮样式但保持可用
                passkeyButton.innerHTML = '<i class="bi bi-fingerprint me-2"></i> 未配置Passkey';
                passkeyButton.title = '请先使用用户名密码登录，然后在仪表盘中注册Passkey';
            }
        }
    } catch (error) {
        console.warn('检查Passkey状态失败:', error);
    }
}

// 辅助函数：Base64 URL 格式转换为 ArrayBuffer
function base64UrlToArrayBuffer(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLength, '=');
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buffer;
}

// 辅助函数：ArrayBuffer 转换为 Base64 URL 格式
function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// 页面加载完成后检查WebAuthn支持
document.addEventListener('DOMContentLoaded', checkWebAuthnSupport); 