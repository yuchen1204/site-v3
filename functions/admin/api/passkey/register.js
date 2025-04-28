/**
 * Cloudflare Pages Function for handling passkey registration
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/browser';

// 适用于Cloudflare Pages的相对路径
const rpID = new URL(process.env.CF_PAGES_URL || 'https://localhost').hostname;
const rpName = '个人网站管理员';

// 生成注册选项
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
    
    // 从KV中获取已存在的用户记录
    const userKey = `user:${adminUsername}`;
    let userRecord = await env.blog_data.get(userKey, { type: 'json' });
    
    // 如果用户记录不存在，创建新的
    if (!userRecord) {
      userRecord = {
        id: adminUsername,
        username: adminUsername,
        devices: []
      };
    }
    
    // 生成注册选项
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userRecord.id,
      userName: userRecord.username,
      // 避免重复注册相同的身份验证器
      excludeCredentials: userRecord.devices.map(device => ({
        id: isoBase64URL.toBuffer(device.credentialID),
        type: 'public-key',
        transports: device.transports || ['internal']
      })),
      authenticatorSelection: {
        // 使用平台身份验证器（如指纹、面部识别等）
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        userVerification: 'preferred'
      }
    });
    
    // 存储挑战到KV供后续验证使用
    const challengeKey = `challenge:${adminUsername}:registration`;
    await env.blog_data.put(challengeKey, options.challenge, { expirationTtl: 300 }); // 5分钟过期
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成注册选项出错:', error);
    return new Response(JSON.stringify({ error: '生成注册选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 验证注册响应
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { registrationResponse } = body;
    
    if (!registrationResponse) {
      return new Response(JSON.stringify({ error: '注册响应数据缺失' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从环境变量获取管理员用户名
    const adminUsername = env.ADMIN_USERNAME;
    
    // 从KV获取之前存储的挑战
    const challengeKey = `challenge:${adminUsername}:registration`;
    const expectedChallenge = await env.blog_data.get(challengeKey);
    
    if (!expectedChallenge) {
      return new Response(JSON.stringify({ error: '挑战已过期或不存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证响应
    const origin = new URL(request.url).origin;
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });
    
    if (!verification.verified) {
      return new Response(JSON.stringify({ error: '注册验证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 从KV中获取用户记录
    const userKey = `user:${adminUsername}`;
    let userRecord = await env.blog_data.get(userKey, { type: 'json' });
    
    // 如果用户记录不存在，创建新的
    if (!userRecord) {
      userRecord = {
        id: adminUsername,
        username: adminUsername,
        devices: []
      };
    }
    
    // 保存新设备
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    
    const newDevice = {
      credentialID: isoBase64URL.fromBuffer(credentialID),
      credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
      counter,
      transports: registrationResponse.response.transports || ['internal'],
      registered: new Date().toISOString()
    };
    
    userRecord.devices.push(newDevice);
    
    // 更新用户记录
    await env.blog_data.put(userKey, JSON.stringify(userRecord));
    
    // 删除挑战
    await env.blog_data.delete(challengeKey);
    
    return new Response(JSON.stringify({ success: true, message: 'Passkey注册成功' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('处理注册响应出错:', error);
    return new Response(JSON.stringify({ error: '处理注册响应失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 