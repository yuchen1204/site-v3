// 博客文章详情页面脚本

document.addEventListener('DOMContentLoaded', function() {
    initializeThemeToggle(); // 初始化主题切换按钮
    initializeSidebar(); // 初始化侧边栏
    loadPostDetails(); // 加载文章详情
    initializeCommentsSection(); // 初始化评论区
});

// 跟踪数据来源
let blogDataSource = '';
// 当前文章ID
let currentPostId = null;
// 评论分页
let commentPage = 1;
const commentsPerPage = 5;
let hasMoreComments = false;

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
    currentPostId = postId; // 保存当前文章ID
    
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
        
        // 加载评论
        loadComments(postId);
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
            
            // 加载评论
            loadComments(postId);
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
 * 加载文章的评论
 * @param {number} postId - 文章ID
 * @param {boolean} append - 是否追加而不是替换评论
 */
async function loadComments(postId, append = false) {
    if (!postId) return;
    
    const commentsLoading = document.getElementById('comments-loading');
    const noCommentsMessage = document.getElementById('no-comments-message');
    const commentsList = document.getElementById('comments-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!append) {
        // 重置评论区状态
        commentsLoading.classList.remove('d-none');
        noCommentsMessage.classList.add('d-none');
        // 重置分页
        commentPage = 1;
        // 只保留加载提示和无评论提示
        while (commentsList.children.length > 2) {
            commentsList.removeChild(commentsList.lastChild);
        }
    }
    
    try {
        const response = await fetch(`/api/comments/${postId}?page=${commentPage}&limit=${commentsPerPage}`);
        
        if (!response.ok) {
            throw new Error('加载评论失败');
        }
        
        const data = await response.json();
        const comments = data.comments || [];
        const total = data.total || 0;
        
        // 更新评论计数
        document.getElementById('comments-count').textContent = total;
        
        // 隐藏加载中提示
        commentsLoading.classList.add('d-none');
        
        if (comments.length === 0 && !append) {
            // 没有评论且不是加载更多操作
            noCommentsMessage.classList.remove('d-none');
            loadMoreContainer.classList.add('d-none');
        } else {
            noCommentsMessage.classList.add('d-none');
            
            // 渲染评论
            comments.forEach(comment => {
                const commentElement = createCommentElement(comment);
                commentsList.appendChild(commentElement);
            });
            
            // 判断是否还有更多评论
            hasMoreComments = comments.length >= commentsPerPage && (commentPage * commentsPerPage) < total;
            if (hasMoreComments) {
                loadMoreContainer.classList.remove('d-none');
            } else {
                loadMoreContainer.classList.add('d-none');
            }
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        commentsLoading.classList.add('d-none');
        
        // 显示加载错误消息
        const errorElement = document.createElement('div');
        errorElement.className = 'alert alert-danger';
        errorElement.textContent = '加载评论时出错，请稍后再试';
        commentsList.appendChild(errorElement);
    }
}

/**
 * 创建评论元素
 * @param {Object} comment - 评论数据
 * @returns {HTMLElement} 评论DOM元素
 */
function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item';
    commentElement.dataset.id = comment.id;
    
    const commentDate = comment.createdAt ? formatDate(new Date(comment.createdAt)) : '未知时间';
    
    commentElement.innerHTML = `
        <div class="comment-header">
            <span class="commenter-name">${escapeHTML(comment.name)}</span>
            <span class="comment-date">${commentDate}</span>
        </div>
        <div class="comment-content">${escapeHTML(comment.content)}</div>
    `;
    
    return commentElement;
}

/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的安全文本
 */
function escapeHTML(text) {
    if (!text) return '';
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 提交评论
 * @param {Event} event - 表单提交事件
 */
async function submitComment(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('commenter-name');
    const contentInput = document.getElementById('comment-content');
    const submitButton = document.querySelector('.submit-comment-btn');
    
    // 获取输入值并验证
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!name || !content) {
        alert('请填写昵称和评论内容');
        return;
    }
    
    // 禁用提交按钮防止重复提交
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        提交中...
    `;
    
    try {
        const response = await fetch('/api/comments/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                postId: currentPostId,
                name,
                content
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '提交评论失败');
        }
        
        // 重置表单
        nameInput.value = '';
        contentInput.value = '';
        
        // 重新加载评论
        loadComments(currentPostId);
        
        // 显示成功消息
        alert('评论提交成功！');
    } catch (error) {
        console.error('提交评论失败:', error);
        alert('提交评论失败: ' + error.message);
    } finally {
        // 恢复提交按钮
        submitButton.disabled = false;
        submitButton.textContent = '提交评论';
    }
}

/**
 * 加载更多评论
 */
function loadMoreComments() {
    if (!hasMoreComments) return;
    
    commentPage++;
    loadComments(currentPostId, true);
}

/**
 * 初始化评论区事件监听
 */
function initializeCommentsSection() {
    // 评论表单提交
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', submitComment);
    }
    
    // 加载更多评论按钮
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreComments);
    }
    
    // 从localStorage恢复上次填写的昵称
    const savedName = localStorage.getItem('commenter-name');
    if (savedName) {
        const nameInput = document.getElementById('commenter-name');
        if (nameInput) nameInput.value = savedName;
    }
    
    // 保存用户填写的昵称到localStorage
    const nameInput = document.getElementById('commenter-name');
    if (nameInput) {
        nameInput.addEventListener('blur', function() {
            const name = this.value.trim();
            if (name) {
                localStorage.setItem('commenter-name', name);
            }
        });
    }
} 