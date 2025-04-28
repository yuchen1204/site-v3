// 常规密码登录表单处理
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

// Passkey登录表单处理
document.getElementById('passkey-login-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('passkey-username');
    const errorElement = document.getElementById('login-error');
    const submitButton = this.querySelector('button[type="submit"]');
    const registerContainer = document.getElementById('register-passkey-container');

    const username = usernameInput.value;

    if (!username) {
        errorElement.textContent = '请输入用户名';
        errorElement.style.display = 'block';
        return;
    }

    // 检查是否支持WebAuthn
    if (!window.PasskeyUtils.isWebAuthnSupported()) {
        errorElement.textContent = '您的浏览器不支持Passkey/WebAuthn，请使用密码登录或更新浏览器。';
        errorElement.style.display = 'block';
        return;
    }

    // 重置错误信息并禁用按钮
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    submitButton.disabled = true;

    try {
        // 尝试使用Passkey登录
        const result = await window.PasskeyUtils.loginWithPasskey(username);
        
        if (result.success) {
            // 登录成功，跳转到 dashboard
            window.location.href = '/admin/dashboard.html';
        } else {
            errorElement.textContent = '验证失败，请重试。';
            errorElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Passkey登录失败:', error);
        
        // 检查是否是由于没有注册Passkey
        if (error.message && (
            error.message.includes('该用户尚未注册Passkey') || 
            error.message.includes('找不到用户的Passkey')
        )) {
            errorElement.textContent = '您尚未注册Passkey，请先使用密码登录，然后注册Passkey。';
            
            // 在已登录状态下，显示注册按钮
            const isLoggedIn = document.cookie.includes('admin_session=');
            if (isLoggedIn) {
                registerContainer.style.display = 'block';
            }
        } else {
            errorElement.textContent = error.message || '登录失败，请重试或使用密码登录。';
        }
        
        errorElement.style.display = 'block';
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
    }
});

// 注册Passkey按钮处理
document.getElementById('register-passkey-btn')?.addEventListener('click', async function() {
    const errorElement = document.getElementById('login-error');
    
    // 检查是否登录
    if (!document.cookie.includes('admin_session=')) {
        errorElement.textContent = '请先登录后再注册Passkey。';
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        
        // 注册新的Passkey
        const result = await window.PasskeyUtils.registerPasskey();
        
        if (result.success) {
            errorElement.textContent = 'Passkey注册成功！现在您可以使用Passkey登录了。';
            errorElement.style.display = 'block';
            errorElement.className = 'mt-3 text-success text-center';
        } else {
            throw new Error('注册失败，请重试。');
        }
    } catch (error) {
        console.error('Passkey注册失败:', error);
        errorElement.textContent = error.message || '注册失败，请重试。';
        errorElement.style.display = 'block';
        errorElement.className = 'mt-3 text-danger text-center';
    }
});

// 检查WebAuthn支持并根据登录状态设置界面
document.addEventListener('DOMContentLoaded', function() {
    const passkeyTab = document.getElementById('passkey-tab');
    const registerContainer = document.getElementById('register-passkey-container');
    
    // 如果浏览器不支持WebAuthn，禁用Passkey选项卡
    if (!window.PasskeyUtils || !window.PasskeyUtils.isWebAuthnSupported()) {
        passkeyTab.classList.add('disabled');
        passkeyTab.setAttribute('title', '您的浏览器不支持Passkey/WebAuthn');
    }
    
    // 检查是否已登录
    const isLoggedIn = document.cookie.includes('admin_session=');
    
    if (isLoggedIn) {
        // 如果已登录，显示注册Passkey按钮
        registerContainer.style.display = 'block';
    } else {
        // 未登录，隐藏注册按钮
        registerContainer.style.display = 'none';
    }
}); 