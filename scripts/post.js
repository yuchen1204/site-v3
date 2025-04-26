document.addEventListener('DOMContentLoaded', () => {
    loadPostData();
    
    // Set copyright year
    const yearSpan = document.getElementById('copyright-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});

// Helper function to get post ID from URL path /blog/{id}
function getPostIdFromUrl() {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && pathSegments[0] === 'blog') {
        const potentialId = parseInt(pathSegments[1], 10);
        return isNaN(potentialId) ? null : potentialId;
    }
    return null;
}

// Helper to get file type icon
function getIconForType(type) {
    switch (type.toLowerCase()) {
        case 'image': return 'bi-file-earmark-image';
        case 'pdf': return 'bi-file-earmark-pdf';
        case 'zip': return 'bi-file-earmark-zip';
        case 'word':
        case 'docx': return 'bi-file-earmark-word';
        case 'excel':
        case 'xlsx': return 'bi-file-earmark-excel';
        default: return 'bi-file-earmark-text';
    }
}

// Load and render post data
async function loadPostData() {
    const postId = getPostIdFromUrl();
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');
    const postDetailsDiv = document.getElementById('post-details');

    if (!postId) {
        showError('无效的文章链接。');
        return;
    }

    try {
        loadingIndicator.style.display = 'block';
        errorMessageDiv.style.display = 'none';
        postDetailsDiv.style.display = 'none';

        const response = await fetch(`/api/blog/${postId}`);

        if (!response.ok) {
            if (response.status === 404) {
                showError('找不到指定的文章。');
            } else {
                 const errorData = await response.json().catch(() => null);
                 showError(`加载文章失败: ${errorData?.error || response.statusText}`);
            }
            return;
        }

        const post = await response.json();
        renderPost(post);

    } catch (error) {
        console.error('加载文章时出错:', error);
        showError('加载文章时发生网络错误，请稍后重试。');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Render the fetched post data into the DOM
function renderPost(post) {
    const postDetailsDiv = document.getElementById('post-details');
    const breadcrumbTitle = document.getElementById('breadcrumb-post-title');
    const titleEl = document.getElementById('post-title');
    const dateEl = document.getElementById('post-date');
    const categoryEl = document.getElementById('post-category');
    const contentEl = document.getElementById('post-content');
    const attachmentsSection = document.getElementById('post-attachments');
    const attachmentList = document.getElementById('attachment-list');
    const referencesSection = document.getElementById('post-references');
    const referenceList = document.getElementById('reference-list');

    if (!postDetailsDiv || !titleEl || !dateEl || !categoryEl || !contentEl || 
        !attachmentsSection || !attachmentList || !referencesSection || !referenceList || !breadcrumbTitle) return;

    // Update page title and breadcrumb
    document.title = post.title; 
    breadcrumbTitle.textContent = post.title;

    // Populate header
    titleEl.textContent = post.title;
    dateEl.textContent = new Date(post.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    categoryEl.textContent = post.category;

    // Render Markdown content safely
    // Configure marked to handle line breaks properly
    marked.setOptions({
        breaks: true, // Convert single line breaks in source to <br>
        gfm: true      // Use GitHub Flavored Markdown
    });
    const rawHtml = marked.parse(post.content || '');
    // Sanitize the HTML to prevent XSS attacks
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    contentEl.innerHTML = cleanHtml;

    // Render attachments
    attachmentList.innerHTML = ''; // Clear previous
    if (post.attachments && post.attachments.length > 0) {
        post.attachments.forEach(att => {
            const li = document.createElement('li');
            const iconClass = getIconForType(att.type);
            li.innerHTML = `<i class="bi ${iconClass} attachment-icon"></i> <a href="${att.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(att.filename || '下载附件')}</a>`;
            attachmentList.appendChild(li);
        });
        attachmentsSection.style.display = 'block';
    } else {
        attachmentsSection.style.display = 'none';
    }

    // Render references
    referenceList.innerHTML = ''; // Clear previous
    if (post.references && post.references.length > 0) {
        // Here you might want to fetch titles for referenced posts, 
        // but for simplicity, we'll just link using the ID for now.
        post.references.forEach(refId => {
             const li = document.createElement('li');
             li.innerHTML = `<i class="bi bi-journal-text reference-icon"></i> <a href="/blog/${refId}">引用文章 ID: ${refId}</a>`;
             referenceList.appendChild(li);
        });
        referencesSection.style.display = 'block';
    } else {
         referencesSection.style.display = 'none';
    }

    // Show the populated content
    postDetailsDiv.style.display = 'block';
}

// Display an error message
function showError(message) {
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');
    const postDetailsDiv = document.getElementById('post-details');

    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (postDetailsDiv) postDetailsDiv.style.display = 'none';
    
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    }
}

// Simple HTML escape helper (reuse if needed)
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