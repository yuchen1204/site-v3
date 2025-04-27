/**
 * 将 ArrayBuffer 转换为十六进制字符串
 * @param {ArrayBuffer} buffer - ArrayBuffer
 * @returns {string} 十六进制字符串
 */
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 异步计算字符串的 MD5 哈希值
 * @param {string} str - 输入字符串
 * @returns {Promise<string>} MD5 哈希值 (十六进制)
 */
async function calculateMD5(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // 注意：MD5 在 Cloudflare Workers 中可以通过 SubtleCrypto 支持
  // 但某些旧环境或特定配置下可能不支持。这里假设它是可用的。
  // 如果遇到问题，可能需要引入纯 JS 的 MD5 库。
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  return bufferToHex(hashBuffer);
}

/**
 * POST /api/comments
 * 提交新的评论
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const commentData = await request.json();

    // 基本验证 - 增加 email
    if (!commentData.postId || !commentData.author || !commentData.text || !commentData.email) {
      return new Response('Missing required comment fields (postId, author, email, text)', { status: 400 });
    }

    // 简单邮箱格式验证 (非严格)
    if (!/\S+@\S+\.\S+/.test(commentData.email)) {
        return new Response('Invalid email format', { status: 400 });
    }

    const postId = commentData.postId;
    const kvKey = `comments:${postId}`;

    // 处理邮箱：小写并去除首尾空格
    const email = commentData.email.trim().toLowerCase();
    // 计算 MD5 哈希
    const emailHash = await calculateMD5(email);

    // 获取现有的评论列表
    let comments = [];
    const existingCommentsJson = await env.blog_data.get(kvKey);
    if (existingCommentsJson) {
      try {
        comments = JSON.parse(existingCommentsJson);
      } catch (e) {
        console.error(`Error parsing existing comments for post ${postId}:`, e);
        // 如果解析失败，我们可以选择覆盖或返回错误，这里选择继续并可能覆盖旧数据
        comments = [];
      }
    }

    // 创建新评论对象 - 添加 emailHash
    const newComment = {
      id: crypto.randomUUID(), // 添加唯一ID，便于未来管理
      author: commentData.author.trim(),
      text: commentData.text.trim(),
      timestamp: new Date().toISOString(),
      emailHash: emailHash, // 存储邮箱的 MD5 哈希值
    };

    // 添加新评论到列表
    comments.push(newComment);

    // 将更新后的评论列表存回KV
    // 注意：KV写入是最终一致性的
    await env.blog_data.put(kvKey, JSON.stringify(comments));

    // 返回成功响应，可以包含新评论的数据 - 确保包含 emailHash
    return new Response(JSON.stringify({ success: true, comment: newComment }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201 // Created
    });

  } catch (error) {
    console.error('Error submitting comment:', error);
    // 避免在响应中暴露过多错误细节
    if (error instanceof SyntaxError) {
        return new Response('Invalid JSON format in request body', { status: 400 });
    }
    return new Response('Failed to submit comment', { status: 500 });
  }
}

// 处理 OPTIONS 请求 (CORS 预检请求)
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', // 允许所有来源，生产环境应更严格
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
} 