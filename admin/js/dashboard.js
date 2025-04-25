document.addEventListener('DOMContentLoaded', function() {
    initializeLogout();
    initializeAdminSidebar();
    initializeProfileEditor(); // 初始化个人资料编辑器
    initializeBlogEditor(); // 初始化博客编辑器
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
                // 根据区域加载数据
                if (targetSectionId === 'edit-profile') {
                    loadProfileDataForEditing();
                } else if (targetSectionId === 'edit-blog') {
                    loadBlogPostsForEditing(); // 加载博客列表
                }
            } else {
                console.warn(`未找到目标区域: ${targetSectionId}`);
            }

            // (可选) 在小屏幕上点击链接后自动关闭侧边栏
             if (window.innerWidth < 992 && document.body.classList.contains('admin-sidebar-open')) {
                 document.getElementById('admin-sidebar-toggle').click(); // 模拟点击关闭
             }
        });
    });

    // 初始加载检查，如果默认显示的是编辑个人资料区域
    const initialActiveSection = document.querySelector('.admin-section.active');
    if (initialActiveSection) {
        if (initialActiveSection.id === 'edit-profile') {
            loadProfileDataForEditing();
        } else if (initialActiveSection.id === 'edit-blog') {
             loadBlogPostsForEditing();
        }
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

// --- 博客编辑功能 ---

let blogEditorModalInstance = null; // 存储 Modal 实例

/**
 * 初始化博客编辑器相关功能
 */
function initializeBlogEditor() {
    const addNewPostButton = document.getElementById('add-new-post-button');
    const blogEditorForm = document.getElementById('blog-editor-form');
    const addAttachmentButton = document.getElementById('add-blog-attachment-button');
    const addReferenceButton = document.getElementById('add-blog-reference-button');
    const blogEditorModalElement = document.getElementById('blog-editor-modal');

    if (!addNewPostButton || !blogEditorForm || !addAttachmentButton || !addReferenceButton || !blogEditorModalElement) return;

    // 初始化 Modal 实例
    blogEditorModalInstance = new bootstrap.Modal(blogEditorModalElement);

    // "新建文章" 按钮事件
    addNewPostButton.addEventListener('click', () => {
        openBlogEditor(); // 打开空编辑器
    });

    // 编辑器表单提交事件
    blogEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBlogPost();
    });

    // 添加附件按钮事件
    addAttachmentButton.addEventListener('click', () => {
        addAttachmentInputGroup(document.getElementById('blog-attachments-editor'));
    });

    // 添加参考文献按钮事件
    addReferenceButton.addEventListener('click', () => {
        addReferenceInputGroup(document.getElementById('blog-references-editor'));
    });
}

/**
 * 加载博客文章列表到表格
 */
async function loadBlogPostsForEditing() {
    const listBody = document.getElementById('blog-posts-list');
    const errorDiv = document.getElementById('blog-list-error');
    if (!listBody || !errorDiv) return;

    listBody.innerHTML = '<tr><td colspan="4" class="text-center">加载中...</td></tr>';
    errorDiv.style.display = 'none';

    try {
        const response = await fetch('/admin/api/blog');
        if (!response.ok) {
            throw new Error(`获取数据失败: ${response.statusText}`);
        }
        const posts = await response.json();

        listBody.innerHTML = ''; // 清空列表
        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const row = listBody.insertRow();
                row.innerHTML = `
                    <td>${escapeHTML(post.title)}</td>
                    <td>${escapeHTML(post.category || '')}</td>
                    <td>${formatDateSimple(post.date)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-post-button" data-id="${post.id}"><i class="bi bi-pencil"></i> 编辑</button>
                        <button class="btn btn-sm btn-outline-danger delete-post-button" data-id="${post.id}"><i class="bi bi-trash"></i> 删除</button>
                    </td>
                `;
                // 添加编辑按钮事件
                row.querySelector('.edit-post-button').addEventListener('click', function() {
                    openBlogEditor(this.getAttribute('data-id'));
                });
                // 添加删除按钮事件
                row.querySelector('.delete-post-button').addEventListener('click', function() {
                    deleteBlogPost(this.getAttribute('data-id'), this.closest('tr').querySelector('td').textContent);
                });
            });
        } else {
            listBody.innerHTML = '<tr><td colspan="4" class="text-center">还没有博客文章。</td></tr>';
        }

    } catch (error) {
        console.error('加载博客列表失败:', error);
        errorDiv.textContent = `加载博客列表失败: ${error.message}`;
        errorDiv.style.display = 'block';
        listBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">加载失败</td></tr>';
    }
}

/**
 * 打开博客编辑器（模态框）
 * @param {string|null} postId - 要编辑的文章 ID，如果为 null 或 undefined 则为新建文章
 */
async function openBlogEditor(postId = null) {
    const form = document.getElementById('blog-editor-form');
    const modalTitle = document.getElementById('blogEditorModalLabel');
    const postIdInput = document.getElementById('blog-post-id');
    const titleInput = document.getElementById('blog-title');
    const categoryInput = document.getElementById('blog-category');
    const contentInput = document.getElementById('blog-content');
    const attachmentsContainer = document.getElementById('blog-attachments-editor');
    const referencesContainer = document.getElementById('blog-references-editor');
    const statusSpan = document.getElementById('blog-editor-status');

    if (!form || !modalTitle || !postIdInput || !titleInput || !categoryInput || !contentInput || !attachmentsContainer || !referencesContainer || !statusSpan || !blogEditorModalInstance) return;

    // 重置表单和状态
    form.reset();
    postIdInput.value = '';
    attachmentsContainer.innerHTML = '';
    referencesContainer.innerHTML = ''; 
    statusSpan.textContent = '';
    statusSpan.className = 'me-auto'; // Reset classes

    if (postId) {
        // 编辑现有文章
        modalTitle.textContent = '编辑文章';
        postIdInput.value = postId;
        statusSpan.textContent = '加载文章数据...';
        try {
            const response = await fetch(`/admin/api/blog?id=${postId}`);
            if (!response.ok) {
                throw new Error(`获取文章数据失败: ${response.statusText}`);
            }
            const post = await response.json();
            
            titleInput.value = post.title || '';
            categoryInput.value = post.category || '';
            contentInput.value = post.content || '';

            // 填充附件
            if (post.attachments && Array.isArray(post.attachments)) {
                post.attachments.forEach(att => addAttachmentInputGroup(attachmentsContainer, att.url, att.type, att.filename));
            }
            // 填充参考文献
            if (post.references && Array.isArray(post.references)) {
                addReferenceInputGroup(referencesContainer, post.references.join(', '));
            }
            statusSpan.textContent = ''; // 清除加载状态

        } catch (error) {
            console.error('加载文章编辑数据失败:', error);
            statusSpan.textContent = `加载失败: ${error.message}`;
            statusSpan.classList.add('text-danger');
             // 这里可以选择不打开 modal，或者显示错误并允许关闭
             // blogEditorModalInstance.hide();
             // return;
        }

    } else {
        // 新建文章
        modalTitle.textContent = '新建文章';
    }

    blogEditorModalInstance.show();
}

/**
 * 添加一个附件输入组到编辑器
 */
function addAttachmentInputGroup(container, url = '', type = '', filename = '') {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group mb-2 blog-attachment-group';
    inputGroup.innerHTML = `
        <input type="url" class="form-control blog-attachment-url" placeholder="附件 URL (https://...)" value="${url}" required>
        <input type="text" class="form-control blog-attachment-type" placeholder="类型 (例如: image, pdf, zip)" value="${type}" required>
        <input type="text" class="form-control blog-attachment-filename" placeholder="显示的文件名 (可选)" value="${filename}">
        <button class="btn btn-outline-danger remove-blog-attachment-button" type="button"><i class="bi bi-trash"></i></button>
    `;
    inputGroup.querySelector('.remove-blog-attachment-button').addEventListener('click', function() {
        inputGroup.remove();
    });
    container.appendChild(inputGroup);
}

/**
 * 添加参考文献输入组到编辑器
 */
function addReferenceInputGroup(container, refString = '') {
     // 目前只允许一组参考文献输入
    if (container.querySelector('.blog-reference-group')) {
        // 如果已经存在，聚焦到现有输入框
        const existingInput = container.querySelector('.blog-reference-ids');
        if (existingInput) existingInput.focus();
        return; 
    }

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group mb-2 blog-reference-group'; // Add class for identification
    inputGroup.innerHTML = `
        <input type="text" class="form-control blog-reference-ids" placeholder="文章 ID (用逗号分隔)" value="${refString}">
         <button class="btn btn-outline-danger remove-blog-reference-button" type="button"><i class="bi bi-trash"></i></button>
    `;
      inputGroup.querySelector('.remove-blog-reference-button').addEventListener('click', function() {
        inputGroup.remove(); // 允许删除
    });
    container.appendChild(inputGroup);
}

/**
 * 保存博客文章（新建或更新）
 */
async function saveBlogPost() {
    const postIdInput = document.getElementById('blog-post-id');
    const titleInput = document.getElementById('blog-title');
    const categoryInput = document.getElementById('blog-category');
    const contentInput = document.getElementById('blog-content');
    const attachmentGroups = document.querySelectorAll('#blog-attachments-editor .blog-attachment-group');
    const referenceGroup = document.querySelector('#blog-references-editor .blog-reference-group'); // 只获取第一个（也应该是唯一一个）
    const statusSpan = document.getElementById('blog-editor-status');
    const submitButton = document.querySelector('#blog-editor-form button[type="submit"]');

    if (!titleInput || !categoryInput || !contentInput || !statusSpan || !submitButton) return;

    statusSpan.textContent = '保存中...';
    statusSpan.className = 'me-auto'; // Reset classes
    submitButton.disabled = true;

    // 收集附件
    const attachments = [];
    attachmentGroups.forEach(group => {
        const urlInput = group.querySelector('.blog-attachment-url');
        const typeInput = group.querySelector('.blog-attachment-type');
        const filenameInput = group.querySelector('.blog-attachment-filename');
        if (urlInput && typeInput && urlInput.value.trim() && typeInput.value.trim()) {
            attachments.push({
                url: urlInput.value.trim(),
                type: typeInput.value.trim(),
                filename: filenameInput ? filenameInput.value.trim() : ''
            });
        }
    });

    // 收集参考文献
    let references = [];
    if (referenceGroup) {
        const idsInput = referenceGroup.querySelector('.blog-reference-ids');
        if (idsInput && idsInput.value.trim()) {
            references = idsInput.value.trim()
                                .split(',') // 按逗号分割
                                .map(id => parseInt(id.trim(), 10)) // 转为数字
                                .filter(id => !isNaN(id) && id > 0); // 过滤无效 ID
        }
    }

    const postData = {
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        content: contentInput.value.trim(),
        attachments: attachments,
        references: references
    };

    const postId = postIdInput.value;
    const isEditing = !!postId;
    const url = isEditing ? `/admin/api/blog?id=${postId}` : '/admin/api/blog';
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
            const errorData = await response.json();
            throw new Error(errorData.error || `保存失败: ${response.statusText}`);
        }

        const result = await response.json();
        statusSpan.textContent = result.message || '保存成功！';
        statusSpan.classList.add('text-success');

        // 关闭模态框并刷新列表
        blogEditorModalInstance.hide();
        await loadBlogPostsForEditing();

    } catch (error) {
        console.error('保存博客文章失败:', error);
        statusSpan.textContent = `保存失败: ${error.message}`;
        statusSpan.classList.add('text-danger');
    } finally {
        submitButton.disabled = false;
         // 模态框关闭后状态会自动清除，不需要延时
    }
}

/**
 * 删除博客文章
 * @param {string} postId - 要删除的文章 ID
 * @param {string} postTitle - 文章标题（用于确认信息）
 */
async function deleteBlogPost(postId, postTitle) {
    if (!postId) return;

    if (confirm(`确定要删除文章 "${postTitle}" 吗？此操作无法撤销。`)) {
        try {
             // 可以先在界面上添加一个 loading 状态
            const response = await fetch(`/admin/api/blog?id=${postId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `删除失败: ${response.statusText}`);
            }
            
            // 删除成功后刷新列表
            await loadBlogPostsForEditing();
            // 可以在这里显示一个短暂的成功提示
             alert(`文章 "${postTitle}" 已删除。`);

        } catch (error) {
            console.error('删除博客文章失败:', error);
            alert(`删除失败: ${error.message}`);
        }
    }
}

// --- 工具函数 ---

/**
 * 简单的 HTML 转义函数，防止 XSS
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的字符串
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"/]/g, function (s) {
        const entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        return entityMap[s];
    });
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} dateInput - 日期字符串或对象
 * @returns {string} - 格式化后的日期字符串
 */
function formatDateSimple(dateInput) {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date)) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return ''; // Handle potential errors from invalid date strings
    }
}

// 未来在这里添加 Dashboard 相关的功能
// 例如加载数据、处理表单提交等 