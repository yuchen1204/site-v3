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
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    const body = document.body;
    const sidebarLinks = document.querySelectorAll('.admin-sidebar-link');
    const sections = document.querySelectorAll('.admin-section');

    const toggleButtonIcon = sidebarToggleButton ? sidebarToggleButton.querySelector('i') : null;
    const openIconClass = 'bi-list';
    const closeIconClass = 'bi-x-lg'; // 使用更大的关闭图标

    function openSidebar() {
        body.classList.add('admin-sidebar-open');
        if (toggleButtonIcon) toggleButtonIcon.className = `bi ${closeIconClass}`;
        localStorage.setItem('adminSidebarState', 'open');
    }

    function closeSidebar() {
        body.classList.remove('admin-sidebar-open');
        if (toggleButtonIcon) toggleButtonIcon.className = `bi ${openIconClass}`;
        localStorage.setItem('adminSidebarState', 'closed');
    }

    // 侧边栏切换按钮事件
    if (sidebarToggleButton && body) {
        sidebarToggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止事件冒泡到 backdrop
            if (body.classList.contains('admin-sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        // (可选) 恢复侧边栏状态
        const savedSidebarState = localStorage.getItem('adminSidebarState');
        if (savedSidebarState === 'open') {
            openSidebar(); // 使用函数来确保图标也正确设置
        } else {
             if (toggleButtonIcon) toggleButtonIcon.className = `bi ${openIconClass}`; // 设置初始图标
        }
    }

    // 点击遮罩层关闭侧边栏
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeSidebar();
        });
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

            // (可选) 在小屏幕上点击链接后自动关闭侧边栏
            if (window.innerWidth < 992) { 
                closeSidebar();
            }
        });
    });

    // 初始加载时激活默认或哈希指定的区域 (可选)
    // ... (可以根据需要添加这部分逻辑)
}

// 未来在这里添加 Dashboard 相关的功能
// 例如加载数据、处理表单提交等 