// 确保SimpleWebAuthn库加载完成
function ensureSimpleWebAuthnLoaded() {
    return new Promise((resolve, reject) => {
        // 如果已经加载，直接返回
        if (window.SimpleWebAuthn) {
            resolve(window.SimpleWebAuthn);
            return;
        }

        // 检查库是否正在加载
        let scriptExists = false;
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            if (script.src.includes('@simplewebauthn/browser')) {
                scriptExists = true;
                break;
            }
        }

        // 如果脚本标签不存在，添加脚本
        if (!scriptExists) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js';
            script.async = true;

            script.onload = () => {
                if (window.SimpleWebAuthn) {
                    resolve(window.SimpleWebAuthn);
                } else {
                    reject(new Error('SimpleWebAuthn加载成功但未定义'));
                }
            };

            script.onerror = () => {
                reject(new Error('无法加载SimpleWebAuthn库'));
            };

            document.head.appendChild(script);
        } else {
            // 如果脚本存在但还未加载完成，轮询等待
            let attempts = 0;
            const maxAttempts = 20; // 最多等待10秒(20次，每次500ms)
            
            const checkLoaded = () => {
                if (window.SimpleWebAuthn) {
                    resolve(window.SimpleWebAuthn);
                    return;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('SimpleWebAuthn库加载超时'));
                    return;
                }
                
                setTimeout(checkLoaded, 500);
            };
            
            checkLoaded();
        }
    });
}

// 等待库加载完成后初始化
ensureSimpleWebAuthnLoaded()
    .then(SimpleWebAuthn => {
        // 保存全局引用
        window.safeSimpleWebAuthn = SimpleWebAuthn;
        // 从SimpleWebAuthn获取浏览器API
        const { startAuthentication } = SimpleWebAuthn.browserSupport;
        
        // 存储以供后续使用
        window.safeStartAuthentication = startAuthentication;
        
        // 初始化页面
        initializeLoginPage();
    })
    .catch(error => {
        console.error('SimpleWebAuthn库加载失败:', error);
        // 隐藏Passkey选项，只显示密码登录
        const passkeyTab = document.getElementById('passkey-tab');
        if (passkeyTab) {
            passkeyTab.style.display = 'none';
        }
        
        // 确保密码登录选项卡是激活的
        const passwordTab = document.getElementById('password-tab');
        const passwordLogin = document.getElementById('password-login');
        if (passwordTab && passwordLogin) {
            passwordTab.classList.add('active');
            passwordLogin.classList.add('show', 'active');
        }
        
        // 只初始化密码登录部分
        initPasswordLogin();
    });

/**
 * 初始化登录页面的所有功能
 */
function initializeLoginPage() {
    // 检查浏览器是否支持WebAuthn/Passkey
    checkWebAuthnSupport();
    
    // 初始化常规登录
    initPasswordLogin();
    
    // 初始化Passkey登录
    initPasskeyLogin();
}

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
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(event) {
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
            // 使用安全存储的函数
            const startAuthentication = window.safeStartAuthentication;
            if (!startAuthentication) {
                throw new Error('Passkey功能未正确加载，请刷新页面重试');
            }
            
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