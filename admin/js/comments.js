// 评论管理相关的状态
let currentFilter = 'all';
let currentPage = 1;
const PAGE_SIZE = 10;
let allComments = [];

// 初始化评论管理功能
async function initializeCommentManagement() {
    // 绑定筛选按钮事件
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', (e) => {
            // 更新按钮状态
            document.querySelectorAll('[data-filter]').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            // 更新筛选并重新加载
            currentFilter = e.target.dataset.filter;
            currentPage = 1;
            displayFilteredComments();
        });
    });

    // 首次加载评论
    await loadAllComments();
    displayFilteredComments();
}

// 加载所有评论
async function loadAllComments() {
    try {
        const response = await fetch('/api/blog/posts');
        if (!response.ok) throw new Error('加载文章列表失败');
        const posts = await response.json();
        
        // 获取所有文章的评论
        allComments = [];
        for (const post of posts) {
            const commentsResponse = await fetch(`/admin/api/blog/comments/${post.id}`);
            if (commentsResponse.ok) {
                const comments = await commentsResponse.json();
                // 添加文章标题到每条评论
                comments.forEach(comment => {
                    comment.postTitle = post.title;
                    comment.postId = post.id;
                });
                allComments.push(...comments);
            }
        }
    } catch (error) {
        showToast('错误', '加载评论失败：' + error.message);
    }
}

// 显示筛选后的评论
function displayFilteredComments() {
    // 筛选评论
    let filteredComments = allComments;
    if (currentFilter !== 'all') {
        filteredComments = allComments.filter(comment => comment.status === currentFilter);
    }
    
    // 计算分页
    const totalPages = Math.ceil(filteredComments.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageComments = filteredComments.slice(start, end);
    
    // 更新表格内容
    const tbody = document.getElementById('comments-list-tbody');
    tbody.innerHTML = pageComments.map(comment => `
        <tr data-comment-id="${comment.id}" data-post-id="${comment.postId}">
            <td>${escapeHtml(comment.postTitle)}</td>
            <td>${escapeHtml(comment.name)}</td>
            <td>${escapeHtml(comment.content)}</td>
            <td>${new Date(comment.timestamp).toLocaleString()}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(comment.status)}">
                    ${getStatusText(comment.status)}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    ${comment.status === 'pending' ? `
                        <button class="btn btn-success btn-approve" title="通过">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-danger btn-reject" title="拒绝">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-delete" title="删除">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="text-center">暂无评论</td></tr>';
    
    // 更新分页控件
    updatePagination(totalPages);
    
    // 绑定操作按钮事件
    bindCommentActions();
}

// 绑定评论操作按钮事件
function bindCommentActions() {
    // 通过评论
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.target.closest('tr');
            const commentId = row.dataset.commentId;
            const postId = row.dataset.postId;
            await updateCommentStatus(postId, commentId, 'approved');
        });
    });
    
    // 拒绝评论
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const row = e.target.closest('tr');
            const commentId = row.dataset.commentId;
            const postId = row.dataset.postId;
            await updateCommentStatus(postId, commentId, 'rejected');
        });
    });
    
    // 删除评论
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('确定要删除这条评论吗？')) return;
            
            const row = e.target.closest('tr');
            const commentId = row.dataset.commentId;
            const postId = row.dataset.postId;
            await deleteComment(postId, commentId);
        });
    });
}

// 更新评论状态
async function updateCommentStatus(postId, commentId, status) {
    try {
        const response = await fetch(`/admin/api/blog/comments/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commentId, status })
        });
        
        if (!response.ok) throw new Error('更新评论状态失败');
        
        // 更新本地数据
        const comment = allComments.find(c => c.id === commentId);
        if (comment) comment.status = status;
        
        // 刷新显示
        displayFilteredComments();
        showToast('成功', '评论状态已更新');
    } catch (error) {
        showToast('错误', error.message);
    }
}

// 删除评论
async function deleteComment(postId, commentId) {
    try {
        const response = await fetch(`/admin/api/blog/comments/${postId}?commentId=${commentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('删除评论失败');
        
        // 更新本地数据
        allComments = allComments.filter(c => c.id !== commentId);
        
        // 刷新显示
        displayFilteredComments();
        showToast('成功', '评论已删除');
    } catch (error) {
        showToast('错误', error.message);
    }
}

// 更新分页控件
function updatePagination(totalPages) {
    const pagination = document.getElementById('comments-pagination');
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '<ul class="pagination">';
    
    // 上一页
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>
        </li>
    `;
    
    // 页码
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // 下一页
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>
        </li>
    `;
    
    html += '</ul>';
    pagination.innerHTML = html;
    
    // 绑定分页事件
    pagination.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(e.target.dataset.page);
            if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
                currentPage = newPage;
                displayFilteredComments();
            }
        });
    });
}

// 获取状态对应的Badge类
function getStatusBadgeClass(status) {
    const classes = {
        'pending': 'bg-warning',
        'approved': 'bg-success',
        'rejected': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

// 获取状态文本
function getStatusText(status) {
    const texts = {
        'pending': '待审核',
        'approved': '已通过',
        'rejected': '已拒绝'
    };
    return texts[status] || '未知';
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果当前在评论管理页面，初始化评论管理功能
    if (document.getElementById('manage-comments')) {
        initializeCommentManagement();
    }
}); 