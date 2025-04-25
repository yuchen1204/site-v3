document.addEventListener('DOMContentLoaded', function() {
    initializeLogout();
    initializeAdminSidebar();
    initializeProfileEditor(); // 初始化个人资料编辑器
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
                // 如果是编辑个人资料区域，加载数据
                if (targetSectionId === 'edit-profile') {
                    loadProfileDataForEditing();
                }
            } else {
                console.warn(`未找到目标区域: ${targetSectionId}`);
            }

            // (可选) 在小屏幕上点击链接后自动关闭侧边栏
            if (window.innerWidth < 992) { 
                closeSidebar();
            }
        });
    });

    // 初始加载检查，如果默认显示的是编辑个人资料区域
    const initialActiveSection = document.querySelector('.admin-section.active');
    if (initialActiveSection && initialActiveSection.id === 'edit-profile') {
        loadProfileDataForEditing();
    }
}

/**
 * 初始化个人资料编辑器功能
 */
function initializeProfileEditor() {
    const profileForm = document.getElementById('profile-form');
    const addSocialLinkButton = document.getElementById('add-social-link-button');
    const socialLinksEditor = document.getElementById('social-links-editor');

    if (!profileForm || !addSocialLinkButton || !socialLinksEditor) return;

    // 添加社交链接按钮事件
    addSocialLinkButton.addEventListener('click', () => {
        addSocialLinkInputGroup(socialLinksEditor);
    });

    // 表单提交事件
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfileData();
    });
}

/**
 * 加载个人资料数据到编辑器
 */
async function loadProfileDataForEditing() {
    const nameInput = document.getElementById('profile-name');
    const avatarInput = document.getElementById('profile-avatar');
    const mottoInput = document.getElementById('profile-motto');
    const socialLinksEditor = document.getElementById('social-links-editor');
    const statusSpan = document.getElementById('profile-save-status');

    if (!nameInput || !avatarInput || !mottoInput || !socialLinksEditor || !statusSpan) return;

    statusSpan.textContent = '加载中...';
    socialLinksEditor.innerHTML = ''; // 清空旧的社交链接

    try {
        const response = await fetch('/admin/api/profile'); // 使用 GET 请求
        if (!response.ok) {
            throw new Error(`获取数据失败: ${response.statusText}`);
        }
        const data = await response.json();

        nameInput.value = data.name || '';
        avatarInput.value = data.avatar || '';
        mottoInput.value = data.motto || '';

        // 填充社交链接
        if (data.socialLinks && Array.isArray(data.socialLinks)) {
            data.socialLinks.forEach(link => {
                addSocialLinkInputGroup(socialLinksEditor, link.platform, link.url, link.icon);
            });
        }
        statusSpan.textContent = '数据已加载';
        setTimeout(() => { statusSpan.textContent = ''; }, 2000);

    } catch (error) {
        console.error('加载个人资料编辑数据失败:', error);
        statusSpan.textContent = `加载失败: ${error.message}`;
    }
}

/**
 * 添加一个社交链接输入组到编辑器
 * @param {HTMLElement} container - 社交链接编辑器的容器元素
 * @param {string} [platform=''] - 平台名称
 * @param {string} [url=''] - 链接 URL
 * @param {string} [icon=''] - 图标 URL
 */
function addSocialLinkInputGroup(container, platform = '', url = '', icon = '') {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group mb-2 social-link-group';
    inputGroup.innerHTML = `
        <input type="text" class="form-control social-link-platform" placeholder="平台名称 (例如 GitHub)" value="${platform}" required>
        <input type="url" class="form-control social-link-url" placeholder="链接 URL (https://...)" value="${url}" required>
        <input type="url" class="form-control social-link-icon" placeholder="图标 URL (可选)" value="${icon}">
        <button class="btn btn-outline-danger remove-social-link-button" type="button">
            <i class="bi bi-trash"></i>
        </button>
    `;

    // 添加移除按钮的事件监听器
    inputGroup.querySelector('.remove-social-link-button').addEventListener('click', function() {
        inputGroup.remove();
    });

    container.appendChild(inputGroup);
}

/**
 * 保存个人资料数据
 */
async function saveProfileData() {
    const nameInput = document.getElementById('profile-name');
    const avatarInput = document.getElementById('profile-avatar');
    const mottoInput = document.getElementById('profile-motto');
    const socialLinkGroups = document.querySelectorAll('#social-links-editor .social-link-group');
    const statusSpan = document.getElementById('profile-save-status');
    const submitButton = document.querySelector('#profile-form button[type="submit"]');

    if (!nameInput || !avatarInput || !mottoInput || !statusSpan || !submitButton) return;

    statusSpan.textContent = '保存中...';
    submitButton.disabled = true;

    // 收集社交链接数据
    const socialLinks = [];
    socialLinkGroups.forEach(group => {
        const platformInput = group.querySelector('.social-link-platform');
        const urlInput = group.querySelector('.social-link-url');
        const iconInput = group.querySelector('.social-link-icon');
        
        // 确保平台和 URL 不为空
        if (platformInput && urlInput && platformInput.value.trim() && urlInput.value.trim()) {
             socialLinks.push({
                platform: platformInput.value.trim(),
                url: urlInput.value.trim(),
                icon: iconInput ? iconInput.value.trim() : ''
            });
        }
    });

    const updatedProfile = {
        name: nameInput.value.trim(),
        avatar: avatarInput.value.trim(),
        motto: mottoInput.value.trim(),
        socialLinks: socialLinks
    };

    try {
        const response = await fetch('/admin/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedProfile)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `保存失败: ${response.statusText}`);
        }

        const result = await response.json();
        statusSpan.textContent = result.message || '保存成功！';
        statusSpan.classList.remove('text-danger');
        statusSpan.classList.add('text-success');

    } catch (error) {
        console.error('保存个人资料失败:', error);
        statusSpan.textContent = `保存失败: ${error.message}`;
        statusSpan.classList.remove('text-success');
        statusSpan.classList.add('text-danger');
    } finally {
        submitButton.disabled = false;
        // 短暂显示状态后清除
        setTimeout(() => {
            statusSpan.textContent = '';
            statusSpan.classList.remove('text-success', 'text-danger');
        }, 3000);
    }
}

// 未来在这里添加 Dashboard 相关的功能
// 例如加载数据、处理表单提交等 