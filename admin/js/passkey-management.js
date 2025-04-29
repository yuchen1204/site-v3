// Passkey 管理脚本

document.addEventListener('DOMContentLoaded', function() {
    // 检查是否支持WebAuthn/Passkey
    const isWebAuthnSupported = window.PublicKeyCredential !== undefined;
    
    // 如果不支持WebAuthn，显示不支持消息
    if (!isWebAuthnSupported) {
        const passkeyContainer = document.getElementById('passkey-management-container');
        if (passkeyContainer) {
            passkeyContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    您的浏览器不支持Passkey/WebAuthn。请使用最新版的Chrome、Edge、Safari或Firefox浏览器。
                </div>
            `;
        }
        return;
    }
    
    // 初始化
    loadUserPasskeys();
    
    // 注册按钮事件监听
    const registerBtn = document.getElementById('register-passkey-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', registerNewPasskey);
    }
});

// 加载用户的Passkey列表
async function loadUserPasskeys() {
    const tableBody = document.getElementById('passkeys-table-body');
    const loadingSpinner = document.getElementById('passkeys-loading');
    const errorAlert = document.getElementById('passkeys-error');
    
    if (tableBody) {
        try {
            loadingSpinner.style.display = 'block';
            errorAlert.style.display = 'none';
            
            const response = await fetch('/admin/passkey/list');
            
            if (!response.ok) {
                throw new Error('获取Passkey列表失败');
            }
            
            const data = await response.json();
            
            if (!data.credentials || data.credentials.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">
                            <p class="my-3">您还没有注册的Passkey</p>
                        </td>
                    </tr>
                `;
            } else {
                // 清空表格
                tableBody.innerHTML = '';
                
                // 填充表格
                data.credentials.forEach(credential => {
                    const row = document.createElement('tr');
                    
                    // 格式化日期
                    const createdDate = new Date(credential.createdAt);
                    const lastUsedDate = credential.lastUsed ? new Date(credential.lastUsed) : null;
                    
                    row.innerHTML = `
                        <td>${credential.name}</td>
                        <td>${formatDate(createdDate)}</td>
                        <td>${lastUsedDate ? formatDate(lastUsedDate) : '从未使用'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger delete-passkey-btn" 
                                    data-credential-id="${credential.id}" 
                                    data-credential-name="${credential.name}">
                                删除
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // 添加删除按钮事件
                document.querySelectorAll('.delete-passkey-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const credentialId = this.getAttribute('data-credential-id');
                        const credentialName = this.getAttribute('data-credential-name');
                        deletePasskey(credentialId, credentialName);
                    });
                });
            }
        } catch (error) {
            console.error('加载Passkey列表出错:', error);
            errorAlert.textContent = '加载Passkey列表失败，请刷新重试';
            errorAlert.style.display = 'block';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }
}

// 注册新的Passkey
async function registerNewPasskey() {
    const errorAlert = document.getElementById('passkeys-error');
    const successAlert = document.getElementById('passkeys-success');
    const registerBtn = document.getElementById('register-passkey-btn');
    
    try {
        // 隐藏之前的提示
        errorAlert.style.display = 'none';
        successAlert.style.display = 'none';
        
        // 显示设备名称输入框
        const deviceName = prompt('请输入此Passkey的设备名称（如: 工作电脑, 个人手机等）:', '');
        
        // 用户取消输入
        if (deviceName === null) {
            return;
        }
        
        // 禁用按钮并显示加载中
        const originalBtnText = registerBtn.innerHTML;
        registerBtn.disabled = true;
        registerBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 注册中...`;
        
        // 获取注册选项
        const optionsResponse = await fetch('/admin/passkey/register-options', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        if (!optionsResponse.ok) {
            const error = await optionsResponse.json();
            throw new Error(error.error || '获取注册选项失败');
        }
        
        const optionsData = await optionsResponse.json();
        
        // 调用浏览器WebAuthn API创建凭据
        const credential = await navigator.credentials.create({
            publicKey: {
                // 将Base64Url编码的挑战转换为ArrayBuffer
                challenge: base64UrlToBuffer(optionsData.challenge),
                rp: {
                    name: optionsData.rp.name,
                    id: optionsData.rp.id
                },
                user: {
                    id: base64UrlToBuffer(optionsData.user.id),
                    name: optionsData.user.name,
                    displayName: optionsData.user.displayName || optionsData.user.name
                },
                pubKeyCredParams: optionsData.pubKeyCredParams,
                excludeCredentials: (optionsData.excludeCredentials || []).map(cred => ({
                    id: base64UrlToBuffer(cred.id),
                    type: cred.type,
                    transports: cred.transports
                })),
                authenticatorSelection: optionsData.authenticatorSelection,
                timeout: optionsData.timeout,
                attestation: optionsData.attestation
            }
        });
        
        // 准备发送到服务器的响应
        const attestationResponse = {
            id: credential.id,
            rawId: bufferToBase64Url(credential.rawId),
            response: {
                clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                attestationObject: bufferToBase64Url(credential.response.attestationObject),
                transports: credential.response.getTransports ? credential.response.getTransports() : []
            },
            type: credential.type,
            clientExtensionResults: credential.getClientExtensionResults()
        };
        
        // 发送注册响应到服务器
        const verifyResponse = await fetch('/admin/passkey/register-verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                attestationResponse, 
                deviceName 
            })
        });
        
        const verifyData = await verifyResponse.json();
        
        if (!verifyResponse.ok) {
            throw new Error(verifyData.error || '验证注册失败');
        }
        
        // 注册成功
        successAlert.textContent = `成功注册新的Passkey: ${verifyData.deviceName || deviceName}`;
        successAlert.style.display = 'block';
        
        // 重新加载Passkey列表
        loadUserPasskeys();
    } catch (error) {
        console.error('注册Passkey出错:', error);
        
        let errorMessage = '注册Passkey失败: ' + error.message;
        
        // 用户取消或超时
        if (error.name === 'NotAllowedError') {
            errorMessage = '用户取消了操作';
        } else if (error.name === 'TimeoutError') {
            errorMessage = '操作超时，请重试';
        }
        
        errorAlert.textContent = errorMessage;
        errorAlert.style.display = 'block';
    } finally {
        // 恢复按钮状态
        registerBtn.disabled = false;
        registerBtn.innerHTML = `<i class="bi bi-plus-circle me-1"></i> 注册新Passkey`;
    }
}

// 删除Passkey
async function deletePasskey(credentialId, credentialName) {
    const errorAlert = document.getElementById('passkeys-error');
    const successAlert = document.getElementById('passkeys-success');
    
    try {
        // 隐藏之前的提示
        errorAlert.style.display = 'none';
        successAlert.style.display = 'none';
        
        // 确认删除
        if (!confirm(`确定要删除Passkey "${credentialName}"吗？此操作不可撤销。`)) {
            return;
        }
        
        // 发送删除请求
        const response = await fetch('/admin/passkey/delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credentialId })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '删除Passkey失败');
        }
        
        // 删除成功
        successAlert.textContent = data.message || `成功删除Passkey: ${credentialName}`;
        successAlert.style.display = 'block';
        
        // 重新加载Passkey列表
        loadUserPasskeys();
    } catch (error) {
        console.error('删除Passkey出错:', error);
        errorAlert.textContent = '删除Passkey失败: ' + error.message;
        errorAlert.style.display = 'block';
    }
}

// 工具函数: 格式化日期
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '未知日期';
    }
    
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 秒差值
    
    if (diff < 60) {
        return '刚刚';
    } else if (diff < 3600) {
        return `${Math.floor(diff / 60)}分钟前`;
    } else if (diff < 86400) {
        return `${Math.floor(diff / 3600)}小时前`;
    } else if (diff < 2592000) {
        return `${Math.floor(diff / 86400)}天前`;
    } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
}

// 工具函数: Base64Url转ArrayBuffer
function base64UrlToBuffer(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buffer;
}

// 工具函数: ArrayBuffer转Base64Url
function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 