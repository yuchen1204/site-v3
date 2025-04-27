// 博客文章详情页面脚本

document.addEventListener('DOMContentLoaded', function() {
    initializeThemeToggle(); // 初始化主题切换按钮
    initializeSidebar(); // 初始化侧边栏
    loadPostDetails(); // 加载文章详情
    initializeComments(); // 初始化评论区
});

// 跟踪数据来源
let blogDataSource = '';
// 当前文章ID
let currentPostId = null;

/**
 * 初始化主题切换功能
 */
function initializeThemeToggle() {
    const themeToggleButton = document.getElementById('theme-toggle');
    if (!themeToggleButton) return;

    // 获取当前主题（优先从 localStorage 读取）
    let currentTheme = localStorage.getItem('theme') || 'light';

    // 设置初始主题
    setTheme(currentTheme);

    themeToggleButton.addEventListener('click', () => {
        // 切换主题
        currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
        setTheme(currentTheme);
        // 保存主题到 localStorage
        localStorage.setItem('theme', currentTheme);
    });
}

/**
 * 设置主题
 * @param {string} theme - 要设置的主题 ('light' or 'dark')
 */
function setTheme(theme) {
    const themeToggleButton = document.getElementById('theme-toggle');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleButton) themeToggleButton.innerHTML = moonIcon;
    } else {
        document.body.classList.remove('dark-mode');
        if (themeToggleButton) themeToggleButton.innerHTML = sunIcon;
    }
}

/**
 * 初始化侧边栏功能
 */
function initializeSidebar() {
    initializeSidebarToggle();
    setupSidebarLinks(); // 新增：设置链接结构
}

/**
 * 初始化侧边栏切换按钮
 */
function initializeSidebarToggle() {
    const sidebarToggleButton = document.getElementById('sidebar-toggle');
    const body = document.body;

    if (sidebarToggleButton && body) {
        sidebarToggleButton.addEventListener('click', () => {
            body.classList.toggle('sidebar-open');
            localStorage.setItem('sidebarState', body.classList.contains('sidebar-open') ? 'open' : 'closed');
        });
        
        // 恢复侧边栏状态
        const savedSidebarState = localStorage.getItem('sidebarState');
        if (savedSidebarState === 'open') {
            body.classList.add('sidebar-open');
        }
    }
}

/**
 * 设置侧边栏链接的内部结构
 * 为.sidebar-link创建.sidebar-link-content内部容器，
 * 用于实现深色模式下的渐变边框效果
 */
function setupSidebarLinks() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        // 检查内容包装器是否已存在，避免在可能的重新运行时重复
        if (link.querySelector('.sidebar-link-content')) {
            return;
        }
        // 创建内部容器 div.sidebar-link-content
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'sidebar-link-content';

        // 将原链接的所有子元素（图标<i>和文本<span>）移动到新容器中
        // 需要先收集节点，因为移动它们会修改childNodes列表
        const childNodesToMove = [];
        link.childNodes.forEach(node => childNodesToMove.push(node));
        
        childNodesToMove.forEach(node => contentWrapper.appendChild(node));

        // 将新容器添加到链接中
        link.appendChild(contentWrapper);
    });
}

/**
 * 从URL中获取文章ID并加载文章详情
 */
async function loadPostDetails() {
    const postDetailsContainer = document.getElementById('blog-post-details');
    if (!postDetailsContainer) return;
    
    // 从URL中获取文章ID
    const urlParams = new URLSearchParams(window.location.search);
    const postId = parseInt(urlParams.get('id'), 10);
    currentPostId = postId;
    
    if (isNaN(postId)) {
        showError('无效的文章ID', postDetailsContainer);
        return;
    }
    
    try {
        // 先尝试从KV数据库API加载
        const response = await fetch(`/api/blog/post/${postId}`);
        
        if (!response.ok) {
            throw new Error('API响应异常');
        }
        
        const post = await response.json();
        blogDataSource = 'kv';
        updateDataSourceIndicator();
        displayPostDetails(post);
    } catch (error) {
        console.warn('从KV数据库加载文章失败，尝试从JSON文件加载:', error);
        
        try {
            // 如果从KV加载失败，则从本地JSON文件加载所有文章
            const response = await fetch('../data/blog.json');
            
            if (!response.ok) {
                throw new Error('JSON文件响应异常');
            }
            
            const allPosts = await response.json();
            const post = allPosts.find(p => p.id === postId);
            
            if (!post) {
                throw new Error('找不到指定ID的文章');
            }
            
            blogDataSource = 'json';
            updateDataSourceIndicator();
            displayPostDetails(post);
        } catch (error) {
            console.error('加载文章详情失败:', error);
            showError('找不到指定的文章或加载出错', postDetailsContainer);
        }
    }
}

/**
 * 显示文章详情
 * @param {Object} post - 文章数据对象
 */
function displayPostDetails(post) {
    const postDetailsContainer = document.getElementById('blog-post-details');
    if (!postDetailsContainer) return;
    
    // 更新页面标题
    document.title = `${post.title} - 个人网站`;
    
    // 更新导航
    const breadcrumbItem = document.querySelector('.breadcrumb-item.active');
    if (breadcrumbItem) {
        breadcrumbItem.textContent = post.title;
    }
    
    // 构建文章HTML
    const postDate = post.date ? formatDate(new Date(post.date)) : '';
    
    const postHTML = `
        <article class="blog-post-full">
            <header class="blog-post-header">
                <h1 class="blog-post-title">${post.title}</h1>
                <div class="blog-post-meta">
                    <span class="blog-post-date">${postDate}</span>
                    ${post.category ? `<span class="blog-post-category">${post.category}</span>` : ''}
                </div>
            </header>
            <div class="blog-post-content">
                ${post.content}
            </div>
        </article>
    `;
    
    postDetailsContainer.innerHTML = postHTML;
    
    // 处理附件
    if (post.attachments && post.attachments.length > 0) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'blog-post-attachments';
        const attachmentsTitle = document.createElement('h5');
        attachmentsTitle.textContent = '附件:';
        attachmentsContainer.appendChild(attachmentsTitle);
        
        const attachmentList = document.createElement('ul');
        attachmentList.className = 'attachment-list';
        
        post.attachments.forEach(attachment => {
            const listItem = document.createElement('li');
            listItem.className = 'attachment-item';
            
            if (attachment.type === 'image') {
                const img = document.createElement('img');
                img.src = attachment.url;
                img.alt = attachment.filename || '附件图片';
                img.className = 'attachment-image';
                listItem.appendChild(img);
            } else {
                const link = document.createElement('a');
                link.href = attachment.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'attachment-download';
                if (attachment.filename) { link.download = attachment.filename; }
                
                const icon = document.createElement('span');
                icon.className = 'attachment-icon';
                icon.textContent = `[${attachment.type.toUpperCase()}]`;
                link.appendChild(icon);
                link.appendChild(document.createTextNode(` ${attachment.filename || '下载附件'}`));
                listItem.appendChild(link);
            }
            
            attachmentList.appendChild(listItem);
        });
        
        attachmentsContainer.appendChild(attachmentList);
        postDetailsContainer.querySelector('.blog-post-full').appendChild(attachmentsContainer);
    }
    
    // 处理相关文章（引用）
    if (post.references && post.references.length > 0) {
        // 这部分需要额外加载所有文章数据
        loadRelatedPosts(post.references);
    }
}

/**
 * 加载相关文章信息
 * @param {Array} referenceIds - 引用的文章ID数组
 */
async function loadRelatedPosts(referenceIds) {
    try {
        // 根据数据源选择加载方式
        let allPosts;
        
        if (blogDataSource === 'kv') {
            const response = await fetch('/api/blog');
            if (!response.ok) {
                throw new Error('加载所有文章失败');
            }
            allPosts = await response.json();
        } else {
            const response = await fetch('../data/blog.json');
            if (!response.ok) {
                throw new Error('加载所有文章失败');
            }
            allPosts = await response.json();
        }
        
        // 筛选出引用的文章
        const referencedPosts = allPosts.filter(post => referenceIds.includes(post.id));
        
        if (referencedPosts.length > 0) {
            const postDetailsContainer = document.getElementById('blog-post-details');
            const postElement = postDetailsContainer.querySelector('.blog-post-full');
            
            const referencesContainer = document.createElement('div');
            referencesContainer.className = 'blog-post-references';
            const referencesTitle = document.createElement('h5');
            referencesTitle.textContent = '相关文章:';
            referencesContainer.appendChild(referencesTitle);
            
            const referenceList = document.createElement('ul');
            referenceList.className = 'reference-list';
            
            referencedPosts.forEach(post => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `?id=${post.id}`;
                link.textContent = post.title;
                link.className = 'reference-link';
                listItem.appendChild(link);
                referenceList.appendChild(listItem);
            });
            
            referencesContainer.appendChild(referenceList);
            postElement.appendChild(referencesContainer);
        }
    } catch (error) {
        console.error('加载相关文章失败:', error);
    }
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 * @param {HTMLElement} container - 容器元素
 */
function showError(message, container) {
    container.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <h4 class="alert-heading">出错了!</h4>
            <p>${message}</p>
            <hr>
            <p class="mb-0">
                <a href="../index.html" class="alert-link">返回首页</a>
            </p>
        </div>
    `;
}

/**
 * 更新数据源指示器
 */
function updateDataSourceIndicator() {
    const indicator = document.getElementById('data-source-indicator');
    const dot = indicator.querySelector('.data-source-dot');
    const text = indicator.querySelector('.data-source-text');
    
    if (blogDataSource === 'kv') {
        dot.style.backgroundColor = '#4CAF50'; // 绿色
        text.textContent = 'KV数据库';
    } else if (blogDataSource === 'json') {
        dot.style.backgroundColor = '#FFC107'; // 黄色
        text.textContent = '本地JSON';
    } else {
        dot.style.backgroundColor = '#F44336'; // 红色
        text.textContent = '数据源未知';
    }
    
    indicator.style.display = 'flex';
}

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '';
    }
    
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) {
        console.error('日期格式化出错:', e);
        return '';
    }
}

// SVG Icons - 添加图标
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-brightness-high-fill" viewBox="0 0 16 16">
<path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
</svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-moon-stars-fill" viewBox="0 0 16 16">
<path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/>
<path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162a1.73 1.73 0 0 0-1.097-1.097l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097z"/>
</svg>`;

/**
 * 初始化评论区功能
 */
function initializeComments() {
    // 获取评论表单
    const commentForm = document.getElementById('comment-form');
    if (!commentForm) return;
    
    // 监听表单提交事件
    commentForm.addEventListener('submit', function(event) {
        event.preventDefault();
        submitComment();
    });
    
    // 加载评论（在loadPostDetails成功后调用）
    // 这里不主动调用，因为需要等postId加载完毕
}

/**
 * 加载评论列表
 * @param {number} page - 页码，默认为1
 */
async function loadComments(page = 1) {
    if (!currentPostId) return;
    
    const commentsListElement = document.getElementById('comments-list');
    const paginationElement = document.getElementById('comments-pagination');
    
    if (!commentsListElement) return;
    
    // 显示加载中状态
    commentsListElement.innerHTML = `
        <div class="text-center my-3">
            <div class="spinner-border spinner-border-sm text-secondary" role="status">
                <span class="visually-hidden">加载评论中...</span>
            </div>
        </div>
    `;
    
    try {
        // 从API获取评论
        const response = await fetch(`/api/blog/comments?postId=${currentPostId}&page=${page}&limit=10`);
        
        if (!response.ok) {
            throw new Error('加载评论失败');
        }
        
        const commentsData = await response.json();
        
        if (!commentsData.comments || commentsData.comments.length === 0) {
            commentsListElement.innerHTML = '<p class="text-muted">暂无评论，快来发表第一条评论吧！</p>';
            if (paginationElement) {
                paginationElement.innerHTML = '';
            }
            return;
        }
        
        // 渲染评论列表
        displayComments(commentsData.comments, commentsListElement);
        
        // 渲染分页
        if (paginationElement && commentsData.totalPages > 1) {
            renderPagination(page, commentsData.totalPages, paginationElement);
        } else if (paginationElement) {
            paginationElement.innerHTML = '';
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        commentsListElement.innerHTML = '<p class="text-danger">加载评论失败，请稍后再试。</p>';
    }
}

/**
 * 提交评论
 */
async function submitComment() {
    if (!currentPostId) {
        showNotification('错误', '无法提交评论：找不到文章ID', 'danger');
        return;
    }
    
    const nameInput = document.getElementById('comment-name');
    const emailInput = document.getElementById('comment-email');
    const contentInput = document.getElementById('comment-content');
    const submitButton = document.querySelector('#comment-form button[type="submit"]');
    
    if (!nameInput || !emailInput || !contentInput || !submitButton) {
        return;
    }
    
    // 表单验证
    if (!nameInput.value.trim()) {
        showNotification('错误', '请输入您的昵称', 'danger');
        nameInput.focus();
        return;
    }
    
    if (!emailInput.value.trim() || !isValidEmail(emailInput.value.trim())) {
        showNotification('错误', '请输入有效的邮箱地址', 'danger');
        emailInput.focus();
        return;
    }
    
    if (!contentInput.value.trim()) {
        showNotification('错误', '请输入评论内容', 'danger');
        contentInput.focus();
        return;
    }
    
    // 禁用提交按钮，防止重复提交
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        提交中...
    `;
    
    // 准备评论数据
    const commentData = {
        postId: currentPostId,
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        content: contentInput.value.trim(),
        date: new Date().toISOString()
    };
    
    try {
        // 发送评论到API
        const response = await fetch('/api/blog/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentData)
        });
        
        if (!response.ok) {
            throw new Error('提交评论失败');
        }
        
        // 清空表单
        nameInput.value = '';
        emailInput.value = '';
        contentInput.value = '';
        
        // 显示成功消息
        showNotification('成功', '评论已提交，正在等待审核', 'success');
        
        // 重新加载评论列表
        loadComments();
    } catch (error) {
        console.error('提交评论失败:', error);
        showNotification('错误', '提交评论失败，请稍后再试', 'danger');
    } finally {
        // 恢复提交按钮
        submitButton.disabled = false;
        submitButton.textContent = '提交评论';
    }
}

/**
 * 显示评论列表
 * @param {Array} comments - 评论数据数组
 * @param {HTMLElement} container - 容器元素
 */
function displayComments(comments, container) {
    if (!comments || !container) return;
    
    container.innerHTML = '';
    
    // 创建评论列表
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list-inner';
    
    comments.forEach(comment => {
        const commentDate = formatDate(new Date(comment.date));
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-item';
        commentElement.innerHTML = `
            <div class="comment-header">
                <div class="comment-author">${comment.name}</div>
                <div class="comment-date text-muted">${commentDate}</div>
            </div>
            <div class="comment-content">${comment.content}</div>
        `;
        commentsList.appendChild(commentElement);
    });
    
    container.appendChild(commentsList);
}

/**
 * 渲染分页
 * @param {number} currentPage - 当前页码
 * @param {number} totalPages - 总页数
 * @param {HTMLElement} container - 容器元素
 */
function renderPagination(currentPage, totalPages, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    const pagination = document.createElement('nav');
    pagination.setAttribute('aria-label', '评论分页');
    
    const pageList = document.createElement('ul');
    pageList.className = 'pagination pagination-sm justify-content-center';
    
    // 添加"上一页"按钮
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '&laquo;';
    
    if (currentPage > 1) {
        prevLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadComments(currentPage - 1);
        });
    }
    
    prevItem.appendChild(prevLink);
    pageList.appendChild(prevItem);
    
    // 页码按钮
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4 && startPage > 1) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        
        if (i !== currentPage) {
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                loadComments(i);
            });
        }
        
        pageItem.appendChild(pageLink);
        pageList.appendChild(pageItem);
    }
    
    // 添加"下一页"按钮
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '&raquo;';
    
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadComments(currentPage + 1);
        });
    }
    
    nextItem.appendChild(nextLink);
    pageList.appendChild(nextItem);
    
    pagination.appendChild(pageList);
    container.appendChild(pagination);
}

/**
 * 显示通知消息
 * @param {string} title - 消息标题
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型（success, danger, warning, info）
 */
function showNotification(title, message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-header">
            <strong>${title}</strong>
            <button type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <div class="notification-body">${message}</div>
    `;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 添加动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 添加关闭按钮事件
    const closeButton = notification.querySelector('.btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            closeNotification(notification);
        });
    }
    
    // 自动关闭（5秒后）
    setTimeout(() => {
        closeNotification(notification);
    }, 5000);
}

/**
 * 关闭通知
 * @param {HTMLElement} notification - 通知元素
 */
function closeNotification(notification) {
    notification.classList.remove('show');
    
    // 动画结束后移除元素
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

/**
 * 验证邮箱地址
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
} 