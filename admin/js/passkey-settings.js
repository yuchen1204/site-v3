/**
 * Passkey设置页面的JavaScript
 * 用于检查Passkey状态、注册和管理Passkey
 */

document.addEventListener('DOMContentLoaded', function() {
    // 检查是否支持WebAuthn/Passkey
    if (!window.PublicKeyCredential) {
        showErrorMessage('您的浏览器不支持Passkey/WebAuthn，请使用更现代的浏览器。');
        return;
    }
    
    // 检查当前用户的Passkey状态
    checkPasskeyStatus();
    
    // 绑定按钮事件
    document.getElementById('register-passkey-btn').addEventListener('click', registerPasskey);
    document.getElementById('update-passkey-btn').addEventListener('click', registerPasskey); // 更新与注册使用相同过程
    document.getElementById('delete-passkey-btn').addEventListener('click', deletePasskey);
    
    // 侧边栏切换
    document.getElementById('toggle-sidebar-btn').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
    });
});

/**
 * 检查当前用户的Passkey状态
 */
async function checkPasskeyStatus() {
    try {
        const response = await fetch('/admin/api/passkey/status');
        
        // 隐藏加载状态
        document.getElementById('loading-status').style.display = 'none';
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.hasPasskey) {
                // 显示已注册状态
                document.getElementById('has-passkey-status').style.display = 'block';
                
                // 格式化并显示注册日期
                if (data.registeredAt) {
                    const registeredDate = new Date(data.registeredAt);
                    document.getElementById('passkey-registered-date').textContent = 
                        `注册于 ${registeredDate.toLocaleDateString()} ${registeredDate.toLocaleTimeString()}`;
                }
            } else {
                // 显示未注册状态
                document.getElementById('no-passkey-status').style.display = 'block';
            }
        } else {
            // 请求出错，显示通用未注册状态
            document.getElementById('no-passkey-status').style.display = 'block';
            
            // 尝试获取错误详情
            const errorData = await response.json();
            if (errorData && errorData.error) {
                console.error('获取Passkey状态失败:', errorData.error);
            }
        }
    } catch (error) {
        console.error('检查Passkey状态出错:', error);
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('no-passkey-status').style.display = 'block';
        showErrorMessage('无法检查Passkey状态，请稍后再试。');
    }
}

/**
 * 注册新的Passkey
 */
async function registerPasskey() {
    // 隐藏任何之前的消息
    hideOperationMessage();
    
    // 禁用所有按钮
    setButtonsDisabled(true);
    
    try {
        // 步骤1: 发起Passkey注册请求
        const registrationResponse = await fetch('/admin/api/passkey/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!registrationResponse.ok) {
            const errorData = await registrationResponse.json();
            throw new Error(errorData.error || '无法启动Passkey注册');
        }
        
        // 获取注册选项
        const options = await registrationResponse.json();
        
        // 将Base64URL字符串转换为适当的格式
        options.challenge = base64URLToArrayBuffer(options.challenge);
        options.user.id = base64URLToArrayBuffer(options.user.id);
        
        showInfoMessage('请按照浏览器提示完成Passkey注册...');
        
        // 步骤2: 调用浏览器的凭证创建API
        const credential = await navigator.credentials.create({
            publicKey: options
        });
        
        showInfoMessage('正在完成Passkey注册...');
        
        // 步骤3: 发送凭证到服务器完成注册
        const registrationCompleteData = {
            id: credential.id,
            rawId: arrayBufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
                attestationObject: arrayBufferToBase64URL(credential.response.attestationObject)
            }
        };
        
        const completeResponse = await fetch('/admin/api/passkey/register-complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationCompleteData)
        });
        
        if (!completeResponse.ok) {
            const errorData = await completeResponse.json();
            throw new Error(errorData.error || 'Passkey注册过程中出错');
        }
        
        // 注册成功，显示成功消息
        showSuccessMessage('Passkey注册成功！现在您可以使用Passkey进行登录。');
        
        // 刷新状态显示
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Passkey注册失败:', error);
        showErrorMessage(error.message || 'Passkey注册失败，请稍后再试');
    } finally {
        // 重新启用所有按钮
        setButtonsDisabled(false);
    }
}

/**
 * 删除已注册的Passkey
 */
async function deletePasskey() {
    // 确认是否要删除
    if (!confirm('您确定要删除已注册的Passkey吗？删除后将无法使用Passkey登录，需要使用密码登录。')) {
        return;
    }
    
    // 隐藏任何之前的消息
    hideOperationMessage();
    
    // 禁用所有按钮
    setButtonsDisabled(true);
    
    try {
        const response = await fetch('/admin/api/passkey/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '无法删除Passkey');
        }
        
        // 删除成功，显示成功消息
        showSuccessMessage('Passkey已成功删除。');
        
        // 刷新状态显示
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Passkey删除失败:', error);
        showErrorMessage(error.message || 'Passkey删除失败，请稍后再试');
    } finally {
        // 重新启用所有按钮
        setButtonsDisabled(false);
    }
}

/**
 * 显示操作成功消息
 */
function showSuccessMessage(message) {
    const messageElement = document.getElementById('passkey-operation-message');
    messageElement.className = 'alert alert-success mt-4';
    messageElement.innerHTML = `<i class="bi bi-check-circle me-2"></i>${message}`;
    messageElement.style.display = 'block';
}

/**
 * 显示操作错误消息
 */
function showErrorMessage(message) {
    const messageElement = document.getElementById('passkey-operation-message');
    messageElement.className = 'alert alert-danger mt-4';
    messageElement.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${message}`;
    messageElement.style.display = 'block';
}

/**
 * 显示操作信息消息
 */
function showInfoMessage(message) {
    const messageElement = document.getElementById('passkey-operation-message');
    messageElement.className = 'alert alert-info mt-4';
    messageElement.innerHTML = `<i class="bi bi-info-circle me-2"></i>${message}`;
    messageElement.style.display = 'block';
}

/**
 * 隐藏操作消息
 */
function hideOperationMessage() {
    document.getElementById('passkey-operation-message').style.display = 'none';
}

/**
 * 设置所有按钮的禁用状态
 */
function setButtonsDisabled(disabled) {
    document.getElementById('register-passkey-btn').disabled = disabled;
    document.getElementById('update-passkey-btn').disabled = disabled;
    document.getElementById('delete-passkey-btn').disabled = disabled;
}

/**
 * 将Base64URL字符串转换为ArrayBuffer
 */
function base64URLToArrayBuffer(base64URLString) {
    const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
        base64.length + (4 - (base64.length % 4 || 4)) % 4,
        '='
    );
    const binary = atob(paddedBase64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    
    return buffer;
}

/**
 * 将ArrayBuffer转换为Base64URL字符串
 */
function arrayBufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    const base64 = btoa(binary);
    
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
} 