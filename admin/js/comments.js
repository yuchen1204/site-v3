/**
 * 评论管理模块 - 后台管理系统
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeCommentsManager();
});

let allPosts = []; // 存储所有博客文章信息
let currentComments = []; // 当前显示的评论列表
let currentCommentId = null; // 当前在模态框中显示的评论ID

/**
 * 初始化评论管理功能
 */
async function initializeCommentsManager() {
    // 加载博客文章用于筛选
    await loadBlogPosts();
    
    // 加载所有评论
    await loadAllComments();
    
    // 设置事件监听器
    setupCommentEventListeners();
}

/**
 * 加载所有博客文章，用于评论筛选
 */
async function loadBlogPosts() {
    try {
        const response = await fetch('/api/blog');
        if (!response.ok) {
            throw new Error('加载博客文章失败');
        }
        
        allPosts = await response.json();
        
        // 填充文章筛选下拉菜单
        const filterSelect = document.getElementById('comment-filter-post');
        if (filterSelect) {
            const options = allPosts.map(post => 
                `<option value="${post.id}">${post.title}</option>`
            ).join('');
            
            filterSelect.innerHTML = `<option value="">所有文章</option>${options}`;
        }
    } catch (error) {
        console.error('加载博客文章失败:', error);
        showNotification('error', '加载博客文章失败，请刷新页面重试');
    }
}

/**
 * 加载所有评论
 */
async function loadAllComments() {
    try {
        const commentsContainer = document.getElementById('comments-list-tbody');
        if (!commentsContainer) return;
        
        commentsContainer.innerHTML = '<tr><td colspan="6" class="text-center">加载中...</td></tr>';
        
        const response = await fetch('/admin/api/comments');
        if (!response.ok) {
            throw new Error('加载评论失败');
        }
        
        const commentsData = await response.json();
        currentComments = commentsData;
        
        displayComments(commentsData);
    } catch (error) {
        console.error('加载评论失败:', error);
        const commentsContainer = document.getElementById('comments-list-tbody');
        if (commentsContainer) {
            commentsContainer.innerHTML = '<tr><td colspan="6" class="text-center text-danger">加载评论失败，请刷新重试</td></tr>';
        }
    }
}

/**
 * 显示评论列表
 */
function displayComments(comments) {
    const commentsContainer = document.getElementById('comments-list-tbody');
    if (!commentsContainer) return;
    
    if (!comments || comments.length === 0) {
        commentsContainer.innerHTML = '<tr><td colspan="6" class="text-center">暂无评论</td></tr>';
        return;
    }
    
    const rows = comments.map((comment, index) => {
        // 查找关联的文章标题
        const relatedPost = allPosts.find(post => post.id === comment.postId) || { title: '未知文章' };
        const shortText = truncateText(comment.text, 80);
        
        return `
        <tr data-comment-id="${comment.id}" class="comment-row">
            <td>${index + 1}</td>
            <td>${escapeHTML(comment.author)}</td>
            <td>${formatDate(new Date(comment.timestamp))}</td>
            <td>${escapeHTML(relatedPost.title)}</td>
            <td>${escapeHTML(shortText)}</td>
            <td>
                <button class="btn btn-sm btn-info view-comment-btn" data-comment-id="${comment.id}">
                    <i class="bi bi-eye"></i> 查看
                </button>
                <button class="btn btn-sm btn-danger delete-comment-btn" data-comment-id="${comment.id}">
                    <i class="bi bi-trash"></i> 删除
                </button>
            </td>
        </tr>
        `;
    }).join('');
    
    commentsContainer.innerHTML = rows;
    
    // 添加点击事件监听器
    addCommentRowEventListeners();
}

/**
 * 为评论行添加事件监听器
 */
function addCommentRowEventListeners() {
    // 查看评论按钮
    document.querySelectorAll('.view-comment-btn').forEach(button => {
        button.addEventListener('click', function() {
            const commentId = this.getAttribute('data-comment-id');
            openCommentDetailModal(commentId);
        });
    });
    
    // 删除评论按钮
    document.querySelectorAll('.delete-comment-btn').forEach(button => {
        button.addEventListener('click', function() {
            const commentId = this.getAttribute('data-comment-id');
            confirmDeleteComment(commentId);
        });
    });
}

/**
 * 设置评论管理的事件监听器
 */
function setupCommentEventListeners() {
    // 文章筛选下拉菜单变化
    const filterSelect = document.getElementById('comment-filter-post');
    if (filterSelect) {
        filterSelect.addEventListener('change', filterCommentsByPost);
    }
    
    // 搜索按钮
    const searchBtn = document.getElementById('comment-search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchComments);
    }
    
    // 搜索输入框回车键
    const searchInput = document.getElementById('comment-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchComments();
            }
        });
    }
    
    // 刷新按钮
    const refreshBtn = document.getElementById('refresh-comments-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAllComments);
    }
    
    // 模态框中的删除按钮
    const modalDeleteBtn = document.getElementById('modal-delete-comment-btn');
    if (modalDeleteBtn) {
        modalDeleteBtn.addEventListener('click', function() {
            if (currentCommentId) {
                confirmDeleteComment(currentCommentId);
            }
        });
    }
}

/**
 * 根据文章筛选评论
 */
function filterCommentsByPost() {
    const postId = document.getElementById('comment-filter-post').value;
    
    let filteredComments;
    if (postId) {
        filteredComments = currentComments.filter(comment => 
            comment.postId === parseInt(postId, 10) || comment.postId === postId);
    } else {
        filteredComments = [...currentComments];
    }
    
    displayComments(filteredComments);
}

/**
 * 搜索评论
 */
function searchComments() {
    const searchTerm = document.getElementById('comment-search').value.trim().toLowerCase();
    
    if (!searchTerm) {
        displayComments(currentComments);
        return;
    }
    
    const filteredComments = currentComments.filter(comment => {
        return (
            comment.author.toLowerCase().includes(searchTerm) ||
            comment.text.toLowerCase().includes(searchTerm)
        );
    });
    
    displayComments(filteredComments);
}

/**
 * 打开评论详情模态框
 */
function openCommentDetailModal(commentId) {
    currentCommentId = commentId;
    const comment = currentComments.find(c => c.id === commentId);
    
    if (!comment) {
        console.error('未找到对应ID的评论:', commentId);
        return;
    }
    
    // 查找关联的文章标题
    const relatedPost = allPosts.find(post => post.id === comment.postId) || { title: '未知文章', id: null };
    
    // 构建模态框内容
    const modalContent = document.getElementById('comment-detail-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between">
                    <div><strong>作者:</strong> ${escapeHTML(comment.author)}</div>
                    <div><strong>日期:</strong> ${formatDate(new Date(comment.timestamp))}</div>
                </div>
                <div class="card-body">
                    <p class="mb-2"><strong>文章:</strong> 
                        <a href="/blog/index.html?id=${relatedPost.id}" target="_blank">${escapeHTML(relatedPost.title)}</a>
                    </p>
                    <p class="mb-0"><strong>评论内容:</strong></p>
                    <div class="p-3 bg-light rounded">
                        ${escapeHTML(comment.text)}
                    </div>
                </div>
                <div class="card-footer text-muted">
                    <strong>评论ID:</strong> ${comment.id}
                </div>
            </div>
        `;
    }
    
    // 打开模态框
    const modal = new bootstrap.Modal(document.getElementById('commentDetailModal'));
    modal.show();
}

/**
 * 确认删除评论
 */
function confirmDeleteComment(commentId) {
    const comment = currentComments.find(c => c.id === commentId);
    
    if (!comment) {
        console.error('未找到对应ID的评论:', commentId);
        return;
    }
    
    // 设置确认模态框内容
    const confirmMessage = document.getElementById('delete-confirm-message');
    if (confirmMessage) {
        confirmMessage.textContent = `您确定要删除用户"${comment.author}"的评论吗？`;
    }
    
    // 设置确认按钮事件
    const confirmBtn = document.getElementById('confirmDeleteButton');
    if (confirmBtn) {
        // 移除旧的事件监听器
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        
        // 添加新的事件监听器
        newBtn.addEventListener('click', async function() {
            await deleteComment(commentId);
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
            modal.hide();
            
            // 如果评论详情模态框打开，也关闭它
            const detailModal = bootstrap.Modal.getInstance(document.getElementById('commentDetailModal'));
            if (detailModal) {
                detailModal.hide();
            }
        });
    }
    
    // 打开确认模态框
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

/**
 * 删除评论
 */
async function deleteComment(commentId) {
    try {
        const response = await fetch(`/admin/api/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('删除评论失败');
        }
        
        // 移除已删除的评论
        currentComments = currentComments.filter(comment => comment.id !== commentId);
        
        // 重新显示评论列表
        displayComments(currentComments);
        
        // 显示成功通知
        showNotification('success', '评论已成功删除');
    } catch (error) {
        console.error('删除评论失败:', error);
        showNotification('error', '删除评论失败，请重试');
    }
}

/**
 * 显示通知消息
 */
function showNotification(type, message) {
    // 使用Bootstrap Toast或自定义通知组件
    // 这里简单使用alert，实际应用中可以使用更友好的UI组件
    alert(message);
}

/**
 * 截断文本为指定长度，添加省略号
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 转义HTML特殊字符
 */
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 格式化日期
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