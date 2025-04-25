document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logout-button');

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/admin/logout', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    // 退出成功，跳转回登录页
                    window.location.href = '/admin/';
                } else {
                    console.error('退出登录失败');
                    alert('退出登录失败，请稍后重试');
                }
            } catch (error) {
                console.error('退出登录请求失败:', error);
                alert('退出登录请求失败，请检查网络连接');
            }
        });
    }

    // 未来在这里添加 Dashboard 相关的功能
    // 例如加载数据、处理表单提交等
}); 