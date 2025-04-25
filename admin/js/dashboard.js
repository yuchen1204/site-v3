document.addEventListener('DOMContentLoaded', function() {
    initializeLogout();
    initializeAdminSidebar();
});

/**
 * 初始化退出登录按钮
 */
function initializeLogout() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/admin/logout', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    window.location.href = '/admin/'; // 跳转回登录页
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
}

/**
 * 初始化后台侧边栏功能
 */
function initializeAdminSidebar() {
    const sidebarToggleButton = document.getElementById('admin-sidebar-toggle');
    const body = document.body;
    const sidebarLinks = document.querySelectorAll('.admin-sidebar-link');
    const sections = document.querySelectorAll('.admin-section');

    // 侧边栏切换按钮事件
    if (sidebarToggleButton && body) {
        sidebarToggleButton.addEventListener('click', () => {
            body.classList.toggle('admin-sidebar-open');
            // (可选) 保存侧边栏状态
            localStorage.setItem('adminSidebarState', body.classList.contains('admin-sidebar-open') ? 'open' : 'closed');
        });

        // (可选) 恢复侧边栏状态
        const savedSidebarState = localStorage.getItem('adminSidebarState');
        if (savedSidebarState === 'open') {
            body.classList.add('admin-sidebar-open');
        }
    }

    // 侧边栏链接点击事件 - 切换内容区域
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            // 移除所有链接的 active 状态
            sidebarLinks.forEach(l => l.classList.remove('active'));
            // 添加当前链接的 active 状态
            this.classList.add('active');

            const targetSectionId = this.getAttribute('data-section');
            
            // 隐藏所有内容区域
            sections.forEach(section => section.classList.remove('active'));

            // 显示目标内容区域
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            } else {
                console.warn(`未找到目标区域: ${targetSectionId}`);
            }
        });
    });

    // 初始加载时激活默认或哈希指定的区域 (可选)
    // ... (可以根据需要添加这部分逻辑)
}

// 未来在这里添加 Dashboard 相关的功能
// 例如加载数据、处理表单提交等 