// 自定义脚本 

/**
 * 从JSON文件加载个人资料数据
 */
document.addEventListener('DOMContentLoaded', function() {
    loadProfileData();
    loadBlogPosts();
    initializeThemeToggle(); // 初始化主题切换按钮
    initializeBlogCategories();
    initializeSidebar(); // 更新调用
});

/**
 * 从KV数据库或JSON文件加载个人资料数据
 */
function loadProfileData() {
    // 先尝试从KV数据库加载
    fetch('/api/profile')
        .then(response => {
            if (!response.ok) {
                throw new Error('KV数据库响应异常');
            }
            return response.json();
        })
        .then(data => {
            profileDataSource = 'kv';
            updateDataSourceIndicator();
            displayProfileData(data);
        })
        .catch(error => {
            console.warn('从KV数据库加载个人资料失败，尝试从JSON文件加载:', error);
            
            // 如果从KV加载失败，则从本地JSON文件加载
            fetch('data/profile.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('JSON文件响应异常');
                    }
                    return response.json();
                })
                .then(data => {
                    profileDataSource = 'json';
                    updateDataSourceIndicator();
                    displayProfileData(data);
                })
                .catch(error => {
                    console.error('加载个人资料数据失败:', error);
                    displayError();
                });
        });
}

/**
 * 显示个人资料数据
 * @param {Object} profileData - 个人资料数据
 */
function displayProfileData(profileData) {
    // 设置头像
    const avatarElement = document.getElementById('avatar');
    if (avatarElement && profileData.avatar) {
        avatarElement.src = profileData.avatar;
    }
    
    // 设置名字
    const nameElement = document.getElementById('name');
    if (nameElement && profileData.name) {
        nameElement.textContent = profileData.name;
    }
    
    // 设置座右铭
    const mottoElement = document.getElementById('motto');
    if (mottoElement && profileData.motto) {
        mottoElement.textContent = profileData.motto;
    }

    // 设置社交链接
    if (profileData.socialLinks) {
        displaySocialLinks(profileData.socialLinks);
    }
}

/**
 * 显示社交链接
 * @param {Array} socialLinks - 社交链接数据数组
 */
function displaySocialLinks(socialLinks) {
    const socialLinksContainer = document.getElementById('social-links');
    if (!socialLinksContainer || !socialLinks || !socialLinks.length) return;

    // 清空容器
    socialLinksContainer.innerHTML = '';

    // 遍历社交链接数据并创建链接元素
    socialLinks.forEach(link => {
        if (!link.url || !link.platform) return;

        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.target = '_blank'; // 在新标签页中打开链接
        linkElement.rel = 'noopener noreferrer'; // 安全设置
        linkElement.className = 'social-link';
        
        // 创建图标元素
        if (link.icon) {
            const iconElement = document.createElement('img');
            iconElement.src = link.icon;
            iconElement.alt = `${link.platform} 图标`;
            linkElement.appendChild(iconElement);
        }
        
        // 创建文本元素
        const textElement = document.createElement('span');
        textElement.className = 'social-link-text';
        textElement.textContent = link.platform;
        linkElement.appendChild(textElement);
        
        // 添加到容器
        socialLinksContainer.appendChild(linkElement);
    });
}

/**
 * 显示错误信息
 */
function displayError() {
    const profileContainer = document.querySelector('.profile-container');
    if (profileContainer) {
        profileContainer.innerHTML = '<div class="alert alert-danger" role="alert">加载个人资料数据失败，请刷新页面重试。</div>';
    }
}

// 全局变量或特定作用域变量
let currentPage = 1;
const postsPerPage = 5;
let currentCategory = 'all'; // 跟踪当前选中的分类

// 跟踪数据来源
let profileDataSource = '';
let blogDataSource = '';

/**
 * 初始化博客分类筛选
 */
function initializeBlogCategories() {
    const categoryLinks = document.querySelectorAll('.blog-category-item');

    categoryLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            categoryLinks.forEach(item => {
                item.classList.remove('active');
            });
            
            this.classList.add('active');
            
            currentCategory = this.getAttribute('data-category');
            currentPage = 1; // 切换分类时重置到第一页
            filterBlogPosts(currentCategory);
        });
    });
}

/**
 * 根据分类筛选博客文章
 * @param {string} category - 分类名称
 */
function filterBlogPosts(category) {
    if (!window.cachedBlogPosts) {
        // 如果还没有缓存数据，则加载数据并让加载函数处理初始显示
        loadBlogPosts(); 
        return;
    }
    
    const allPosts = window.cachedBlogPosts;
    
    let filteredPosts;
    if (category === 'all') {
        filteredPosts = allPosts;
    } else {
        filteredPosts = allPosts.filter(post => post.category === category);
    }
    
    // 显示第一页筛选结果
    displayBlogPosts(filteredPosts);
}

/**
 * 从KV数据库或JSON文件加载博客文章数据
 */
function loadBlogPosts() {
    // 显示加载中状态
    const blogPostsContainer = document.getElementById('blog-posts');
    if (blogPostsContainer) {
        blogPostsContainer.innerHTML = `
            <div class="text-center my-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
            </div>
        `;
    }

    // 先尝试从KV数据库加载
    fetch('/api/blog')
        .then(response => {
            if (!response.ok) {
                throw new Error('KV数据库响应异常');
            }
            return response.json();
        })
        .then(data => {
            blogDataSource = 'kv';
            updateDataSourceIndicator();
            window.cachedBlogPosts = data; // 缓存所有文章
            currentPage = 1; // 重置到第一页
            filterBlogPosts(currentCategory); // 根据当前选中的分类显示文章
        })
        .catch(error => {
            console.warn('从KV数据库加载博客文章失败，尝试从JSON文件加载:', error);
            
            // 如果从KV加载失败，则从本地JSON文件加载
            fetch('data/blog.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('JSON文件响应异常');
                    }
                    return response.json();
                })
                .then(data => {
                    blogDataSource = 'json';
                    updateDataSourceIndicator();
                    window.cachedBlogPosts = data; // 缓存所有文章
                    currentPage = 1; // 重置到第一页
                    filterBlogPosts(currentCategory); // 根据当前选中的分类显示文章
                })
                .catch(error => {
                    console.error('加载博客文章数据失败:', error);
                    displayBlogError();
                });
        });
}

/**
 * 更新数据源指示器
 */
function updateDataSourceIndicator() {
    const indicator = document.getElementById('data-source-indicator');
    const dot = indicator.querySelector('.data-source-dot');
    const text = indicator.querySelector('.data-source-text');
    
    if (!indicator || !dot || !text) return;
    
    // 清除现有的类
    dot.classList.remove('json-source', 'kv-source');
    
    // 根据数据来源添加对应的类和文本
    if (profileDataSource === 'kv' && blogDataSource === 'kv') {
        dot.classList.add('kv-source');
        text.textContent = 'KV 数据源';
    } else if (profileDataSource === 'json' && blogDataSource === 'json') {
        dot.classList.add('json-source');
        text.textContent = 'JSON 数据源';
    } else if (profileDataSource && blogDataSource) {
        // 两种数据源都已加载但不同
        if (blogDataSource === 'kv') {
            // 博客数据优先显示
            dot.classList.add('kv-source');
            text.textContent = '混合数据源(偏KV)';
        } else {
            dot.classList.add('json-source');
            text.textContent = '混合数据源(偏JSON)';
        }
    } else {
        // 只有一种数据源已加载
        if (profileDataSource) {
            dot.classList.add(profileDataSource === 'kv' ? 'kv-source' : 'json-source');
            text.textContent = `仅个人资料(${profileDataSource.toUpperCase()})`;
        } else if (blogDataSource) {
            dot.classList.add(blogDataSource === 'kv' ? 'kv-source' : 'json-source');
            text.textContent = `仅博客(${blogDataSource.toUpperCase()})`;
        }
    }
    
    // 使指示器可见
    indicator.style.display = 'flex';
}

/**
 * 显示博客文章 (处理分页)
 * @param {Array} postsToShow - 当前分类/筛选下的所有文章数组
 */
function displayBlogPosts(postsToShow) {
    const blogPostsContainer = document.getElementById('blog-posts');
    if (!blogPostsContainer || !postsToShow) {
        displayBlogError();
        return;
    }

    blogPostsContainer.innerHTML = '';

    // 分页计算
    const totalPosts = postsToShow.length;
    const totalPages = Math.ceil(totalPosts / postsPerPage);
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const postsForCurrentPage = postsToShow.slice(startIndex, endIndex);

    if (postsForCurrentPage.length === 0) {
        blogPostsContainer.innerHTML = '<div class="alert alert-info" role="alert">没有找到符合当前分类的文章。</div>';
    } else {
        // 按日期降序排序当前页的文章
        postsForCurrentPage.sort((a, b) => new Date(b.date) - new Date(a.date));

        postsForCurrentPage.forEach(post => {
             if (!post.title || !post.content || !post.id) return;

            const postElement = document.createElement('div');
            postElement.className = 'blog-post collapsed'; 
            postElement.id = `blog-post-${post.id}`; 
            
            const postDate = post.date ? formatDate(new Date(post.date)) : '';
            
            const parsedContent = parseReferences(post.content, window.cachedBlogPosts || []);

            // 修改：添加链接到博客详情页
            const headerHTML = `
                <div class="blog-post-header">
                    <div class="blog-post-title-meta">
                        <h3 class="blog-post-title">
                            <a href="blog/index.html?id=${post.id}" class="blog-post-title-link">${post.title}</a>
                        </h3>
                        <div class="blog-post-meta">
                            <span class="blog-post-date">${postDate}</span>
                            ${post.category ? `<span class="blog-post-category">${post.category}</span>` : ''}
                        </div>
                    </div>
                    <span class="toggle-arrow">▼</span>
                </div>
            `;

            const bodyHTML = `
                <div class="blog-post-body">
                    <div class="blog-post-content">
                        ${parsedContent}
                    </div>
                    <div class="blog-post-read-more">
                        <a href="blog/index.html?id=${post.id}" class="read-more-link">阅读全文</a>
                    </div>
                </div>
            `;
            
            postElement.innerHTML = headerHTML + bodyHTML;
            const postBodyElement = postElement.querySelector('.blog-post-body');

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
                postBodyElement.appendChild(attachmentsContainer);
            }

            // 处理显式引用列表
            if (post.references && post.references.length > 0) {
                const referencesContainer = document.createElement('div');
                referencesContainer.className = 'blog-post-references';
                const referencesTitle = document.createElement('h5');
                referencesTitle.textContent = '相关文章:';
                referencesContainer.appendChild(referencesTitle);
                const referenceList = document.createElement('ul');
                referenceList.className = 'reference-list';
                post.references.forEach(refId => {
                    const referencedPost = findPostById(refId, window.cachedBlogPosts || []);
                    if (referencedPost) {
                        const listItem = document.createElement('li');
                        const link = document.createElement('a');
                        // 修改：链接到详情页而不是锚点
                        link.href = `blog/index.html?id=${refId}`;
                        link.textContent = referencedPost.title;
                        link.className = 'reference-link';
                        listItem.appendChild(link);
                        referenceList.appendChild(listItem);
                    }
                });
                referencesContainer.appendChild(referenceList);
                postBodyElement.appendChild(referencesContainer);
            }
            
            // 添加点击事件监听器到头部
            const headerElement = postElement.querySelector('.blog-post-header');
            if(headerElement){
                // 修改：阻止链接点击事件冒泡
                const titleLink = headerElement.querySelector('.blog-post-title-link');
                if (titleLink) {
                    titleLink.addEventListener('click', (e) => {
                        e.stopPropagation(); // 阻止事件冒泡
                    });
                }
                
                headerElement.addEventListener('click', () => {
                    postElement.classList.toggle('collapsed');
                });
            }

            blogPostsContainer.appendChild(postElement);
        });
    }

    // 渲染分页控件
    renderPaginationControls(totalPosts, totalPages);
}

/**
 * 渲染分页控件
 * @param {number} totalPosts - 当前筛选条件下的总文章数
 * @param {number} totalPages - 总页数
 */
function renderPaginationControls(totalPosts, totalPages) {
    const paginationContainer = document.getElementById('blog-pagination');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = ''; // 清空旧控件

    if (totalPages <= 1) {
        return; // 只有一页或没有文章时，不显示分页
    }

    // 创建"上一页"按钮
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.className = 'btn pagination-btn';
    if (currentPage === 1) {
        prevButton.disabled = true;
        prevButton.classList.add('disabled');
    }
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            filterBlogPosts(currentCategory); // 重新筛选并显示
             // 平滑滚动到博客区顶部
             document.getElementById('blog-posts').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    paginationContainer.appendChild(prevButton);

    // 创建页码指示（简单版）
    const pageIndicator = document.createElement('span');
    pageIndicator.className = 'page-indicator';
    pageIndicator.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
    paginationContainer.appendChild(pageIndicator);

    // 创建"下一页"按钮
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.className = 'btn pagination-btn';
    if (currentPage === totalPages) {
        nextButton.disabled = true;
        nextButton.classList.add('disabled');
    }
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            filterBlogPosts(currentCategory); // 重新筛选并显示
             // 平滑滚动到博客区顶部
             document.getElementById('blog-posts').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    paginationContainer.appendChild(nextButton);
}

/**
 * 解析文章内容中的引用标记
 * 将 {{post:123}} 格式的引用转换为链接
 * @param {string} content - 文章内容
 * @param {Array} allPosts - 所有文章数据
 * @returns {string} 解析后的内容
 */
function parseReferences(content, allPosts) {
    if (!content || !allPosts) return content;
    
    // 匹配 {{post:数字}} 格式的引用
    return content.replace(/\{\{post:(\d+)\}\}/g, (match, id) => {
        const postId = parseInt(id, 10);
        const post = findPostById(postId, allPosts);
        
        if (post) {
            // 修改：链接到详情页
            return `<a href="blog/index.html?id=${postId}" class="inline-reference">${post.title}</a>`;
        }
        
        return match; // 如果找不到引用的文章，保留原始文本
    });
}

/**
 * 根据 ID 查找文章
 * @param {number} id - 文章 ID
 * @param {Array} posts - 文章数组
 * @returns {Object | null} - 找到的文章对象或 null
 */
function findPostById(id, posts) {
    return posts.find(post => post.id === id);
}

/**
 * 平滑滚动到指定 ID 的文章
 * @param {number} postId - 文章 ID
 */
function scrollToPost(postId) {
    const postElement = document.getElementById(`blog-post-${postId}`);
    if (postElement) {
        // 确保文章是展开状态
        postElement.classList.remove('collapsed'); 

        postElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        postElement.classList.add('highlight');
        setTimeout(() => {
            postElement.classList.remove('highlight');
        }, 1500); 
    }
}

/**
 * 显示博客加载错误信息
 */
function displayBlogError() {
    const blogPostsContainer = document.getElementById('blog-posts');
    if (blogPostsContainer) {
        blogPostsContainer.innerHTML = '<div class="alert alert-danger" role="alert">加载博客文章失败，请刷新页面重试。</div>';
    }
}

/**
 * 格式化日期为本地字符串
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期字符串
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '';
    }
    
    // 使用本地化格式显示日期和时间
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// SVG Icons
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-brightness-high-fill" viewBox="0 0 16 16">
<path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
</svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-moon-stars-fill" viewBox="0 0 16 16">
<path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/>
<path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162a1.73 1.73 0 0 0-1.097-1.097l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097z"/>
</svg>`;

/**
 * 初始化主题切换按钮
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
 * 初始化侧边栏
 */
function initializeSidebar() {
    initializeSidebarToggle();
    setupSidebarLinks(); // 新增：设置链接结构
}

/**
 * 设置侧边栏链接的内部结构
 * This function wraps the direct children (icon, text span) of .sidebar-link
 * into a new div with class .sidebar-link-content. This is needed for the 
 * dark mode gradient border effect where the link itself is the border 
 * and the content div provides the inner background.
 */
function setupSidebarLinks() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        // Check if content wrapper already exists to avoid duplication on potential re-runs/hot reloads
        if (link.querySelector('.sidebar-link-content')) {
            return;
        }
        // 创建内部容器 div.sidebar-link-content
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'sidebar-link-content';

        // 将原链接的所有子元素（图标<i>和文本<span>）移动到新容器中
        // Need to collect nodes first because moving them modifies the childNodes list
        const childNodesToMove = [];
        link.childNodes.forEach(node => childNodesToMove.push(node));
        
        childNodesToMove.forEach(node => contentWrapper.appendChild(node));

        // 将新容器添加到链接中
        link.appendChild(contentWrapper);
    });
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
            
            // (可选) 保存侧边栏状态到 localStorage
            if (body.classList.contains('sidebar-open')) {
                localStorage.setItem('sidebarState', 'open');
            } else {
                localStorage.setItem('sidebarState', 'closed');
            }
        });

        // (可选) 页面加载时恢复侧边栏状态
        const savedSidebarState = localStorage.getItem('sidebarState');
        if (savedSidebarState === 'open') {
            body.classList.add('sidebar-open');
        }
    }
} 