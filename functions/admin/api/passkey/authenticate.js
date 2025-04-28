/**
 * Cloudflare Pages Function for handling passkey authentication
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/browser';

// 适用于Cloudflare Pages的相对路径
const rpID = new URL(process.env.CF_PAGES_URL || 'https://localhost').hostname;

// 生成身份验证选项
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 从环境变量获取管理员用户名
    const adminUsername = env.ADMIN_USERNAME;
    
    if (!adminUsername) {
      return new Response(JSON.stringify({ error: '管理员用户名未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从KV中获取用户记录
    const userKey = `user:${adminUsername}`;
    const userRecord = await env.blog_data.get(userKey, { type: 'json' });
    
    // 如果用户记录不存在或没有注册设备
    if (!userRecord || !userRecord.devices || userRecord.devices.length === 0) {
      return new Response(JSON.stringify({ error: '未找到已注册的Passkey设备' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 生成身份验证选项
    const options = await generateAuthenticationOptions({
      rpID,
      // 指定允许的凭证
      allowCredentials: userRecord.devices.map(device => ({
        id: isoBase64URL.toBuffer(device.credentialID),
        type: 'public-key',
        transports: device.transports || ['internal']
      })),
      userVerification: 'preferred'
    });
    
    // 存储挑战到KV供后续验证使用
    const challengeKey = `challenge:${adminUsername}:authentication`;
    await env.blog_data.put(challengeKey, options.challenge, { expirationTtl: 300 }); // 5分钟过期
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成身份验证选项出错:', error);
    return new Response(JSON.stringify({ error: '生成身份验证选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 验证身份验证响应
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { authenticationResponse } = body;
    
    if (!authenticationResponse) {
      return new Response(JSON.stringify({ error: '身份验证响应数据缺失' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从环境变量获取管理员用户名
    const adminUsername = env.ADMIN_USERNAME;
    
    // 从KV获取之前存储的挑战
    const challengeKey = `challenge:${adminUsername}:authentication`;
    const expectedChallenge = await env.blog_data.get(challengeKey);
    
    if (!expectedChallenge) {
      return new Response(JSON.stringify({ error: '挑战已过期或不存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从KV中获取用户记录
    const userKey = `user:${adminUsername}`;
    const userRecord = await env.blog_data.get(userKey, { type: 'json' });
    
    if (!userRecord || !userRecord.devices || userRecord.devices.length === 0) {
      return new Response(JSON.stringify({ error: '未找到已注册的Passkey设备' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 找到匹配的设备
    const credentialID = authenticationResponse.id;
    const matchingDevice = userRecord.devices.find(
      device => device.credentialID === credentialID
    );
    
    if (!matchingDevice) {
      return new Response(JSON.stringify({ error: '未找到匹配的Passkey设备' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证响应
    const origin = new URL(request.url).origin;
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialPublicKey: isoBase64URL.toBuffer(matchingDevice.credentialPublicKey),
        credentialID: isoBase64URL.toBuffer(matchingDevice.credentialID),
        counter: matchingDevice.counter
      }
    });
    
    if (!verification.verified) {
      return new Response(JSON.stringify({ error: '身份验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 更新设备计数器
    matchingDevice.counter = verification.authenticationInfo.newCounter;
    
    // 更新用户记录
    await env.blog_data.put(userKey, JSON.stringify(userRecord));
    
    // 删除挑战
    await env.blog_data.delete(challengeKey);
    
    // 生成会话 token 并设置 cookie
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    // 将 session token 存储在 KV 中 (设置过期时间，例如 1 小时)
    await env.blog_data.put(sessionKey, JSON.stringify({ 
      username: adminUsername, 
      loggedInAt: Date.now(),
      authMethod: 'passkey'
    }), {
      expirationTtl: 3600 // 1 hour
    });
    
    // 设置 HttpOnly cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ success: true, message: 'Passkey身份验证成功' }), {
      status: 200,
      headers: headers
    });
  } catch (error) {
    console.error('处理身份验证响应出错:', error);
    return new Response(JSON.stringify({ error: '处理身份验证响应失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 简单的 session token 生成 (与login.js中保持一致)
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 