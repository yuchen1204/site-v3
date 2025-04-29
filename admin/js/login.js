document.addEventListener('DOMContentLoaded', function() {
    // 获取SimpleWebAuthn对象
    const { startAuthentication, startRegistration } = SimpleWebAuthn;
    
    // 密码登录表单
    document.getElementById('login-form').addEventListener('submit', handlePasswordLogin);
    
    // Passkey登录表单
    document.getElementById('passkey-login-form').addEventListener('submit', handlePasskeyLogin);
    
    // 注册Passkey按钮
    document.getElementById('register-passkey-btn').addEventListener('click', handlePasskeyRegistration);
    
    // 检查用户是否已有Passkey (当用户名输入时)
    document.getElementById('passkey-username').addEventListener('blur', checkPasskeyStatus);
});

/**
 * 处理传统密码登录
 */
async function handlePasswordLogin(event) {
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
}

/**
 * 检查用户的Passkey状态
 */
async function checkPasskeyStatus() {
    const username = document.getElementById('passkey-username').value;
    const registerButton = document.getElementById('register-passkey-btn');
    
    if (!username) return; // 如果用户名为空，不执行检查
    
    try {
        const response = await fetch('/admin/api/passkey/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // 根据是否有Passkey调整UI
            if (data.hasPasskey) {
                registerButton.style.display = 'none'; // 隐藏注册按钮
            } else {
                registerButton.style.display = 'block'; // 显示注册按钮
            }
        }
    } catch (error) {
        console.error('检查Passkey状态失败:', error);
    }
}

/**
 * 处理Passkey登录流程
 */
async function handlePasskeyLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('passkey-username').value;
    const errorElement = document.getElementById('login-error');
    const successElement = document.getElementById('login-success');
    const submitButton = this.querySelector('button[type="submit"]');
    
    if (!username) {
        errorElement.textContent = '请输入用户名';
        errorElement.style.display = 'block';
        return;
    }
    
    // 重置状态
    errorElement.style.display = 'none';
    successElement.style.display = 'none';
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> 处理中...';
    
    try {
        // 1. 获取登录选项
        const optionsResponse = await fetch('/admin/api/passkey/login-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (!optionsResponse.ok) {
            const error = await optionsResponse.json();
            throw new Error(error.error || '获取登录选项失败');
        }
        
        const { options, temp_token } = await optionsResponse.json();
        
        // 2. 启动身份验证
        successElement.textContent = '请在设备上完成验证...';
        successElement.style.display = 'block';
        
        const credential = await SimpleWebAuthn.startAuthentication(options);
        
        // 3. 发送验证结果到服务器
        const verificationResponse = await fetch('/admin/api/passkey/login-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential, temp_token })
        });
        
        if (!verificationResponse.ok) {
            const error = await verificationResponse.json();
            throw new Error(error.error || '验证失败');
        }
        
        // 登录成功
        successElement.textContent = '登录成功，正在跳转...';
        successElement.style.display = 'block';
        
        // 延迟跳转，以显示成功消息
        setTimeout(() => {
            window.location.href = '/admin/dashboard.html';
        }, 1000);
        
    } catch (error) {
        console.error('Passkey登录失败:', error);
        errorElement.textContent = error.message || '登录失败，请重试';
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-fingerprint"></i> 使用Passkey登录';
    }
}

/**
 * 处理Passkey注册流程
 */
async function handlePasskeyRegistration() {
    const username = document.getElementById('passkey-username').value;
    const errorElement = document.getElementById('login-error');
    const successElement = document.getElementById('login-success');
    const registerButton = document.getElementById('register-passkey-btn');
    
    if (!username) {
        errorElement.textContent = '请输入用户名';
        errorElement.style.display = 'block';
        return;
    }
    
    // 重置状态
    errorElement.style.display = 'none';
    successElement.style.display = 'none';
    registerButton.disabled = true;
    registerButton.innerHTML = '<i class="bi bi-hourglass-split"></i> 处理中...';
    
    try {
        // 1. 先进行常规登录验证
        const password = prompt('注册Passkey前需要验证您的账户密码:');
        if (!password) {
            throw new Error('密码不能为空');
        }
        
        const loginResponse = await fetch('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!loginResponse.ok) {
            const error = await loginResponse.json();
            throw new Error(error.error || '用户名或密码错误');
        }
        
        // 2. 获取注册选项
        const optionsResponse = await fetch('/admin/api/passkey/register-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (!optionsResponse.ok) {
            const error = await optionsResponse.json();
            throw new Error(error.error || '获取注册选项失败');
        }
        
        const options = await optionsResponse.json();
        
        // 3. 启动注册
        successElement.textContent = '请在设备上完成Passkey注册...';
        successElement.style.display = 'block';
        
        const credential = await SimpleWebAuthn.startRegistration(options);
        
        // 4. 发送注册结果到服务器
        const verificationResponse = await fetch('/admin/api/passkey/register-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential, username })
        });
        
        if (!verificationResponse.ok) {
            const error = await verificationResponse.json();
            throw new Error(error.error || '验证失败');
        }
        
        // 注册成功
        successElement.textContent = 'Passkey注册成功，您现在可以使用Passkey登录';
        successElement.style.display = 'block';
        registerButton.style.display = 'none'; // 隐藏注册按钮
        
    } catch (error) {
        console.error('Passkey注册失败:', error);
        errorElement.textContent = error.message || '注册失败，请重试';
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
    } finally {
        registerButton.disabled = false;
        registerButton.innerHTML = '<i class="bi bi-plus-circle"></i> 注册新Passkey';
    }
} 