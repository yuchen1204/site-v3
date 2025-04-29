/**
 * Passkey管理JS
 * 处理注册、验证和管理Passkeys的功能
 */

// 从SimpleWebAuthn获取浏览器API
const { startRegistration } = SimpleWebAuthn.browserSupport;

document.addEventListener('DOMContentLoaded', function() {
    initPasskeyManager();
});

/**
 * 初始化Passkey管理功能
 */
function initPasskeyManager() {
    // 加载Passkey列表
    loadPasskeys();
    
    // 注册新Passkey的按钮事件
    const registerButton = document.getElementById('register-passkey-button');
    if (registerButton) {
        registerButton.addEventListener('click', registerNewPasskey);
    }
    
    // 初始化删除确认模态框
    initDeleteModal();
    
    // 初始化重命名模态框
    initRenameModal();
}

/**
 * 加载已注册的Passkey列表
 */
async function loadPasskeys() {
    const tbody = document.getElementById('passkeys-list-tbody');
    const noPasskeysMessage = document.getElementById('no-passkeys-message');
    
    if (!tbody) return;
    
    try {
        // 显示加载中状态
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">加载中...</td></tr>';
        
        // 获取Passkey列表
        const response = await fetch('/admin/api/passkey/list');
        
        if (!response.ok) {
            throw new Error('获取Passkey列表失败');
        }
        
        const passkeys = await response.json();
        
        // 检查是否有Passkey
        if (!passkeys || passkeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">没有已注册的Passkey</td></tr>';
            if (noPasskeysMessage) noPasskeysMessage.style.display = 'block';
            return;
        }
        
        // 隐藏"无Passkey"提示
        if (noPasskeysMessage) noPasskeysMessage.style.display = 'none';
        
        // 渲染Passkey列表
        tbody.innerHTML = '';
        passkeys.forEach(passkey => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${sanitizeHTML(passkey.name)}</td>
                <td>${formatDate(passkey.createdAt)}</td>
                <td>${formatDate(passkey.lastUsed)}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary rename-passkey-btn" data-id="${passkey.id}" data-name="${sanitizeHTML(passkey.name)}">
                            <i class="bi bi-pencil"></i> 重命名
                        </button>
                        <button type="button" class="btn btn-outline-danger delete-passkey-btn" data-id="${passkey.id}" data-name="${sanitizeHTML(passkey.name)}">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // 为新添加的按钮绑定事件
        attachPasskeyButtonEvents();
        
    } catch (error) {
        console.error('加载Passkey列表出错:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">加载Passkey列表出错: ${error.message}</td></tr>`;
    }
}

/**
 * 为Passkey操作按钮绑定事件
 */
function attachPasskeyButtonEvents() {
    // 为删除按钮绑定事件
    document.querySelectorAll('.delete-passkey-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const name = this.getAttribute('data-name');
            showDeletePasskeyModal(id, name);
        });
    });
    
    // 为重命名按钮绑定事件
    document.querySelectorAll('.rename-passkey-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const name = this.getAttribute('data-name');
            showRenamePasskeyModal(id, name);
        });
    });
}

/**
 * 注册新的Passkey
 */
async function registerNewPasskey() {
    const statusElement = document.getElementById('passkey-reg-status');
    const registerButton = document.getElementById('register-passkey-button');
    
    if (!statusElement || !registerButton) return;
    
    // 设置加载状态
    registerButton.disabled = true;
    registerButton.innerHTML = '<i class="bi bi-hourglass-split"></i> 正在处理...';
    statusElement.innerHTML = '<div class="alert alert-info">请按照浏览器提示完成Passkey注册...</div>';
    
    try {
        // 1. 获取注册选项
        const optionsResponse = await fetch('/admin/api/passkey/registration-options');
        
        if (!optionsResponse.ok) {
            const errorData = await optionsResponse.json();
            throw new Error(errorData.error || '获取注册选项失败');
        }
        
        // 2. 解析注册选项
        const options = await optionsResponse.json();
        
        // 3. 启动注册过程
        const name = prompt('请为此Passkey设置一个名称 (例如：我的手机、工作电脑等)','我的设备');
        if (!name) {
            throw new Error('已取消注册');
        }
        
        const registrationResponse = await startRegistration(options);
        
        // 添加设备名称到响应中
        registrationResponse.name = name;
        
        // 4. 将注册结果发送到服务器验证
        const verificationResponse = await fetch('/admin/api/passkey/verify-registration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationResponse)
        });
        
        const verificationResult = await verificationResponse.json();
        
        if (verificationResponse.ok && verificationResult.verified) {
            // 注册成功
            statusElement.innerHTML = `<div class="alert alert-success">Passkey"${sanitizeHTML(name)}"注册成功！</div>`;
            // 重新加载Passkey列表
            loadPasskeys();
        } else {
            // 验证失败
            throw new Error(verificationResult.error || 'Passkey注册验证失败');
        }
    } catch (error) {
        console.error('注册Passkey出错:', error);
        statusElement.innerHTML = `<div class="alert alert-danger">Passkey注册失败: ${error.message}</div>`;
    } finally {
        // 重置按钮状态
        registerButton.disabled = false;
        registerButton.innerHTML = '<i class="bi bi-plus-circle"></i> 注册新Passkey';
        
        // 5秒后隐藏状态消息
        setTimeout(() => {
            statusElement.innerHTML = '';
        }, 5000);
    }
}

/**
 * 初始化删除确认模态框
 */
function initDeleteModal() {
    const confirmButton = document.getElementById('confirmDeleteButton');
    if (!confirmButton) return;
    
    confirmButton.addEventListener('click', async function() {
        const id = this.getAttribute('data-id');
        
        if (!id) return;
        
        try {
            // 禁用按钮防止重复点击
            confirmButton.disabled = true;
            confirmButton.textContent = '删除中...';
            
            // 发送删除请求
            const response = await fetch(`/admin/api/passkey/delete?id=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '删除Passkey失败');
            }
            
            // 隐藏模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
            modal.hide();
            
            // 重新加载Passkey列表
            loadPasskeys();
            
            // 显示成功消息
            const statusElement = document.getElementById('passkey-reg-status');
            if (statusElement) {
                statusElement.innerHTML = '<div class="alert alert-success">Passkey已成功删除</div>';
                // 5秒后隐藏状态消息
                setTimeout(() => {
                    statusElement.innerHTML = '';
                }, 5000);
            }
            
        } catch (error) {
            console.error('删除Passkey出错:', error);
            alert(`删除Passkey失败: ${error.message}`);
        } finally {
            // 重置按钮状态
            confirmButton.disabled = false;
            confirmButton.textContent = '确认删除';
            // 清除ID属性
            confirmButton.removeAttribute('data-id');
        }
    });
}

/**
 * 显示删除Passkey确认模态框
 * @param {string} id - Passkey ID
 * @param {string} name - Passkey名称
 */
function showDeletePasskeyModal(id, name) {
    const modal = document.getElementById('deleteConfirmModal');
    const modalBody = document.getElementById('deleteConfirmBody');
    const confirmButton = document.getElementById('confirmDeleteButton');
    
    if (!modal || !modalBody || !confirmButton) return;
    
    modalBody.textContent = `您确定要删除Passkey "${sanitizeHTML(name)}"吗？此操作不可撤销。`;
    confirmButton.setAttribute('data-id', id);
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/**
 * 初始化重命名模态框
 */
function initRenameModal() {
    const confirmButton = document.getElementById('confirmRenameButton');
    if (!confirmButton) return;
    
    confirmButton.addEventListener('click', async function() {
        const idInput = document.getElementById('rename-passkey-id');
        const nameInput = document.getElementById('passkey-name');
        
        if (!idInput || !nameInput) return;
        
        const id = idInput.value;
        const name = nameInput.value.trim();
        
        if (!id || !name) {
            alert('请输入设备名称');
            return;
        }
        
        try {
            // 禁用按钮防止重复点击
            confirmButton.disabled = true;
            confirmButton.textContent = '保存中...';
            
            // 发送重命名请求
            const response = await fetch('/admin/api/passkey/rename', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, name })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '重命名Passkey失败');
            }
            
            // 隐藏模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('renamePasskeyModal'));
            modal.hide();
            
            // 重新加载Passkey列表
            loadPasskeys();
            
            // 显示成功消息
            const statusElement = document.getElementById('passkey-reg-status');
            if (statusElement) {
                statusElement.innerHTML = '<div class="alert alert-success">Passkey已成功重命名</div>';
                // 5秒后隐藏状态消息
                setTimeout(() => {
                    statusElement.innerHTML = '';
                }, 5000);
            }
            
        } catch (error) {
            console.error('重命名Passkey出错:', error);
            alert(`重命名Passkey失败: ${error.message}`);
        } finally {
            // 重置按钮状态
            confirmButton.disabled = false;
            confirmButton.textContent = '保存';
        }
    });
}

/**
 * 显示重命名Passkey模态框
 * @param {string} id - Passkey ID
 * @param {string} name - 当前Passkey名称
 */
function showRenamePasskeyModal(id, name) {
    const modal = document.getElementById('renamePasskeyModal');
    const idInput = document.getElementById('rename-passkey-id');
    const nameInput = document.getElementById('passkey-name');
    
    if (!modal || !idInput || !nameInput) return;
    
    idInput.value = id;
    nameInput.value = name;
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/**
 * 格式化日期
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

/**
 * 清理HTML内容以防止XSS攻击
 * @param {string} html - 原始HTML字符串
 * @returns {string} 清理后的HTML字符串
 */
function sanitizeHTML(html) {
    if (!html) return '';
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
} 