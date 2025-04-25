import postgres from 'postgres';

// --- Configuration: Adjust these based on your DB schema ---
const POSTS_TABLE = 'posts';
const POSTS_COLUMNS = ['id', 'title', 'date', 'category', 'content'];

const ATTACHMENTS_TABLE = 'attachments';
const ATTACHMENTS_COLUMNS = ['post_id', 'url', 'type', 'filename'];

const REFERENCES_TABLE = 'references'; // Assumes a join table (post_id, referenced_post_id)
const REFERENCES_COLUMNS = ['post_id', 'referenced_post_id'];
// ---

export async function onRequest(context) {
  const { env } = context;
  const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = env;

  if (!DB_HOST || !DB_PORT || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) {
    console.error('Database environment variables are not set.');
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sql;
  try {
    const connectionString = `postgres://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
    sql = postgres(connectionString, { 
      idle_timeout: undefined,
      connect_timeout: 10
    });

    // 1. Fetch all blog posts
    const postsResult = await sql`
      SELECT ${sql(POSTS_COLUMNS)}
      FROM ${sql(POSTS_TABLE)}
      ORDER BY date DESC -- Or however you want to order them initially
    `;

    if (postsResult.length === 0) {
       await sql.end({ timeout: 5 });
      return new Response(JSON.stringify([]), { // Return empty array if no posts
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const postIds = postsResult.map(post => post.id);

    // 2. Fetch all attachments for these posts
    const attachmentsResult = await sql`
      SELECT ${sql(ATTACHMENTS_COLUMNS)}
      FROM ${sql(ATTACHMENTS_TABLE)}
      WHERE post_id = ANY(${postIds})
    `;

    // 3. Fetch all references for these posts
    const referencesResult = await sql`
      SELECT ${sql(REFERENCES_COLUMNS)}
      FROM ${sql(REFERENCES_TABLE)}
      WHERE post_id = ANY(${postIds})
    `;
    
    // 4. Map attachments and references to their respective posts
    const attachmentsMap = attachmentsResult.reduce((acc, attachment) => {
      const postId = attachment.post_id;
      if (!acc[postId]) {
        acc[postId] = [];
      }
      // Exclude post_id from the final attachment object
      const { post_id, ...rest } = attachment;
      acc[postId].push(rest);
      return acc;
    }, {});

    const referencesMap = referencesResult.reduce((acc, reference) => {
      const postId = reference.post_id;
      if (!acc[postId]) {
        acc[postId] = [];
      }
      acc[postId].push(reference.referenced_post_id);
      return acc;
    }, {});

    // 5. Combine data into the final structure expected by the frontend
    const responseData = postsResult.map(post => ({
      ...post,
      attachments: attachmentsMap[post.id] || [],
      references: referencesMap[post.id] || [],
    }));

    await sql.end({ timeout: 5 });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching blog data:', error);
    if (sql) {
      await sql.end({ timeout: 5 }).catch(closeErr => console.error("Error closing connection:", closeErr));
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch blog data.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 