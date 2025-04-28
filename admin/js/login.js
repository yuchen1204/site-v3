// 传统密码登录
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

// Passkey登录
document.getElementById('passkey-login-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('passkey-username');
    const errorElement = document.getElementById('passkey-login-error');
    const infoElement = document.getElementById('passkey-login-info');
    const submitButton = this.querySelector('button[type="submit"]');

    const username = usernameInput.value;

    // 重置错误和信息提示
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    infoElement.textContent = '';
    infoElement.style.display = 'none';
    
    // 检查浏览器是否支持WebAuthn
    if (!window.PublicKeyCredential) {
        errorElement.textContent = '您的浏览器不支持Passkey/WebAuthn，请使用更现代的浏览器或选择密码登录。';
        errorElement.style.display = 'block';
        return;
    }

    // 禁用按钮并显示进度
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 处理中...';

    try {
        // 步骤1: 发起Passkey认证请求
        infoElement.textContent = '正在初始化Passkey登录...';
        infoElement.style.display = 'block';
        
        const authResponse = await fetch('/admin/api/passkey/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        if (!authResponse.ok) {
            const errorData = await authResponse.json();
            // 特殊处理：如果是用户未注册Passkey
            if (errorData.noPasskey) {
                errorElement.textContent = '该用户尚未注册Passkey，请使用密码登录后在设置中注册。';
                errorElement.style.display = 'block';
                // 自动切换到密码登录选项卡
                document.getElementById('password-tab').click();
                // 自动填充用户名
                document.getElementById('username').value = username;
                return;
            }
            
            throw new Error(errorData.error || '无法初始化Passkey认证');
        }

        // 获取挑战选项
        const options = await authResponse.json();
        
        // 将Base64URL字符串转换为ArrayBuffer
        options.challenge = base64URLToArrayBuffer(options.challenge);
        options.allowCredentials = options.allowCredentials.map(cred => {
            return {
                ...cred,
                id: base64URLToArrayBuffer(cred.id)
            };
        });

        // 步骤2: 使用浏览器API请求Passkey验证
        infoElement.textContent = '请按照浏览器提示完成Passkey验证...';
        
        const credential = await navigator.credentials.get({
            publicKey: options
        });

        // 步骤3: 验证Passkey响应
        infoElement.textContent = '验证Passkey响应中...';
        
        // 准备发送给服务器的凭证数据
        const authVerifyData = {
            username: username,
            credential: {
                id: credential.id,
                rawId: arrayBufferToBase64URL(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
                    authenticatorData: arrayBufferToBase64URL(credential.response.authenticatorData),
                    signature: arrayBufferToBase64URL(credential.response.signature),
                    userHandle: credential.response.userHandle ? arrayBufferToBase64URL(credential.response.userHandle) : null
                }
            }
        };

        // 发送验证请求
        const verifyResponse = await fetch('/admin/api/passkey/authenticate-verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(authVerifyData),
        });

        if (!verifyResponse.ok) {
            const errorData = await verifyResponse.json();
            throw new Error(errorData.error || 'Passkey验证失败');
        }

        // 验证成功，重定向到仪表板
        window.location.href = '/admin/dashboard.html';
        
    } catch (error) {
        console.error('Passkey登录失败:', error);
        errorElement.textContent = error.message || 'Passkey登录失败，请尝试使用密码登录或检查您的设备。';
        errorElement.style.display = 'block';
        infoElement.style.display = 'none';
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-fingerprint me-1"></i> 使用Passkey登录';
    }
});

// 辅助函数：Base64URL转ArrayBuffer
function base64URLToArrayBuffer(base64URLString) {
    // 转换Base64URL为普通Base64
    const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
    // 添加填充符
    const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)) % 4, '=');
    // 解码为二进制字符串
    const binary = atob(paddedBase64);
    // 创建ArrayBuffer
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    
    return buffer;
}

// 辅助函数：ArrayBuffer转Base64URL
function arrayBufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    // 转换为Base64
    const base64 = btoa(binary);
    
    // 转换为Base64URL
    return base64.replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
} 