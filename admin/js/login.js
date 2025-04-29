document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    // 检查是否支持WebAuthn/Passkey
    const isWebAuthnSupported = window.PublicKeyCredential !== undefined;
    
    // 如果支持WebAuthn，显示Passkey登录按钮
    if (isWebAuthnSupported) {
        // 创建Passkey登录按钮容器
        const passkeyContainer = document.createElement('div');
        passkeyContainer.className = 'text-center mt-3';
        passkeyContainer.innerHTML = `
            <hr />
            <p>或使用</p>
            <button type="button" id="passkey-login-btn" class="btn btn-outline-primary mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key-fill me-2" viewBox="0 0 16 16">
                    <path d="M3.5 11.5a3.5 3.5 0 1 1 3.163-5H14L15.5 8 14 9.5l-1-1-1 1-1-1-1 1-1-1-1 1H6.663a3.5 3.5 0 0 1-3.163 2zM2.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                </svg>
                使用Passkey登录
            </button>
        `;
        
        // 在登录表单后插入Passkey按钮
        loginForm.parentNode.insertBefore(passkeyContainer, loginForm.nextSibling);
        
        // 添加Passkey登录按钮点击事件
        document.getElementById('passkey-login-btn').addEventListener('click', handlePasskeyLogin);
    }
    
    // 表单提交处理
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('请填写用户名和密码');
            return;
        }
        
        // 显示加载状态
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登录中...`;
        
        // 发送登录请求
        fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 登录成功，重定向到仪表板
                window.location.href = '/admin/dashboard.html';
            } else {
                // 登录失败
                showError(data.error || '登录失败，请检查用户名和密码');
                // 重置按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        })
        .catch(error => {
            console.error('登录请求出错:', error);
            showError('登录请求出错，请稍后再试');
            // 重置按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        });
    });

    // 显示错误信息的辅助函数
    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    // 处理Passkey登录
    async function handlePasskeyLogin() {
        const username = document.getElementById('username').value;
        
        if (!username) {
            showError('使用Passkey登录前请输入用户名');
            return;
        }
        
        try {
            // 显示加载状态
            const passkeyBtn = document.getElementById('passkey-login-btn');
            const originalBtnText = passkeyBtn.innerHTML;
            passkeyBtn.disabled = true;
            passkeyBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 验证中...`;
            
            // 请求身份验证选项
            const optionsResponse = await fetch('/admin/passkey/auth-options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            
            const optionsData = await optionsResponse.json();
            
            // 如果用户没有注册Passkey
            if (!optionsResponse.ok) {
                if (optionsData.noCredentials) {
                    showError('该用户未注册Passkey，请使用密码登录，或登录后在设置中注册Passkey');
                } else {
                    showError(optionsData.error || '获取验证选项失败');
                }
                // 重置按钮状态
                passkeyBtn.disabled = false;
                passkeyBtn.innerHTML = originalBtnText;
                return;
            }
            
            // 获取浏览器的身份验证响应
            const assertionResponse = await navigator.credentials.get({
                publicKey: {
                    challenge: base64UrlToBuffer(optionsData.challenge),
                    allowCredentials: optionsData.allowCredentials.map(cred => ({
                        id: base64UrlToBuffer(cred.id),
                        type: cred.type,
                        transports: cred.transports
                    })),
                    timeout: optionsData.timeout,
                    userVerification: optionsData.userVerification
                }
            });
            
            // 转换验证响应以便发送到服务器
            const authResponse = {
                username,
                assertionResponse: {
                    id: assertionResponse.id,
                    rawId: bufferToBase64Url(assertionResponse.rawId),
                    response: {
                        authenticatorData: bufferToBase64Url(assertionResponse.response.authenticatorData),
                        clientDataJSON: bufferToBase64Url(assertionResponse.response.clientDataJSON),
                        signature: bufferToBase64Url(assertionResponse.response.signature),
                        userHandle: assertionResponse.response.userHandle ? bufferToBase64Url(assertionResponse.response.userHandle) : null
                    },
                    type: assertionResponse.type,
                    clientExtensionResults: assertionResponse.getClientExtensionResults()
                }
            };
            
            // 发送验证响应到服务器
            const verifyResponse = await fetch('/admin/passkey/auth-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(authResponse)
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyResponse.ok && verifyData.success) {
                // 身份验证成功，重定向到仪表板
                window.location.href = '/admin/dashboard.html';
            } else {
                // 身份验证失败
                showError(verifyData.error || '验证Passkey失败');
                // 重置按钮状态
                passkeyBtn.disabled = false;
                passkeyBtn.innerHTML = originalBtnText;
            }
        } catch (error) {
            console.error('Passkey登录出错:', error);
            
            let errorMessage = '验证Passkey时出错';
            
            // 用户取消操作
            if (error.name === 'NotAllowedError') {
                errorMessage = '用户取消了操作';
            }
            
            showError(errorMessage);
            
            // 重置按钮状态
            const passkeyBtn = document.getElementById('passkey-login-btn');
            if (passkeyBtn) {
                passkeyBtn.disabled = false;
                passkeyBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key-fill me-2" viewBox="0 0 16 16">
                        <path d="M3.5 11.5a3.5 3.5 0 1 1 3.163-5H14L15.5 8 14 9.5l-1-1-1 1-1-1-1 1-1-1-1 1H6.663a3.5 3.5 0 0 1-3.163 2zM2.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                    </svg>
                    使用Passkey登录
                `;
            }
        }
    }
    
    // 工具函数: Base64Url转ArrayBuffer
    function base64UrlToBuffer(base64Url) {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padLen = (4 - (base64.length % 4)) % 4;
        const padded = base64 + '='.repeat(padLen);
        const binary = atob(padded);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return buffer;
    }
    
    // 工具函数: ArrayBuffer转Base64Url
    function bufferToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
}); 