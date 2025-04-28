// WebAuthn API 实例化
const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

// 页面加载时的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化传统登录表单
    initializePasswordLogin();
    
    // 初始化Passkey登录
    initializePasskeyLogin();
    
    // 检查是否支持WebAuthn
    checkWebAuthnSupport();
});

/**
 * 初始化传统用户名/密码登录
 */
function initializePasswordLogin() {
    document.getElementById('login-form').addEventListener('submit', async function(event) {
        event.preventDefault();
    
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
                // 登录成功，显示Passkey管理区域
                const passkeyManagement = document.getElementById('passkey-management');
                passkeyManagement.style.display = 'block';
                
                // 然后跳转到dashboard
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
            submitButton.textContent = '密码登录';
        }
    });
}

/**
 * 初始化Passkey登录功能
 */
function initializePasskeyLogin() {
    // Passkey登录按钮
    const passkeyLoginButton = document.getElementById('passkey-login-button');
    passkeyLoginButton.addEventListener('click', handlePasskeyLogin);
    
    // 注册新Passkey按钮
    const registerPasskeyButton = document.getElementById('register-passkey-button');
    registerPasskeyButton.addEventListener('click', handlePasskeyRegistration);
}

/**
 * 检查浏览器是否支持WebAuthn
 */
function checkWebAuthnSupport() {
    const passkeyLoginButton = document.getElementById('passkey-login-button');
    const passkeyStatus = document.getElementById('passkey-status');
    
    if (!window.PublicKeyCredential) {
        passkeyLoginButton.disabled = true;
        passkeyLoginButton.title = '您的浏览器不支持Passkey';
        passkeyLoginButton.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>不支持Passkey';
        passkeyStatus.textContent = '您的浏览器不支持Passkey功能';
        return false;
    }
    
    return true;
}

/**
 * 处理Passkey登录请求
 */
async function handlePasskeyLogin() {
    if (!checkWebAuthnSupport()) return;
    
    const passkeyLoginButton = document.getElementById('passkey-login-button');
    const errorElement = document.getElementById('login-error');
    
    // 重置错误信息并禁用按钮
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    passkeyLoginButton.disabled = true;
    
    // 更改按钮文本
    const originalButtonText = passkeyLoginButton.innerHTML;
    passkeyLoginButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>验证中...';
    
    try {
        // 1. 从服务器获取身份验证选项
        const optionsResponse = await fetch('/admin/api/passkey/authenticate');
        
        if (!optionsResponse.ok) {
            const errorData = await optionsResponse.json();
            // 如果是404错误，说明没有已注册的设备
            if (optionsResponse.status === 404) {
                // 显示注册Passkey的选项
                document.getElementById('passkey-management').style.display = 'block';
                document.getElementById('passkey-status').textContent = '您还没有注册Passkey设备，请先使用密码登录后注册。';
                throw new Error(errorData.error || '未找到已注册的Passkey设备');
            }
            throw new Error(errorData.error || '获取身份验证选项失败');
        }
        
        // 2. 获取服务器返回的选项
        const options = await optionsResponse.json();
        
        // 3. 开始身份验证过程
        const authenticationResponse = await startAuthentication(options);
        
        // 4. 将身份验证响应发送到服务器进行验证
        const verificationResponse = await fetch('/admin/api/passkey/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                authenticationResponse,
            }),
        });
        
        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || '身份验证失败');
        }
        
        // 5. 身份验证成功，跳转到dashboard
        window.location.href = '/admin/dashboard.html';
        
    } catch (error) {
        console.error('Passkey登录失败:', error);
        
        // 显示错误信息
        errorElement.textContent = error.message || 'Passkey登录失败';
        errorElement.style.display = 'block';
    } finally {
        // 恢复按钮状态
        passkeyLoginButton.disabled = false;
        passkeyLoginButton.innerHTML = originalButtonText;
    }
}

/**
 * 处理Passkey注册请求
 * 注意：用户必须先通过密码登录
 */
async function handlePasskeyRegistration() {
    if (!checkWebAuthnSupport()) return;
    
    const registerButton = document.getElementById('register-passkey-button');
    const passkeyStatus = document.getElementById('passkey-status');
    
    // 禁用按钮并显示加载状态
    registerButton.disabled = true;
    const originalButtonText = registerButton.innerHTML;
    registerButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>注册中...';
    
    try {
        // 1. 从服务器获取注册选项
        const optionsResponse = await fetch('/admin/api/passkey/register');
        
        if (!optionsResponse.ok) {
            const errorData = await optionsResponse.json();
            throw new Error(errorData.error || '获取注册选项失败');
        }
        
        // 2. 获取服务器返回的选项
        const options = await optionsResponse.json();
        
        // 3. 开始注册过程
        const registrationResponse = await startRegistration(options);
        
        // 4. 将注册响应发送到服务器进行验证
        const verificationResponse = await fetch('/admin/api/passkey/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                registrationResponse,
            }),
        });
        
        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || '注册验证失败');
        }
        
        // 5. 注册成功，更新状态
        passkeyStatus.textContent = 'Passkey已成功注册！现在您可以使用Passkey进行登录。';
        passkeyStatus.style.color = '#198754'; // Bootstrap success color
        
    } catch (error) {
        console.error('Passkey注册失败:', error);
        
        // 显示错误信息
        passkeyStatus.textContent = error.message || 'Passkey注册失败';
        passkeyStatus.style.color = '#dc3545'; // Bootstrap danger color
    } finally {
        // 恢复按钮状态
        registerButton.disabled = false;
        registerButton.innerHTML = originalButtonText;
    }
} 