const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

const usernameInput = document.getElementById('username');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const errorElement = document.getElementById('login-error');
const passkeyMessageElement = document.getElementById('passkey-message');
const registerPasskeyButton = document.getElementById('register-passkey-button');
const loginPasskeyButton = document.getElementById('login-passkey-button');

// --- Helper Functions ---

/**
 * 显示消息
 * @param {string} message 消息内容
 * @param {'error' | 'info' | 'success'} type 消息类型
 */
function showMessage(message, type = 'info') {
    const element = (type === 'error') ? errorElement : passkeyMessageElement;
    const textClass = (type === 'error') ? 'text-danger' : (type === 'success' ? 'text-success' : 'text-info');
    
    // 清除之前的样式
    element.classList.remove('text-danger', 'text-success', 'text-info');
    
    // 设置新消息和样式
    element.textContent = message;
    element.classList.add(textClass);
    element.style.display = 'block';

    // 如果是错误消息，也清除 passkey 消息区域
    if (type === 'error' && element !== passkeyMessageElement) {
        passkeyMessageElement.textContent = '';
        passkeyMessageElement.style.display = 'none';
    } else if (type !== 'error' && element !== errorElement) {
        // 如果是非错误消息，清除登录错误区域
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

/**
 * 清除所有消息
 */
function clearMessages() {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    passkeyMessageElement.textContent = '';
    passkeyMessageElement.style.display = 'none';
}

// --- Passkey Registration ---

registerPasskeyButton.addEventListener('click', async () => {
    clearMessages();
    const username = usernameInput.value;

    if (!username) {
        showMessage('请输入用户名以注册 Passkey。', 'error');
        usernameInput.focus();
        return;
    }

    showMessage('正在请求注册选项...', 'info');
    registerPasskeyButton.disabled = true;
    loginPasskeyButton.disabled = true;

    try {
        // 1. 从服务器获取注册选项
        const optionsResponse = await fetch('/admin/passkey/register-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!optionsResponse.ok) {
            const errorData = await optionsResponse.json();
            throw new Error(errorData.error || '获取注册选项失败');
        }

        const options = await optionsResponse.json();

        // 2. 使用浏览器 API 开始注册
        showMessage('请按照浏览器提示创建 Passkey...', 'info');
        const registrationResult = await startRegistration(options);

        // 3. 将注册结果发送到服务器进行验证
        showMessage('正在验证 Passkey...', 'info');
        const verificationResponse = await fetch('/admin/passkey/register-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, data: registrationResult }),
        });

        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || 'Passkey 验证失败');
        }

        const verificationResult = await verificationResponse.json();

        if (verificationResult.verified) {
            showMessage('Passkey 注册成功！现在可以使用 Passkey 登录。', 'success');
        } else {
            throw new Error('Passkey 验证未通过');
        }

    } catch (error) {
        console.error('Passkey 注册失败:', error);
        const errorMessage = error.message || 'Passkey 注册过程中发生错误。';
        // 检查是否是用户取消操作
        if (error.name === 'NotAllowedError' || errorMessage.includes('cancel')) {
             showMessage('Passkey 注册已取消。', 'info');
        } else {
             showMessage(`Passkey 注册失败: ${errorMessage}`, 'error');
        }
    } finally {
        registerPasskeyButton.disabled = false;
        loginPasskeyButton.disabled = false;
    }
});

// --- Passkey Login ---

loginPasskeyButton.addEventListener('click', async () => {
    clearMessages();
    const username = usernameInput.value;

    // 注意：通常Passkey登录不需要预先输入用户名，
    // 因为浏览器/操作系统会显示可用的Passkey列表让用户选择。
    // 但为了简化流程，并与服务器交互，我们暂时保留用户名输入。
    // 也可以先调用 options 端点（不带用户名），让服务器返回允许的凭证ID，
    // 或者完全依赖浏览器的 discoverable credentials (resident keys)。
    // 这里我们先要求输入用户名。
    if (!username) {
        showMessage('请输入用户名以使用 Passkey 登录。', 'error');
        usernameInput.focus();
        return;
    }

    showMessage('正在请求登录选项...', 'info');
    registerPasskeyButton.disabled = true;
    loginPasskeyButton.disabled = true;

    try {
        // 1. 从服务器获取认证选项
        const optionsResponse = await fetch('/admin/passkey/login-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!optionsResponse.ok) {
            const errorData = await optionsResponse.json();
            // 如果是因为用户没有注册Passkey
            if(optionsResponse.status === 404 && errorData.error.includes('未找到')) {
                 showMessage('此用户尚未注册 Passkey，请先注册。', 'error');
                 return; // 停在这里
            }
            throw new Error(errorData.error || '获取登录选项失败');
        }

        const options = await optionsResponse.json();

        // 2. 使用浏览器 API 开始认证
        showMessage('请按照浏览器提示进行 Passkey 验证...', 'info');
        const authenticationResult = await startAuthentication(options);

        // 3. 将认证结果发送到服务器进行验证
        showMessage('正在验证身份...', 'info');
        const verificationResponse = await fetch('/admin/passkey/login-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, data: authenticationResult }),
        });

        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || 'Passkey 登录验证失败');
        }

        const verificationResult = await verificationResponse.json();

        if (verificationResult.verified) {
            showMessage('Passkey 登录成功！正在跳转...', 'success');
            // 登录成功，跳转到 dashboard (服务器在验证成功后应已设置好 session cookie)
            window.location.href = '/admin/dashboard.html';
        } else {
            throw new Error('Passkey 登录验证未通过');
        }

    } catch (error) {
        console.error('Passkey 登录失败:', error);
        const errorMessage = error.message || 'Passkey 登录过程中发生错误。';
         // 检查是否是用户取消操作
        if (error.name === 'NotAllowedError' || errorMessage.includes('cancel')) {
             showMessage('Passkey 登录已取消。', 'info');
        } else {
             showMessage(`Passkey 登录失败: ${errorMessage}`, 'error');
        }
    } finally {
        registerPasskeyButton.disabled = false;
        loginPasskeyButton.disabled = false;
    }
});


// --- Existing Password Login Logic ---
document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // 阻止表单默认提交行为
    clearMessages();

    // const usernameInput = document.getElementById('username'); // 已在顶部获取
    // const passwordInput = document.getElementById('password'); // 已在顶部获取
    // const errorElement = document.getElementById('login-error'); // 已在顶部获取
    const submitButton = this.querySelector('button[type="submit"]');

    const username = usernameInput.value;
    const password = passwordInput.value;

    // 重置错误信息并禁用按钮
    // errorElement.textContent = '';
    // errorElement.style.display = 'none';
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
            // errorElement.textContent = errorData.error || '用户名或密码错误';
            // errorElement.style.display = 'block';
            showMessage(errorData.error || '用户名或密码错误', 'error');
        }
    } catch (error) {
        console.error('登录请求失败:', error);
        // errorElement.textContent = '登录请求失败，请检查网络连接。';
        // errorElement.style.display = 'block';
        showMessage('登录请求失败，请检查网络连接。', 'error');
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
        submitButton.textContent = '登录';
    }
}); 