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
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const currentTheme = localStorage.getItem('theme');
    const themeToggleButton = document.getElementById('theme-toggle');
    
    // 设置初始主题
    if (currentTheme) {
        document.body.className = currentTheme;
    } else {
        document.body.className = prefersDarkScheme.matches ? 'dark-theme' : 'light-theme';
    }
    
    // 切换主题按钮事件
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const newTheme = document.body.classList.contains('light-theme') ? 'dark-theme' : 'light-theme';
            setTheme(newTheme);
        });
    }
}

/**
 * 设置主题并保存到本地存储
 * @param {string} theme - 主题名称 ('light-theme' 或 'dark-theme')
 */
function setTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
}

/**
 * 初始化侧边栏功能
 */
function initializeSidebar() {
    const sidebarToggleButton = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const body = document.body;

    // 侧边栏切换按钮事件
    if (sidebarToggleButton && sidebar && body) {
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