// 博客文章详情页面脚本

document.addEventListener('DOMContentLoaded', function() {
    initializeThemeToggle(); // 初始化主题切换按钮
    initializeSidebar(); // 初始化侧边栏
    loadPostDetails(); // 加载文章详情
});

// 跟踪数据来源
let blogDataSource = '';

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
            <!-- 引用区域容器，将在这里插入 -->
            <div id="references-container"></div>
            <!-- 评论区容器，将在这里插入 -->
            <div id="comments-section-container"></div>
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

    // --- 新增：加载评论区 --- 
    loadCommentsSection(post.id);
}

/**
 * 加载评论区（包括表单和列表）
 * @param {number} postId - 文章ID
 */
async function loadCommentsSection(postId) {
    const commentsContainer = document.getElementById('comments-section-container');
    if (!commentsContainer) return;

    // 1. 插入评论区HTML结构 (表单 + 列表容器)
    commentsContainer.innerHTML = `
        <section class="comments-section" id="comments-section">
            <h3 class="comments-title">评论区</h3>
            
            <!-- 评论表单 -->
            <div class="comment-form-container">
                <form id="comment-form">
                    <div class="mb-3">
                        <label for="comment-name" class="form-label">昵称</label>
                        <input type="text" class="form-control" id="comment-name" name="name" required maxlength="50">
                    </div>
                    <div class="mb-3">
                        <label for="comment-text" class="form-label">评论内容</label>
                        <textarea class="form-control" id="comment-text" name="text" rows="4" required maxlength="1000"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary comment-submit-btn" id="comment-submit-btn">提交评论</button>
                    <div id="comment-error" class="mt-2 text-danger" style="display: none;"></div>
                </form>
            </div>
            
            <!-- 评论列表 -->
            <h4 class="comment-list-title">评论列表</h4>
            <div class="comment-list" id="comment-list">
                <p id="comments-loading">正在加载评论...</p>
                <!-- 评论将动态加载到这里 -->
            </div>
        </section>
    `;

    // 2. 添加表单提交事件监听器
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', (event) => handleCommentSubmit(event, postId));
    }

    // 3. 加载现有评论
    await loadComments(postId);
}

/**
 * 加载文章评论
 * @param {number} postId - 文章ID
 */
async function loadComments(postId) {
    const commentListContainer = document.getElementById('comment-list');
    const loadingIndicator = document.getElementById('comments-loading');
    if (!commentListContainer || !loadingIndicator) return;

    try {
        const response = await fetch(`/api/comments/${postId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const comments = await response.json();

        loadingIndicator.style.display = 'none'; // 隐藏加载提示
        commentListContainer.innerHTML = ''; // 清空现有内容（或加载提示）

        if (comments.length === 0) {
            commentListContainer.innerHTML = '<p>暂无评论，快来抢沙发吧！</p>';
        } else {
            comments.forEach(comment => {
                const commentElement = createCommentElement(comment);
                commentListContainer.appendChild(commentElement);
            });
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        loadingIndicator.style.display = 'none';
        commentListContainer.innerHTML = '<p class="text-danger">加载评论时出错，请稍后重试。</p>';
    }
}

/**
 * 处理评论表单提交
 * @param {Event} event - 表单提交事件
 * @param {number} postId - 文章ID
 */
async function handleCommentSubmit(event, postId) {
    event.preventDefault(); // 阻止表单默认提交行为

    const form = event.target;
    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const submitButton = document.getElementById('comment-submit-btn');
    const errorContainer = document.getElementById('comment-error');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    // 简单的前端验证
    if (!name || !text) {
        showCommentError('昵称和评论内容都不能为空');
        return;
    }

    // 禁用按钮，防止重复提交
    submitButton.disabled = true;
    submitButton.textContent = '提交中...';
    hideCommentError();

    try {
        const response = await fetch(`/api/comments/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, text })
        });

        if (!response.ok) {
            // 尝试读取错误信息
            let errorData = { message: `提交失败，状态码: ${response.status}` };
            try {
                const errorJson = await response.json();
                errorData.message = errorJson.error || errorData.message;
            } catch (e) { /* 忽略JSON解析错误 */ }
            throw new Error(errorData.message);
        }

        const newComment = await response.json();

        // 在评论列表顶部添加新评论
        const commentListContainer = document.getElementById('comment-list');
        const newCommentElement = createCommentElement(newComment);
        
        // 如果之前是"暂无评论"，先清空
        const noCommentMsg = commentListContainer.querySelector('p');
        if(noCommentMsg && noCommentMsg.textContent.includes('暂无评论')) {
            commentListContainer.innerHTML = '';
        }
        commentListContainer.insertBefore(newCommentElement, commentListContainer.firstChild);

        // 清空表单
        form.reset();

    } catch (error) {
        console.error('提交评论失败:', error);
        showCommentError(`提交评论出错: ${error.message}`);
    } finally {
        // 重新启用按钮
        submitButton.disabled = false;
        submitButton.textContent = '提交评论';
    }
}

/**
 * 创建单个评论的HTML元素
 * @param {object} comment - 评论数据对象 { id, name, text, timestamp }
 * @returns {HTMLElement} - 代表评论的div元素
 */
function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    commentDiv.id = `comment-${comment.id}`;

    // 简单的HTML转义 (虽然后端也做了，前端再做一层保险)
    const safeName = comment.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeText = comment.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>'); // 换行符转为<br>

    commentDiv.innerHTML = `
        <div class="comment-item-header">
            <span class="comment-author">${safeName}</span>
            <span class="comment-date">${formatCommentTimestamp(comment.timestamp)}</span>
        </div>
        <p class="comment-text">${safeText}</p>
    `;
    return commentDiv;
}

/**
 * 格式化评论时间戳
 * @param {number} timestamp - Unix时间戳 (毫秒)
 * @returns {string} - 格式化后的日期时间字符串
 */
function formatCommentTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute:'2-digit' 
    });
}

/**
 * 显示评论表单错误信息
 * @param {string} message - 错误信息
 */
function showCommentError(message) {
    const errorContainer = document.getElementById('comment-error');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
}

/**
 * 隐藏评论表单错误信息
 */
function hideCommentError() {
    const errorContainer = document.getElementById('comment-error');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

/**
 * 加载相关文章
 * @param {Array<number>} referenceIds - 相关文章的ID数组
 */
async function loadRelatedPosts(referenceIds) {
    // 早期返回条件
    if (!referenceIds || referenceIds.length === 0) return;
    
    // 获取引用容器 (现在我们使用专门的容器)
    const referencesContainer = document.getElementById('references-container');
    if (!referencesContainer) {
        console.error('找不到引用容器元素');
        return;
    }

    try {
        // 从JSON文件加载所有文章
        let allPosts = [];
        try {
            const response = await fetch('../data/blog.json');
            if (!response.ok) {
                throw new Error('JSON文件响应异常');
            }
            allPosts = await response.json();
        } catch (error) {
            console.error('加载文章数据失败:', error);
            return;
        }

        // 筛选相关文章
        const relatedPosts = allPosts.filter(post => referenceIds.includes(post.id));
        if (relatedPosts.length === 0) {
            console.log('未找到相关文章');
            return;
        }

        // 创建引用区域
        const referencesSection = document.createElement('div');
        referencesSection.className = 'blog-post-references';
        
        const referencesTitle = document.createElement('h5');
        referencesTitle.textContent = '引用与相关阅读:';
        referencesSection.appendChild(referencesTitle);

        const referenceList = document.createElement('ul');
        referenceList.className = 'reference-list';

        // 添加每篇相关文章
        relatedPosts.forEach(relatedPost => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            // 修正链接URL (确保与当前URL结构匹配)
            const baseUrl = window.location.pathname.includes('/blog/') 
                ? '' 
                : '/blog/';
            link.href = `${baseUrl}?id=${relatedPost.id}`; 
            link.textContent = relatedPost.title;
            link.className = 'reference-link';
            listItem.appendChild(link);
            referenceList.appendChild(listItem);
        });

        referencesSection.appendChild(referenceList);
        referencesContainer.appendChild(referencesSection);
        
        console.log(`已成功加载 ${relatedPosts.length} 篇相关文章`);
    } catch (error) {
        console.error('加载相关文章时出错:', error);
    }
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 * @param {HTMLElement} container - 显示错误的容器元素
 */
function showError(message, container) {
    if (container) {
        container.innerHTML = `<p class="text-danger">${message}</p>`;
    }
}

/**
 * 更新数据来源指示器
 */
function updateDataSourceIndicator() {
    const indicator = document.getElementById('data-source-indicator');
    if (indicator) {
        let sourceText = '';
        if (blogDataSource === 'kv') {
            sourceText = '数据源: KV';
        } else if (blogDataSource === 'json') {
            sourceText = '数据源: JSON';
        } else {
            sourceText = '数据源: 未知';
        }
        indicator.textContent = sourceText;
        indicator.style.display = 'inline'; // 确保它可见
    }
}

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期字符串 (YYYY-MM-DD)
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return ''; // 如果日期无效，返回空字符串
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 图标SVG字符串 (保持不变)
const sunIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
`;

const moonIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
`; 