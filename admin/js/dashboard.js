document.addEventListener('DOMContentLoaded', function() {
    initializeLogout();
    initializeAdminSidebar();
    initializeProfileEditor(); // 初始化个人资料编辑器
    initializeBlogEditor();    // 初始化博客编辑器
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

/**
 * 初始化博客编辑器功能
 */
function initializeBlogEditor() {
    const addNewBlogButton = document.getElementById('add-new-blog-button');
    const blogEditModalElement = document.getElementById('blog-edit-modal');
    const blogEditForm = document.getElementById('blog-edit-form');
    const saveBlogButton = document.getElementById('save-blog-button');
    const blogTableBody = document.getElementById('blog-table-body');

    // 添加检查：确保模态框元素存在
    if (!blogEditModalElement) {
        console.error("错误：无法在 DOM 中找到博客编辑模态框元素 #blog-edit-modal。");
        return; // 如果元素不存在，则停止初始化
    }

    // 在确认元素存在后再初始化模态框
    let blogEditModal = null;
    try {
        console.log("尝试在元素上初始化 Bootstrap Modal:", blogEditModalElement);
        blogEditModal = new bootstrap.Modal(blogEditModalElement);
        console.log("Bootstrap Modal 初始化成功。");
    } catch (error) {
        console.error("初始化 Bootstrap Modal 时出错:", error);
        // 如果初始化失败，后续依赖 modal 的操作可能也需要停止，这里先返回
        return; 
    }

    // 监听侧边栏链接点击，当切换到博客编辑时加载数据
    document.querySelectorAll('.admin-sidebar-link').forEach(link => {
        link.addEventListener('click', function() {
            const targetSectionId = this.getAttribute('data-section');
            if (targetSectionId === 'edit-blog') {
                loadBlogPosts();
            }
        });
    });

    // 如果初始激活的就是博客编辑区域，则加载数据
    const initialActiveSection = document.querySelector('.admin-section.active');
    if (initialActiveSection && initialActiveSection.id === 'edit-blog') {
        loadBlogPosts();
    }

    // "添加新文章"按钮点击事件
    if (addNewBlogButton && blogEditModal) {
        addNewBlogButton.addEventListener('click', () => {
            resetBlogEditForm();
            document.getElementById('blogEditModalLabel').textContent = '添加新文章';
            blogEditModal.show();
        });
    }

    // 保存按钮点击事件
    if (saveBlogButton) {
        saveBlogButton.addEventListener('click', async () => {
            await saveBlogPost();
        });
    }

    // 为表格添加事件委托，处理编辑和删除按钮点击
    if (blogTableBody && blogEditModal) {
        blogTableBody.addEventListener('click', async (event) => {
            const target = event.target;
            const editButton = target.closest('.edit-blog-button');
            const deleteButton = target.closest('.delete-blog-button');

            if (editButton) {
                const postId = editButton.getAttribute('data-id');
                await loadBlogPostForEditing(postId);
                // 再次检查以防万一
                if (blogEditModal) { 
                    blogEditModal.show(); 
                } else {
                     console.error("无法显示模态框，因为它未能成功初始化。");
                }
            } else if (deleteButton) {
                const postId = deleteButton.getAttribute('data-id');
                const postTitle = deleteButton.getAttribute('data-title') || '该文章';
                if (confirm(`确定要删除文章 " ${postTitle} " 吗？此操作无法撤销。`)) {
                    await deleteBlogPost(postId);
                }
            }
        });
    }
}

/**
 * 加载博客文章列表到表格中
 */
async function loadBlogPosts() {
    const tableBody = document.getElementById('blog-table-body');
    const categoryDatalist = document.getElementById('category-datalist');
    if (!tableBody || !categoryDatalist) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">加载中...</td></tr>';
    categoryDatalist.innerHTML = ''; // 清空分类列表

    try {
        const response = await fetch('/admin/api/blog');
        if (!response.ok) {
            if (response.status === 401) {
                // 未授权，可能 session 过期
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">会话已过期或未登录，请重新登录。</td></tr>';
                alert('会话已过期或未登录，请重新登录。');
                window.location.href = '/admin/'; // 跳转到登录页
                return;
            }
            throw new Error(`获取文章列表失败: ${response.statusText}`);
        }
        const posts = await response.json();

        if (!Array.isArray(posts)) {
           throw new Error('服务器返回的数据格式不正确');
        }

        tableBody.innerHTML = ''; // 清空加载提示
        const categories = new Set();

        if (posts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">还没有博客文章。</td></tr>';
        } else {
            posts.forEach(post => {
                const row = tableBody.insertRow();
                // 格式化日期，如果日期无效则显示提示
                let formattedDate = '日期无效';
                if (post.date) {
                    try {
                        formattedDate = new Date(post.date).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                    } catch (e) {
                        console.warn(`无法格式化日期 "${post.date}"：`, e);
                    }
                }
                row.innerHTML = `
                    <td>${escapeHtml(post.title || '')}</td>
                    <td>${escapeHtml(post.category || '')}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1 edit-blog-button" data-id="${post.id}">
                            <i class="bi bi-pencil-fill"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-blog-button" data-id="${post.id}" data-title="${escapeHtml(post.title || '')}">
                            <i class="bi bi-trash-fill"></i> 删除
                        </button>
                    </td>
                `;
                if (post.category) {
                    categories.add(post.category);
                }
            });
        }

        // 填充分类 datalist
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            categoryDatalist.appendChild(option);
        });

    } catch (error) {
        console.error('加载博客文章失败:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">加载文章失败: ${error.message}</td></tr>`;
    }
}

/**
 * 重置博客编辑表单
 */
function resetBlogEditForm() {
    const form = document.getElementById('blog-edit-form');
    const statusSpan = document.getElementById('blog-save-status');
    if (form) {
        form.reset();
        document.getElementById('blog-edit-id').value = ''; // 清空隐藏的 ID 字段
    }
    if (statusSpan) {
        statusSpan.textContent = '';
    }
    // 清除可能的验证状态（如果使用了 Bootstrap 验证）
    form.classList.remove('was-validated');
}

/**
 * 加载单篇博客文章到编辑模态框
 * @param {string|number} postId 文章 ID
 */
async function loadBlogPostForEditing(postId) {
    resetBlogEditForm();
    document.getElementById('blogEditModalLabel').textContent = '编辑文章';
    const statusSpan = document.getElementById('blog-save-status');
    statusSpan.textContent = '加载文章数据中...';

    try {
        const response = await fetch(`/admin/api/blog/${postId}`);
        if (!response.ok) {
             if (response.status === 401) {
                alert('会话已过期或未登录，请重新登录。');
                window.location.href = '/admin/';
                return;
            }
            throw new Error(`获取文章失败: ${response.statusText}`);
        }
        const post = await response.json();

        document.getElementById('blog-edit-id').value = post.id;
        document.getElementById('blog-edit-title').value = post.title || '';
        document.getElementById('blog-edit-category').value = post.category || '';
        document.getElementById('blog-edit-content').value = post.content || '';
        // 附件和引用的加载逻辑（如果实现的话）

        statusSpan.textContent = '数据已加载';
        setTimeout(() => { statusSpan.textContent = ''; }, 2000);

    } catch (error) {
        console.error(`加载文章 ${postId} 失败:`, error);
        statusSpan.textContent = `加载失败: ${error.message}`;
        alert(`加载文章数据失败: ${error.message}`);
        // 可能需要关闭模态框或禁用表单
        const blogEditModal = bootstrap.Modal.getInstance(document.getElementById('blog-edit-modal'));
        if (blogEditModal) blogEditModal.hide();
    }
}

/**
 * 保存博客文章（创建或更新）
 */
async function saveBlogPost() {
    const form = document.getElementById('blog-edit-form');
    const postId = document.getElementById('blog-edit-id').value;
    const title = document.getElementById('blog-edit-title').value.trim();
    const category = document.getElementById('blog-edit-category').value.trim();
    const content = document.getElementById('blog-edit-content').value.trim();
    const statusSpan = document.getElementById('blog-save-status');
    const saveButton = document.getElementById('save-blog-button');

    // 简单的客户端验证
    if (!title || !category) {
        alert('标题和分类不能为空！');
        // 可以添加更友好的验证提示，例如高亮字段
        form.classList.add('was-validated'); // 触发 Bootstrap 验证样式 (如果使用了 required)
        return;
    }

    statusSpan.textContent = '保存中...';
    saveButton.disabled = true;

    const postData = {
        title: title,
        category: category,
        content: content,
        // 在创建新文章时，服务器应生成日期；更新时可能保留原日期或更新
        // date: new Date().toISOString(), // 客户端生成日期可能不准确，最好由服务器处理
        // attachments: [], // 附件保存逻辑
        // references: []  // 引用保存逻辑
    };

    const isEditing = !!postId;
    const url = isEditing ? `/admin/api/blog/${postId}` : '/admin/api/blog';
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
             if (response.status === 401) {
                alert('会话已过期或未登录，请重新登录。');
                window.location.href = '/admin/';
                return;
            }
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`保存失败: ${errorData.error || response.statusText}`);
        }

        statusSpan.textContent = '保存成功！';
        await loadBlogPosts(); // 刷新列表
        setTimeout(() => {
            const blogEditModal = bootstrap.Modal.getInstance(document.getElementById('blog-edit-modal'));
            if (blogEditModal) blogEditModal.hide();
            resetBlogEditForm(); // 确保下次打开是干净的
        }, 1000); // 延迟关闭，让用户看到成功消息

    } catch (error) {
        console.error('保存博客文章失败:', error);
        statusSpan.textContent = `保存失败: ${error.message}`;
        alert(`保存失败: ${error.message}`);
    } finally {
        saveButton.disabled = false;
    }
}

/**
 * 删除博客文章
 * @param {string|number} postId 文章 ID
 */
async function deleteBlogPost(postId) {
    try {
        const response = await fetch(`/admin/api/blog/${postId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
             if (response.status === 401) {
                alert('会话已过期或未登录，请重新登录。');
                window.location.href = '/admin/';
                return;
            }
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
             throw new Error(`删除失败: ${errorData.error || response.statusText}`);
        }

        alert('文章删除成功！');
        await loadBlogPosts(); // 刷新列表

    } catch (error) {
        console.error(`删除文章 ${postId} 失败:`, error);
        alert(`删除失败: ${error.message}`);
    }
}

/**
 * 简单的 HTML 转义函数，防止 XSS
 * @param {string} str 输入字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 未来在这里添加 Dashboard 相关的功能
// 例如加载数据、处理表单提交等 