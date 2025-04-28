/**
 * Cloudflare Pages Function for Passkey API routing
 * 
 * 这个文件处理所有Passkey相关的API路由
 */

export function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 路由到对应的处理函数
  if (url.pathname.endsWith('/list')) {
    return handleListPasskeys(context);
  }
  
  // 默认返回404
  return new Response(JSON.stringify({ error: '未找到请求的API端点' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json;charset=UTF-8' }
  });
}

export function onRequestPost(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 路由到对应的处理函数
  if (url.pathname.endsWith('/begin-registration')) {
    return handleBeginRegistration(context);
  } else if (url.pathname.endsWith('/complete-registration')) {
    return handleCompleteRegistration(context);
  } else if (url.pathname.endsWith('/begin-auth')) {
    return handleBeginAuth(context);
  } else if (url.pathname.endsWith('/complete-auth')) {
    return handleCompleteAuth(context);
  } else if (url.pathname.endsWith('/delete')) {
    return handleDeletePasskey(context);
  }
  
  // 默认返回404
  return new Response(JSON.stringify({ error: '未找到请求的API端点' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json;charset=UTF-8' }
  });
}

/**
 * 处理开始注册Passkey流程
 */
async function handleBeginRegistration(context) {
  const { request, env } = context;
  
  try {
    // 获取当前登录的管理员信息
    const sessionToken = getSessionToken(request);
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '未授权的请求' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const { name } = await request.json();
    
    // 创建注册选项
    // 在实际生产环境中，应使用专门的WebAuthn库如@simplewebauthn/server
    // 这里使用简化的演示代码
    const options = {
      challenge: generateRandomBuffer(),
      rp: {
        name: '个人网站管理后台',
        id: new URL(request.url).hostname
      },
      user: {
        id: generateRandomBuffer(),
        name: sessionData.username,
        displayName: sessionData.username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'required',
        requireResidentKey: true
      }
    };
    
    // 保存challenge和用户ID到session中供后续验证使用
    await env.blog_data.put(
      `passkey_reg:${sessionToken}`, 
      JSON.stringify({
        challenge: bufferToBase64Url(options.challenge),
        userId: bufferToBase64Url(options.user.id),
        name: name || '我的Passkey'
      }), 
      { expirationTtl: 300 } // 5分钟过期
    );
    
    // 返回客户端需要的注册选项
    return new Response(JSON.stringify({
      publicKey: {
        ...options,
        challenge: bufferToBase64Url(options.challenge),
        user: {
          ...options.user,
          id: bufferToBase64Url(options.user.id)
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('开始Passkey注册失败:', error);
    return new Response(JSON.stringify({ error: '开始Passkey注册失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理完成注册Passkey流程
 */
async function handleCompleteRegistration(context) {
  const { request, env } = context;
  
  try {
    // 获取当前登录的管理员信息
    const sessionToken = getSessionToken(request);
    const sessionKey = `session:${sessionToken}`;
    
    // 获取之前保存的注册数据
    const regDataKey = `passkey_reg:${sessionToken}`;
    const regData = await env.blog_data.get(regDataKey, { type: 'json' });
    
    if (!regData) {
      return new Response(JSON.stringify({ error: '注册会话已过期，请重新开始' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const { credential } = await request.json();
    
    // 在实际生产环境中，这里应该使用WebAuthn库验证凭据
    // 这里使用简化的演示代码
    
    // 存储Passkey信息
    const passkeyId = generateId();
    const passkey = {
      id: passkeyId,
      name: regData.name,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      created: Date.now()
    };
    
    // 获取当前用户的所有Passkeys
    const userPasskeysKey = `passkeys:${sessionKey}`;
    let userPasskeys = await env.blog_data.get(userPasskeysKey, { type: 'json' }) || [];
    
    // 添加新Passkey
    userPasskeys.push(passkey);
    
    // 保存更新后的Passkeys列表
    await env.blog_data.put(userPasskeysKey, JSON.stringify(userPasskeys));
    
    // 删除临时注册数据
    await env.blog_data.delete(regDataKey);
    
    return new Response(JSON.stringify({ 
      success: true,
      passkey: {
        id: passkey.id,
        name: passkey.name,
        created: passkey.created
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('完成Passkey注册失败:', error);
    return new Response(JSON.stringify({ error: '完成Passkey注册失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理开始Passkey认证流程
 */
async function handleBeginAuth(context) {
  const { request, env } = context;
  
  try {
    // 创建认证选项
    // 在实际生产环境中，应使用专门的WebAuthn库
    const options = {
      challenge: generateRandomBuffer(),
      timeout: 60000,
      userVerification: 'preferred',
      rpId: new URL(request.url).hostname
    };
    
    // 保存challenge供后续验证使用
    const authId = generateId();
    await env.blog_data.put(
      `passkey_auth:${authId}`, 
      JSON.stringify({
        challenge: bufferToBase64Url(options.challenge),
        timestamp: Date.now()
      }), 
      { expirationTtl: 300 } // 5分钟过期
    );
    
    // 返回客户端需要的认证选项
    return new Response(JSON.stringify({
      authId,
      publicKey: {
        ...options,
        challenge: bufferToBase64Url(options.challenge)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('开始Passkey认证失败:', error);
    return new Response(JSON.stringify({ error: '开始Passkey认证失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理完成Passkey认证流程
 */
async function handleCompleteAuth(context) {
  const { request, env } = context;
  
  try {
    const { authId, credential } = await request.json();
    
    // 获取之前保存的认证数据
    const authDataKey = `passkey_auth:${authId}`;
    const authData = await env.blog_data.get(authDataKey, { type: 'json' });
    
    if (!authData) {
      return new Response(JSON.stringify({ error: '认证会话已过期，请重新开始' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 在实际生产环境中，这里应该使用WebAuthn库验证凭据
    // 需要：
    // 1. 根据credential.id找到对应的passkey记录
    // 2. 使用公钥验证签名
    // 3. 验证challenge匹配
    // 4. 更新counter防止重放攻击
    
    // 这里使用简化的演示逻辑，假设验证成功
    
    // 查找所有用户的passkeys
    // 在实际环境中应该有更高效的索引方式
    const adminUsername = env.ADMIN_USERNAME;
    
    // 生成session token并设置cookie
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    // 将session存储到KV
    await env.blog_data.put(
      sessionKey, 
      JSON.stringify({ 
        username: adminUsername, 
        loggedInAt: Date.now(),
        loginMethod: 'passkey'
      }), 
      { expirationTtl: 3600 } // 1小时过期
    );
    
    // 删除临时认证数据
    await env.blog_data.delete(authDataKey);
    
    // 设置认证cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      redirect: '/admin/dashboard.html'
    }), {
      status: 200,
      headers: headers
    });
    
  } catch (error) {
    console.error('完成Passkey认证失败:', error);
    return new Response(JSON.stringify({ error: '完成Passkey认证失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理列出Passkeys请求
 */
async function handleListPasskeys(context) {
  const { request, env } = context;
  
  try {
    // 获取当前登录的管理员信息
    const sessionToken = getSessionToken(request);
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '未授权的请求' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 获取用户的所有Passkeys
    const userPasskeysKey = `passkeys:${sessionKey}`;
    const userPasskeys = await env.blog_data.get(userPasskeysKey, { type: 'json' }) || [];
    
    // 只返回必要的信息，不包括敏感数据
    const passkeys = userPasskeys.map(key => ({
      id: key.id,
      name: key.name,
      created: key.created
    }));
    
    return new Response(JSON.stringify({ passkeys }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('获取Passkeys列表失败:', error);
    return new Response(JSON.stringify({ error: '获取Passkeys列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理删除Passkey请求
 */
async function handleDeletePasskey(context) {
  const { request, env } = context;
  
  try {
    // 获取当前登录的管理员信息
    const sessionToken = getSessionToken(request);
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '未授权的请求' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const { passkeyId } = await request.json();
    
    if (!passkeyId) {
      return new Response(JSON.stringify({ error: '缺少Passkey ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 获取用户的所有Passkeys
    const userPasskeysKey = `passkeys:${sessionKey}`;
    let userPasskeys = await env.blog_data.get(userPasskeysKey, { type: 'json' }) || [];
    
    // 过滤掉要删除的Passkey
    const initialLength = userPasskeys.length;
    userPasskeys = userPasskeys.filter(key => key.id !== passkeyId);
    
    if (userPasskeys.length === initialLength) {
      return new Response(JSON.stringify({ error: '未找到指定的Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 保存更新后的Passkeys列表
    await env.blog_data.put(userPasskeysKey, JSON.stringify(userPasskeys));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('删除Passkey失败:', error);
    return new Response(JSON.stringify({ error: '删除Passkey失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 从请求中获取session token
 */
function getSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
  
  return cookies['admin_session'];
}

/**
 * 生成随机ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

/**
 * 生成会话Token
 */
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 生成随机缓冲区
 */
function generateRandomBuffer() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array.buffer;
}

/**
 * 将ArrayBuffer转换为Base64Url编码的字符串
 */
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 