document.addEventListener('DOMContentLoaded', () => {
    loadBlogPost();
});

/**
 * 从 URL 获取文章 ID
 * @returns {string | null} 文章 ID 或 null
 */
function getPostIdFromUrl() {
    // 假设 URL 结构为 /blog/[id] 或 /blog-post.html?id=[id]
    // 优先检查路径段
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 2] === 'blog') {
        const potentialId = pathSegments[pathSegments.length - 1];
        if (/^\d+$/.test(potentialId)) { // 检查是否是纯数字
            return potentialId;
        }
    }
    
    // 如果路径不匹配，检查 URL 查询参数
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/**
 * 加载并显示博客文章
 */
async function loadBlogPost() {
    const postId = getPostIdFromUrl();
    const container = document.getElementById('blog-post-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorIndicator = document.getElementById('error-indicator');
    const titleEl = document.getElementById('post-title');
    const dateEl = document.getElementById('post-date');
    const categoryEl = document.getElementById('post-category');
    const contentEl = document.getElementById('post-content');
    const attachmentsEl = document.getElementById('post-attachments');
    const referencesEl = document.getElementById('post-references');

    if (!postId) {
        showError('未找到文章 ID。');
        return;
    }

    if (!container || !loadingIndicator || !errorIndicator || !titleEl || !dateEl || !categoryEl || !contentEl || !attachmentsEl || !referencesEl) {
        console.error('页面缺少必要的元素。');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/blog/${postId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || `HTTP 错误: ${response.status}`);
        }
        const post = await response.json();

        // 更新页面标题
        document.title = `${post.title} | 博客文章`;

        // 填充文章数据
        titleEl.textContent = post.title;
        dateEl.textContent = new Date(post.date).toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' });
        categoryEl.textContent = post.category;
        
        // 渲染 Markdown 内容并进行安全过滤
        if (post.content && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            const unsafeHTML = marked.parse(post.content);
            contentEl.innerHTML = DOMPurify.sanitize(unsafeHTML);
        } else {
            contentEl.textContent = post.content || ''; // Fallback for plain text
        }

        // 渲染附件
        renderAttachments(attachmentsEl, post.attachments);

        // 渲染引用
        renderReferences(referencesEl, post.references);

        showContent();

    } catch (error) {
        console.error('加载文章失败:', error);
        showError(`加载文章失败: ${error.message}`);
    }
}

/**
 * 渲染附件列表
 * @param {HTMLElement} container 
 * @param {Array} attachments 
 */
function renderAttachments(container, attachments) {
    container.innerHTML = ''; // 清空旧内容
    if (!attachments || attachments.length === 0) return;

    const title = document.createElement('h5');
    title.textContent = '附件';
    container.appendChild(title);

    attachments.forEach(att => {
        const link = document.createElement('a');
        link.href = att.url;
        link.className = 'attachment-link';
        link.target = '_blank'; // 在新标签页打开
        link.rel = 'noopener noreferrer'; // 安全性
        
        // 添加图标（基于类型）
        const icon = document.createElement('i');
        icon.className = 'bi attachment-icon ';
        switch (att.type?.toLowerCase()) {
            case 'image': icon.classList.add('bi-image'); break;
            case 'pdf': icon.classList.add('bi-file-earmark-pdf'); break;
            case 'zip': icon.classList.add('bi-file-earmark-zip'); break;
            case 'doc':
            case 'docx': icon.classList.add('bi-file-earmark-word'); break;
            case 'xls':
            case 'xlsx': icon.classList.add('bi-file-earmark-excel'); break;
            case 'ppt':
            case 'pptx': icon.classList.add('bi-file-earmark-ppt'); break;
            default: icon.classList.add('bi-file-earmark-arrow-down');
        }
        link.appendChild(icon);
        
        link.appendChild(document.createTextNode(att.filename || '下载附件'));
        container.appendChild(link);
    });
}

/**
 * 渲染引用列表
 * @param {HTMLElement} container 
 * @param {Array<number>} references 
 */
function renderReferences(container, references) {
    container.innerHTML = ''; // 清空旧内容
    if (!references || references.length === 0) return;

    const title = document.createElement('h5');
    title.textContent = '相关文章';
    container.appendChild(title);

    references.forEach(refId => {
        const link = document.createElement('a');
        // 假设链接结构为 /blog/{id}
        link.href = `/blog/${refId}`; 
        link.className = 'reference-link';
        link.textContent = `文章 #${refId}`;
        // TODO: 可以考虑异步获取引用文章的标题来显示
        container.appendChild(link);
    });
}

// --- UI Helper Functions --- 

function showLoading() {
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('error-indicator').style.display = 'none';
    document.getElementById('post-title').style.display = 'none';
    document.getElementById('post-date').parentElement.style.display = 'none';
    document.getElementById('post-content').style.display = 'none';
    document.getElementById('post-attachments').style.display = 'none';
    document.getElementById('post-references').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading-indicator').style.display = 'none';
    const errorIndicator = document.getElementById('error-indicator');
    errorIndicator.textContent = message;
    errorIndicator.style.display = 'block';
}

function showContent() {
    document.getElementById('loading-indicator').style.display = 'none';
    document.getElementById('error-indicator').style.display = 'none';
    document.getElementById('post-title').style.display = 'block';
    document.getElementById('post-date').parentElement.style.display = 'block';
    document.getElementById('post-content').style.display = 'block';
    document.getElementById('post-attachments').style.display = 'block'; // 即使为空也显示容器
    document.getElementById('post-references').style.display = 'block'; // 即使为空也显示容器
} 