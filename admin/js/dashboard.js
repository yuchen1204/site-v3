document.addEventListener('DOMContentLoaded', function() {
    initializeLogout();
    initializeAdminSidebar();
    initializeProfileEditor(); // 初始化个人资料编辑器
    initializeBlogEditor(); // 初始化博客编辑器
    // 如果当前页面是评论管理页面，则初始化评论管理功能
    const commentsSection = document.getElementById('manage-comments');
    if (commentsSection && typeof initializeCommentManagement === 'function') {
        initializeCommentManagement();
    }
    initializePasskeyManagement();
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

                // --- 修改：根据区域强制加载最新数据 ---
                switch (targetSectionId) {
                    case 'edit-profile':
                        // 加载最新的个人资料用于编辑
                        loadProfileDataForEditing();
                        break;
                    case 'edit-blog':
                        // 显示文章列表，该函数内部会调用 loadBlogPosts 加载最新文章
                        showBlogList();
                        break;
                    case 'manage-comments':
                        // 重新初始化评论管理或调用特定的加载函数
                        // 假设 initializeCommentManagement 负责加载数据并且可以重复调用
                        // 如果有单独的 loadComments() 函数会更好
                        if (typeof initializeCommentManagement === 'function') {
                            initializeCommentManagement(); // 重新加载评论数据
                        } else {
                            console.warn('评论管理功能 (initializeCommentManagement) 未定义或不可用。');
                        }
                        break;
                    case 'dashboard-overview':
                        // 仪表盘通常是静态的或有自己的更新机制，这里暂时不处理
                        break;
                    default:
                        console.warn(`未处理的区域数据加载: ${targetSectionId}`);
                }
                // --- 修改结束 ---

            } else {
                console.warn(`未找到目标区域: ${targetSectionId}`);
            }

            // (可选) 在小屏幕上点击链接后自动关闭侧边栏
            if (window.innerWidth < 992) {
                closeSidebar();
            }
        });
    });

    // --- 修改：确保初始加载时，当前激活的 section 也加载数据 ---
    // 移除旧的、只针对 edit-blog 的初始加载逻辑
    // const initialActiveSection = document.querySelector('.admin-section.active');
    // if (initialActiveSection && initialActiveSection.id === 'edit-blog') {
    //     showBlogList();
    // }

    // 查找初始激活的链接，并为其对应的 section 加载数据
    const initialActiveLink = document.querySelector('.admin-sidebar-link.active');
    if (initialActiveLink) {
        const initialSectionId = initialActiveLink.getAttribute('data-section');
        const initialSection = document.getElementById(initialSectionId);
        // 确保对应的 section 确实是初始激活的
        if (initialSection && initialSection.classList.contains('active')) {
             switch (initialSectionId) {
                case 'edit-profile':
                    loadProfileDataForEditing();
                    break;
                case 'edit-blog':
                    showBlogList(); // 加载博客列表
                    break;
                case 'manage-comments':
                    // 初始加载评论
                    if (typeof initializeCommentManagement === 'function') {
                        initializeCommentManagement();
                    }
                    break;
                // dashboard-overview 通常不需要初始加载动态数据
                case 'dashboard-overview':
                     break;
            }
        }
    }
    // --- 修改结束 ---
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

// --- 博客编辑相关函数 ---

let allBlogPosts = []; // 存储从 API 获取的所有博客文章

/**
 * 初始化博客编辑器功能
 */
function initializeBlogEditor() {
    const addPostButton = document.getElementById('add-new-post-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const blogEditorForm = document.getElementById('blog-editor-form');
    const addAttachmentButton = document.getElementById('add-attachment-button');
    const addReferenceButton = document.getElementById('add-reference-button');

    if (!addPostButton || !cancelEditButton || !blogEditorForm || !addAttachmentButton || !addReferenceButton) return;

    // "添加新文章"按钮点击事件
    addPostButton.addEventListener('click', () => {
        showBlogEditor(); // 显示空编辑器
    });

    // "取消"按钮点击事件
    cancelEditButton.addEventListener('click', () => {
        showBlogList(); // 返回列表视图
    });

    // "添加附件"按钮点击事件
    addAttachmentButton.addEventListener('click', () => {
        addAttachmentInputGroup(document.getElementById('blog-attachments-editor'));
    });

    // "添加引用"按钮点击事件
    addReferenceButton.addEventListener('click', () => {
        addReferenceInputGroup(document.getElementById('blog-references-editor'));
    });

    // 表单提交事件 (保存文章)
    blogEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBlogPost();
    });
}

/**
 * 显示文章列表视图并加载数据
 */
function showBlogList() {
    const listContainer = document.getElementById('blog-list-container');
    const editorContainer = document.getElementById('blog-editor-container');
    if (!listContainer || !editorContainer) return;

    listContainer.style.display = 'block';
    editorContainer.style.display = 'none';
    loadBlogPosts(); // 加载文章列表
}

/**
 * 显示文章编辑器视图
 * @param {object | null} post - 要编辑的文章对象，如果是 null 或 undefined，则为添加新文章
 */
function showBlogEditor(post = null) {
    const listContainer = document.getElementById('blog-list-container');
    const editorContainer = document.getElementById('blog-editor-container');
    const editorTitle = document.getElementById('editor-title');
    const form = document.getElementById('blog-editor-form');
    const blogIdInput = document.getElementById('blog-id');
    const titleInput = document.getElementById('blog-title');
    const categoryInput = document.getElementById('blog-category');
    const dateInput = document.getElementById('blog-date');
    const contentInput = document.getElementById('blog-content');
    const attachmentsEditor = document.getElementById('blog-attachments-editor');
    const referencesEditor = document.getElementById('blog-references-editor');
    const saveStatus = document.getElementById('blog-save-status');

    if (!listContainer || !editorContainer || !editorTitle || !form || !blogIdInput || 
        !titleInput || !categoryInput || !dateInput || !contentInput || 
        !attachmentsEditor || !referencesEditor || !saveStatus) return;

    listContainer.style.display = 'none';
    editorContainer.style.display = 'block';
    saveStatus.textContent = ''; // 清空状态信息
    attachmentsEditor.innerHTML = ''; // 清空附件
    referencesEditor.innerHTML = ''; // 清空引用

    if (post) {
        // 编辑现有文章
        editorTitle.textContent = '编辑文章';
        blogIdInput.value = post.id;
        titleInput.value = post.title || '';
        categoryInput.value = post.category || '';
        // 格式化日期以适应 datetime-local input
        dateInput.value = post.date ? new Date(post.date).toISOString().slice(0, 16) : '';
        contentInput.value = post.content || '';

        // 填充附件
        if (post.attachments && Array.isArray(post.attachments)) {
            post.attachments.forEach(att => addAttachmentInputGroup(attachmentsEditor, att.url, att.type, att.filename));
        }
        // 填充引用
        if (post.references && Array.isArray(post.references)) {
            post.references.forEach(refId => addReferenceInputGroup(referencesEditor, refId));
        }

    } else {
        // 添加新文章
        editorTitle.textContent = '添加新文章';
        form.reset(); // 清空表单
        blogIdInput.value = ''; // 确保 ID 为空
        // 可以设置默认日期为当前时间
        dateInput.value = new Date().toISOString().slice(0, 16);
        // 添加一个空的附件和引用输入（可选）
        // addAttachmentInputGroup(attachmentsEditor);
        // addReferenceInputGroup(referencesEditor);
    }
}

/**
 * 从 API 加载博客文章列表并渲染到表格
 */
async function loadBlogPosts() {
    const tbody = document.getElementById('blog-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">加载中...</td></tr>';

    try {
        // TODO: 实现 API 端点 /admin/api/blog (GET)
        const response = await fetch('/admin/api/blog'); 
        if (!response.ok) {
            if (response.status === 401) {
                 tbody.innerHTML = '<tr><td colspan="5" class="text-center">需要登录才能查看。</td></tr>';
                 return;
            }
            throw new Error(`获取文章列表失败: ${response.statusText}`);
        }
        
        allBlogPosts = await response.json(); // 存储文章数据

        if (!Array.isArray(allBlogPosts) || allBlogPosts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">还没有文章。</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // 清空加载提示

        // 按日期降序排序 (可选)
        allBlogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

        allBlogPosts.forEach(post => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${post.id}</td>
                <td>${escapeHTML(post.title)}</td>
                <td>${escapeHTML(post.category)}</td>
                <td>${new Date(post.date).toLocaleString('zh-CN')}</td>
                <td>
                    <button class="btn btn-primary btn-sm edit-post-button" data-id="${post.id}">
                        <i class="bi bi-pencil-fill"></i> 编辑
                    </button>
                    <button class="btn btn-danger btn-sm delete-post-button" data-id="${post.id}">
                        <i class="bi bi-trash-fill"></i> 删除
                    </button>
                </td>
            `;

            // 添加编辑按钮事件监听器
            row.querySelector('.edit-post-button').addEventListener('click', function() {
                const postId = this.getAttribute('data-id');
                const postToEdit = allBlogPosts.find(p => p.id.toString() === postId);
                if (postToEdit) {
                    showBlogEditor(postToEdit);
                } else {
                    console.error(`未找到 ID 为 ${postId} 的文章`);
                    alert('无法编辑该文章，请刷新列表重试。');
                }
            });

            // 添加删除按钮事件监听器
            row.querySelector('.delete-post-button').addEventListener('click', function() {
                const postId = this.getAttribute('data-id');
                const postToDelete = allBlogPosts.find(p => p.id.toString() === postId);
                
                if (postToDelete) {
                    // 打开自定义确认对话框，而不是使用浏览器的 confirm()
                    showDeleteConfirmModal(postToDelete);
                } else {
                    console.error(`未找到 ID 为 ${postId} 的文章`);
                    alert('无法删除该文章，请刷新列表重试。');
                }
            });
        });

    } catch (error) {
        console.error('加载博客文章列表失败:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">加载文章列表失败: ${error.message}</td></tr>`;
    }
}

/**
 * 添加一个附件输入组到编辑器
 * @param {HTMLElement} container 
 * @param {string} [url=''] 
 * @param {string} [type=''] 
 * @param {string} [filename=''] 
 */
function addAttachmentInputGroup(container, url = '', type = '', filename = '') {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group input-group-sm mb-2 blog-attachment-group';
    inputGroup.innerHTML = `
        <input type="url" class="form-control blog-attachment-url" placeholder="附件 URL (https://...)" value="${url}" required>
        <input type="text" class="form-control blog-attachment-type" placeholder="类型 (image/pdf/zip)" value="${type}" required>
        <input type="text" class="form-control blog-attachment-filename" placeholder="显示文件名" value="${filename}" required>
        <button class="btn btn-outline-danger remove-attachment-button" type="button">
            <i class="bi bi-trash"></i>
        </button>
    `;
    inputGroup.querySelector('.remove-attachment-button').addEventListener('click', () => inputGroup.remove());
    container.appendChild(inputGroup);
}

/**
 * 添加一个引用输入组到编辑器
 * @param {HTMLElement} container 
 * @param {number|string} [refId=''] 
 */
function addReferenceInputGroup(container, refId = '') {
     const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group input-group-sm mb-2 blog-reference-group';
    // TODO: 改进引用选择方式，例如下拉列表或搜索
    inputGroup.innerHTML = `
        <span class="input-group-text">引用文章 ID:</span>
        <input type="number" class="form-control blog-reference-id" placeholder="输入文章 ID" value="${refId}" required min="1">
        <button class="btn btn-outline-danger remove-reference-button" type="button">
            <i class="bi bi-trash"></i>
        </button>
    `;
    inputGroup.querySelector('.remove-reference-button').addEventListener('click', () => inputGroup.remove());
    container.appendChild(inputGroup);
}

/**
 * 保存博客文章 (添加或更新)
 */
async function saveBlogPost() {
    const form = document.getElementById('blog-editor-form');
    const postId = document.getElementById('blog-id').value;
    const title = document.getElementById('blog-title').value.trim();
    const category = document.getElementById('blog-category').value.trim();
    const dateStr = document.getElementById('blog-date').value;
    const content = document.getElementById('blog-content').value.trim();
    const statusSpan = document.getElementById('blog-save-status');
    const saveButton = document.getElementById('save-post-button');

    if (!form.checkValidity()) {
        form.reportValidity();
        statusSpan.textContent = '请填写所有必填项。';
        return;
    }
    
    // 验证日期格式是否正确
    let dateISO = '';
    try {
        dateISO = new Date(dateStr).toISOString();
    } catch(e) {
        statusSpan.textContent = '日期格式无效。';
        return;
    }

    statusSpan.textContent = '保存中...';
    saveButton.disabled = true;

    // 收集附件数据
    const attachments = [];
    document.querySelectorAll('#blog-attachments-editor .blog-attachment-group').forEach(group => {
        const urlInput = group.querySelector('.blog-attachment-url');
        const typeInput = group.querySelector('.blog-attachment-type');
        const filenameInput = group.querySelector('.blog-attachment-filename');
        if (urlInput && typeInput && filenameInput && 
            urlInput.value.trim() && typeInput.value.trim() && filenameInput.value.trim()) {
            attachments.push({
                url: urlInput.value.trim(),
                type: typeInput.value.trim(),
                filename: filenameInput.value.trim()
            });
        }
    });

    // 收集引用数据
    const references = [];
    document.querySelectorAll('#blog-references-editor .blog-reference-group').forEach(group => {
        const idInput = group.querySelector('.blog-reference-id');
        if (idInput && idInput.value.trim()) {
            const refId = parseInt(idInput.value.trim(), 10);
            if (!isNaN(refId) && refId > 0) {
                 references.push(refId);
            } else {
                 console.warn(`无效的引用 ID: ${idInput.value}`);
                 // 可以考虑给用户提示
            }
        }
    });

    const postData = {
        title,
        category,
        date: dateISO,
        content,
        attachments,
        references
    };

    const method = postId ? 'PUT' : 'POST';
    const url = postId ? `/admin/api/blog/${postId}` : '/admin/api/blog';

    try {
        // TODO: 实现 API 端点 /admin/api/blog (POST/PUT)
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: '未知错误' })); // 尝试解析错误信息
             throw new Error(`保存失败 (${response.status}): ${errorData.error || response.statusText}`);
        }

        statusSpan.textContent = '保存成功！';
        setTimeout(() => {
             showBlogList(); // 返回列表视图
        }, 1500);

    } catch (error) {
        console.error('保存博客文章失败:', error);
        statusSpan.textContent = `保存失败: ${error.message}`;
    } finally {
        saveButton.disabled = false;
    }
}

/**
 * 显示删除确认模态框
 * @param {object} post 要删除的文章对象
 */
function showDeleteConfirmModal(post) {
    const modal = document.getElementById('deleteConfirmModal');
    const confirmMessage = document.getElementById('delete-confirm-message');
    const confirmButton = document.getElementById('confirmDeleteButton');
    const bsModal = new bootstrap.Modal(modal);
    
    if (!modal || !confirmMessage || !confirmButton) return;
    
    // 设置确认消息
    confirmMessage.textContent = `您确定要删除文章"${post.title}" (ID: ${post.id}) 吗？`;
    
    // 移除之前可能存在的事件监听器
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // 为确认按钮添加删除逻辑
    newConfirmButton.addEventListener('click', async () => {
        bsModal.hide(); // 先隐藏模态框
        await deleteBlogPost(post.id); // 执行删除操作
    });
    
    // 显示模态框
    bsModal.show();
}

/**
 * 删除博客文章
 * @param {string|number} postId 
 */
async function deleteBlogPost(postId) {
     const listTbody = document.getElementById('blog-list-tbody');
     // 可以给对应行添加删除中的效果
     const rows = listTbody.querySelectorAll(`button.delete-post-button[data-id="${postId}"]`);
     const row = rows.length > 0 ? rows[0].closest('tr') : null;
     
     if (row) {
         row.classList.add('table-secondary');
         row.querySelector('.delete-post-button').disabled = true;
         row.querySelector('.edit-post-button').disabled = true;
     }

    try {
        const response = await fetch(`/admin/api/blog/${postId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '未知错误' }));
            throw new Error(`删除失败 (${response.status}): ${errorData.error || response.statusText}`);
        }

        // 成功删除，显示简短的成功提示
        const toast = createToast(`文章 (ID: ${postId}) 已成功删除`, 'success');
        document.body.appendChild(toast);
        
        // 移除 toast
        setTimeout(() => toast.remove(), 3000);
        
        // 重新加载文章列表
        loadBlogPosts(); 

    } catch (error) {
        console.error(`删除文章 ${postId} 失败:`, error);
        
        // 恢复行样式
        if (row) {
            row.classList.remove('table-secondary');
            row.querySelector('.delete-post-button').disabled = false;
            row.querySelector('.edit-post-button').disabled = false;
        }
        
        // 显示错误提示
        const toast = createToast(`删除文章失败: ${error.message}`, 'danger');
        document.body.appendChild(toast);
        
        // 移除 toast
        setTimeout(() => toast.remove(), 5000);
    }
}

/**
 * 创建一个 Bootstrap Toast 提示
 * @param {string} message 提示消息
 * @param {string} type 提示类型 ('success', 'danger', 'warning', 'info')
 * @returns {HTMLElement} Toast 元素
 */
function createToast(message, type = 'info') {
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="关闭"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // 初始化 Toast
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    
    return toastContainer;
}

/**
 * 简单的 HTML 转义函数，防止 XSS
 * @param {string} str 
 * @returns {string}
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
 * 显示通知提示
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {string} type - 提示类型（success, error, warning, info）
 */
function showToast(title, message, type = 'info') {
    createToast(`<strong>${title}</strong>: ${message}`, type);
}

// --- Passkey管理相关函数 ---

/**
 * 辅助函数：Base64Url转ArrayBuffer
 */
function base64UrlToBuffer(base64Url) {
    const padding = '='.repeat((4 - base64Url.length % 4) % 4);
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

/**
 * 辅助函数：ArrayBuffer转Base64Url
 */
function arrayBufferToBase64Url(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * 初始化Passkey管理功能
 */
function initializePasskeyManagement() {
    const addPasskeyButton = document.getElementById('add-passkey-button');
    const startRegistrationButton = document.getElementById('start-passkey-registration');
    const confirmDeleteButton = document.getElementById('confirm-delete-passkey');
    
    if (!addPasskeyButton || !startRegistrationButton || !confirmDeleteButton) return;

    // 添加Passkey按钮点击事件
    addPasskeyButton.addEventListener('click', () => {
        // 重置模态框状态
        document.getElementById('passkey-name').value = '';
        document.getElementById('passkey-registration-status').style.display = 'none';
        document.getElementById('passkey-registering').style.display = 'block';
        document.getElementById('passkey-success').style.display = 'none';
        document.getElementById('passkey-error').style.display = 'none';
        
        // 显示Passkey注册模态框
        const modal = new bootstrap.Modal(document.getElementById('addPasskeyModal'));
        modal.show();
    });
    
    // 开始注册按钮点击事件
    startRegistrationButton.addEventListener('click', async () => {
        const nameInput = document.getElementById('passkey-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            nameInput.focus();
            return;
        }
        
        // 显示注册状态
        document.getElementById('passkey-registration-status').style.display = 'block';
        startRegistrationButton.disabled = true;
        
        try {
            await registerNewPasskey(name);
        } finally {
            startRegistrationButton.disabled = false;
        }
    });
    
    // 确认删除Passkey按钮点击事件
    confirmDeleteButton.addEventListener('click', async () => {
        const passkeyId = confirmDeleteButton.getAttribute('data-passkey-id');
        if (!passkeyId) return;
        
        confirmDeleteButton.disabled = true;
        
        try {
            await deletePasskey(passkeyId);
            // 关闭模态框
            bootstrap.Modal.getInstance(document.getElementById('deletePasskeyModal')).hide();
            // 重新加载Passkey列表
            loadPasskeys();
            // 显示成功提示
            showToast('成功', 'Passkey已删除', 'success');
        } catch (error) {
            console.error('删除Passkey失败:', error);
            showToast('错误', `删除Passkey失败: ${error.message}`, 'danger');
        } finally {
            confirmDeleteButton.disabled = false;
        }
    });
    
    // 加载Passkey列表
    loadPasskeys();
}

/**
 * 加载Passkey列表
 */
async function loadPasskeys() {
    const loadingElement = document.getElementById('passkeys-loading');
    const emptyElement = document.getElementById('passkeys-empty');
    const errorElement = document.getElementById('passkeys-error');
    const errorMessageElement = document.getElementById('passkeys-error-message');
    const tableElement = document.getElementById('passkeys-table');
    const listElement = document.getElementById('passkeys-list');
    
    if (!loadingElement || !emptyElement || !errorElement || !errorMessageElement || !tableElement || !listElement) return;
    
    // 显示加载状态
    loadingElement.style.display = 'block';
    emptyElement.style.display = 'none';
    errorElement.style.display = 'none';
    tableElement.style.display = 'none';
    
    try {
        const response = await fetch('/admin/api/passkey/list');
        
        if (!response.ok) {
            throw new Error(`获取Passkey列表失败: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 检查是否有Passkey
        if (!data.passkeys || data.passkeys.length === 0) {
            loadingElement.style.display = 'none';
            emptyElement.style.display = 'block';
            return;
        }
        
        // 清空列表
        listElement.innerHTML = '';
        
        // 填充列表
        data.passkeys.forEach(passkey => {
            const row = document.createElement('tr');
            const createdDate = new Date(passkey.created).toLocaleString('zh-CN');
            
            row.innerHTML = `
                <td>${escapeHTML(passkey.name)}</td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-passkey-button" data-passkey-id="${passkey.id}">
                        <i class="bi bi-trash-fill"></i> 删除
                    </button>
                </td>
            `;
            
            // 添加删除按钮事件
            row.querySelector('.delete-passkey-button').addEventListener('click', () => {
                showDeletePasskeyConfirm(passkey);
            });
            
            listElement.appendChild(row);
        });
        
        // 显示表格
        loadingElement.style.display = 'none';
        tableElement.style.display = 'table';
        
    } catch (error) {
        console.error('加载Passkey列表失败:', error);
        loadingElement.style.display = 'none';
        errorMessageElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}

/**
 * 注册新Passkey
 * @param {string} name - Passkey名称
 */
async function registerNewPasskey(name) {
    const registeringElement = document.getElementById('passkey-registering');
    const successElement = document.getElementById('passkey-success');
    const errorElement = document.getElementById('passkey-error');
    const errorMessageElement = document.getElementById('passkey-error-message');
    
    if (!registeringElement || !successElement || !errorElement || !errorMessageElement) return;
    
    // 显示注册中状态
    registeringElement.style.display = 'block';
    successElement.style.display = 'none';
    errorElement.style.display = 'none';
    
    try {
        // 1. 开始注册流程
        const startResponse = await fetch('/admin/api/passkey/begin-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || '开始注册流程失败');
        }
        
        const { publicKey } = await startResponse.json();
        
        // 2. 准备注册选项
        const options = {
            ...publicKey,
            challenge: base64UrlToBuffer(publicKey.challenge),
            user: {
                ...publicKey.user,
                id: base64UrlToBuffer(publicKey.user.id)
            }
        };
        
        // 3. 调用浏览器的证书API
        const credential = await navigator.credentials.create({
            publicKey: options
        });
        
        // 4. 处理注册结果
        const registrationResult = {
            credential: {
                id: credential.id,
                rawId: arrayBufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
                    clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON)
                }
            }
        };
        
        // 5. 发送注册结果到服务器
        const completeResponse = await fetch('/admin/api/passkey/complete-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationResult)
        });
        
        const completeData = await completeResponse.json();
        
        if (completeResponse.ok && completeData.success) {
            // 注册成功
            registeringElement.style.display = 'none';
            successElement.style.display = 'block';
            
            // 重新加载Passkey列表
            setTimeout(() => {
                loadPasskeys();
                // 3秒后关闭模态框
                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById('addPasskeyModal')).hide();
                }, 1500);
            }, 1000);
            
        } else {
            // 注册失败
            throw new Error(completeData.error || '注册失败');
        }
        
    } catch (error) {
        console.error('Passkey注册失败:', error);
        registeringElement.style.display = 'none';
        errorMessageElement.textContent = error.message || '未知错误';
        errorElement.style.display = 'block';
    }
}

/**
 * 显示删除Passkey确认对话框
 * @param {Object} passkey - Passkey对象
 */
function showDeletePasskeyConfirm(passkey) {
    const modal = document.getElementById('deletePasskeyModal');
    const confirmMessage = document.getElementById('delete-passkey-message');
    const confirmButton = document.getElementById('confirm-delete-passkey');
    
    if (!modal || !confirmMessage || !confirmButton) return;
    
    // 设置确认消息
    confirmMessage.textContent = `您确定要删除Passkey "${passkey.name}" 吗？`;
    
    // 设置Passkey ID
    confirmButton.setAttribute('data-passkey-id', passkey.id);
    
    // 显示模态框
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/**
 * 删除Passkey
 * @param {string} passkeyId - Passkey ID
 */
async function deletePasskey(passkeyId) {
    const response = await fetch('/admin/api/passkey/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyId })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `删除失败: ${response.statusText}`);
    }
    
    return await response.json();
} 