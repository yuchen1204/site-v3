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