// 从SimpleWebAuthn获取浏览器API
const { startAuthentication } = SimpleWebAuthn.browserSupport;

document.addEventListener('DOMContentLoaded', function() {
    // 检查浏览器是否支持WebAuthn/Passkey
    checkWebAuthnSupport();
    
    // 初始化常规登录
    initPasswordLogin();
    
    // 初始化Passkey登录
    initPasskeyLogin();
});

/**
 * 检查浏览器是否支持WebAuthn
 */
function checkWebAuthnSupport() {
    const passkeyTab = document.getElementById('passkey-tab');
    
    if (!window.PublicKeyCredential) {
        // 浏览器不支持WebAuthn，隐藏Passkey选项
        passkeyTab.style.display = 'none';
        // 保证密码标签页处于激活状态
        document.getElementById('password-tab').classList.add('active');
        document.getElementById('password-login').classList.add('show', 'active');
    }
}

/**
 * 初始化常规密码登录
 */
function initPasswordLogin() {
    document.getElementById('login-form').addEventListener('submit', async function(event) {
        event.preventDefault(); // 阻止表单默认提交行为

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorElement = document.getElementById('login-error');
        const successElement = document.getElementById('login-success');
        const submitButton = this.querySelector('button[type="submit"]');

        const username = usernameInput.value;
        const password = passwordInput.value;

        // 重置消息并禁用按钮
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        successElement.style.display = 'none';
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
                successElement.textContent = '登录成功，正在跳转...';
                successElement.style.display = 'block';
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
}

/**
 * 初始化Passkey登录
 */
function initPasskeyLogin() {
    const passkeyButton = document.getElementById('passkey-auth-button');
    if (!passkeyButton) return;
    
    passkeyButton.addEventListener('click', async function() {
        const errorElement = document.getElementById('login-error');
        const successElement = document.getElementById('login-success');
        
        // 重置消息并禁用按钮
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        successElement.style.display = 'none';
        passkeyButton.disabled = true;
        passkeyButton.innerHTML = '<i class="bi bi-hourglass-split"></i> 验证中...';
        
        try {
            // 1. 获取验证选项
            const optionsResponse = await fetch('/admin/api/passkey/authenticate-options', {
                method: 'GET'
            });
            
            if (!optionsResponse.ok) {
                throw new Error('获取验证选项失败');
            }
            
            // 2. 解析验证选项
            const options = await optionsResponse.json();
            
            // 3. 启动验证过程
            const authenticationResponse = await startAuthentication(options);
            
            // 4. 将验证结果发送到服务器验证
            const verificationResponse = await fetch('/admin/api/passkey/verify-authentication', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(authenticationResponse)
            });
            
            const verificationResult = await verificationResponse.json();
            
            if (verificationResponse.ok && verificationResult.verified) {
                // 登录成功
                successElement.textContent = 'Passkey验证成功，正在跳转...';
                successElement.style.display = 'block';
                window.location.href = '/admin/dashboard.html';
            } else {
                // 验证失败
                errorElement.textContent = verificationResult.error || 'Passkey验证失败';
                errorElement.style.display = 'block';
            }
        } catch (error) {
            console.error('Passkey登录错误:', error);
            errorElement.textContent = `Passkey登录失败: ${error.message || '未知错误'}`;
            errorElement.style.display = 'block';
        } finally {
            // 重新启用按钮
            passkeyButton.disabled = false;
            passkeyButton.innerHTML = '<i class="bi bi-shield-lock"></i> 使用Passkey登录';
        }
    });
} 