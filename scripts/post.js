document.addEventListener('DOMContentLoaded', () => {
    const postId = getPostIdFromUrl();

    if (postId) {
        fetchAndDisplayPost(postId);
    } else {
        displayError('无效的文章链接。');
        hideLoading();
    }

    setupShareButton();
});

/**
 * 从 URL 路径中提取文章 ID
 * 例如：/blog/12345 -> 12345
 * @returns {number | null} 文章 ID 或 null
 */
function getPostIdFromUrl() {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && pathSegments[0] === 'blog') {
        const id = parseInt(pathSegments[1], 10);
        return isNaN(id) ? null : id;
    }
    return null;
}

/**
 * 获取并显示文章数据
 * @param {number} postId 
 */
async function fetchAndDisplayPost(postId) {
    showLoading();
    hideError();

    try {
        // 注意：这里调用的是公共 API 端点，不是 /admin/api/...
        const response = await fetch(`/api/blog/post/${postId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('找不到指定的文章。');
            } else {
                throw new Error(`获取文章数据失败 (状态码: ${response.status})`);
            }
        }

        const post = await response.json();
        displayPost(post);

    } catch (error) {
        console.error('获取或显示文章时出错:', error);
        displayError(error.message);
    } finally {
        hideLoading();
    }
}

/**
 * 将文章数据显示在页面上
 * @param {object} post 文章数据对象
 */
function displayPost(post) {
    const contentArea = document.getElementById('post-content-area');
    const titleEl = document.getElementById('post-title');
    const categoryEl = document.getElementById('post-category');
    const dateEl = document.getElementById('post-date');
    const bodyEl = document.getElementById('post-body');
    const attachmentsSection = document.getElementById('post-attachments');
    const attachmentsListEl = document.getElementById('post-attachments-list');
    const referencesSection = document.getElementById('post-references');
    const referencesListEl = document.getElementById('post-references-list');

    if (!contentArea || !titleEl || !categoryEl || !dateEl || !bodyEl || 
        !attachmentsSection || !attachmentsListEl || !referencesSection || !referencesListEl)
    {
        console.error('缺少必要的页面元素。');
        displayError('页面结构错误，无法显示文章。');
        return;
    }

    // 更新页面标题
    document.title = post.title || '博客文章';

    // 填充基本信息
    titleEl.textContent = post.title;
    categoryEl.textContent = post.category;
    categoryEl.href = `/?category=${encodeURIComponent(post.category)}`; // 链接回主页分类
    dateEl.textContent = new Date(post.date).toLocaleString('zh-CN', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });

    // 渲染 Markdown 内容并净化
    if (post.content && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
         const dirtyHtml = marked.parse(post.content);
         bodyEl.innerHTML = DOMPurify.sanitize(dirtyHtml);
    } else if (post.content) {
        // Fallback to plain text if libraries are missing
         bodyEl.textContent = post.content;
    } else {
        bodyEl.textContent = '';
    }

    // 显示附件
    attachmentsListEl.innerHTML = ''; // 清空旧列表
    if (post.attachments && post.attachments.length > 0) {
        post.attachments.forEach(att => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = att.url;
            link.target = '_blank'; // 在新标签页打开
            link.rel = 'noopener noreferrer';
            
            // 根据类型添加图标
            let iconClass = 'bi-file-earmark';
            if (att.type === 'image') iconClass = 'bi-file-earmark-image';
            else if (att.type === 'pdf') iconClass = 'bi-file-earmark-pdf';
            else if (att.type === 'zip') iconClass = 'bi-file-earmark-zip';

            link.innerHTML = `<i class="bi ${iconClass} me-2"></i>${escapeHTML(att.filename || '下载附件')}`;
            li.appendChild(link);
            attachmentsListEl.appendChild(li);
        });
        attachmentsSection.style.display = 'block';
    } else {
        attachmentsSection.style.display = 'none';
    }

    // 显示引用链接
    referencesListEl.innerHTML = ''; // 清空旧列表
    if (post.references && post.references.length > 0) {
        post.references.forEach(refId => {
            const li = document.createElement('li');
            // TODO: Ideally, fetch reference titles here for better UX
            // For now, just link to the post
            const link = document.createElement('a');
            link.href = `/blog/${refId}`;
            link.innerHTML = `<i class="bi bi-link-45deg me-2"></i> 相关文章 ID: ${refId}`;
            li.appendChild(link);
            referencesListEl.appendChild(li);
        });
         referencesSection.style.display = 'block';
    } else {
        referencesSection.style.display = 'none';
    }

    // 显示内容区域
    contentArea.style.display = 'block';
}

function showLoading() {
    const loadingEl = document.getElementById('post-loading');
    if (loadingEl) loadingEl.style.display = 'block';
}

function hideLoading() {
     const loadingEl = document.getElementById('post-loading');
    if (loadingEl) loadingEl.style.display = 'none';
}

function displayError(message) {
    const errorEl = document.getElementById('post-error');
    if (errorEl) {
        errorEl.textContent = message || '加载文章时出错。';
        errorEl.style.display = 'block';
    }
     // 隐藏文章内容区，以防部分加载
    const contentArea = document.getElementById('post-content-area');
    if(contentArea) contentArea.style.display = 'none';
}

function hideError() {
    const errorEl = document.getElementById('post-error');
    if (errorEl) errorEl.style.display = 'none';
}

/**
 * 设置复制链接按钮的功能
 */
function setupShareButton() {
    const copyButton = document.getElementById('share-link-copy');
    if (copyButton) {
        copyButton.addEventListener('click', (e) => {
            e.preventDefault();
            const urlToCopy = window.location.href;
            navigator.clipboard.writeText(urlToCopy).then(() => {
                // 提示用户已复制 (可以用 Tooltip 或短暂改变按钮文本)
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="bi bi-check-lg"></i> 已复制!';
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('无法复制链接:', err);
                alert('无法自动复制链接，请手动复制。');
            });
        });
    }
}

/**
 * 简单的 HTML 转义函数 (与 dashboard.js 中的相同)
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
