import postgres from 'postgres';

// Define the expected structure for the profile data
// Note: Adjust table and column names if your schema differs.
const PROFILE_TABLE = 'profile'; // Example table name
const PROFILE_COLUMNS = ['name', 'avatar', 'motto']; // Example columns

// Define the expected structure for social links (assuming a separate table)
const SOCIAL_LINKS_TABLE = 'social_links'; // Example table name
const SOCIAL_LINKS_COLUMNS = ['platform', 'url', 'icon'];
const PROFILE_ID_COLUMN = 'profile_id'; // Foreign key in social_links table

export async function onRequest(context) {
  // Environment variables should be configured in Cloudflare Pages settings
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
    // Construct the connection string
    const connectionString = `postgres://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
    
    // Initialize the PostgreSQL client
    // We disable idle timeout as recommended for serverless environments like Cloudflare Workers
    // connect_timeout helps prevent hanging connections
    sql = postgres(connectionString, { 
      idle_timeout: undefined, // Disable idle timeout
      connect_timeout: 10 // 10 seconds connection timeout
    });

    // Fetch profile data (assuming only one profile entry, e.g., id=1)
    // Adjust the query based on your actual schema and how you identify the profile
    const profileResult = await sql`
      SELECT ${sql(PROFILE_COLUMNS)}
      FROM ${sql(PROFILE_TABLE)}
      LIMIT 1 
    `; // Example: LIMIT 1 or add WHERE id = 1

    if (profileResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Profile data not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const profileData = profileResult[0];

    // Fetch social links (assuming a foreign key like profile_id links to the profile table)
    // Adjust the query based on your schema. If profile has an id, use it here.
    // If profile table doesn't have an explicit ID used here, adjust the query logic.
    // Example assumes profileResult[0] has an 'id' field, or you have a fixed profile ID (e.g., 1).
    const profileId = profileData.id || 1; // Adjust this logic based on your schema
    const socialLinksResult = await sql`
      SELECT ${sql(SOCIAL_LINKS_COLUMNS)}
      FROM ${sql(SOCIAL_LINKS_TABLE)}
      WHERE ${sql(PROFILE_ID_COLUMN)} = ${profileId} 
    `;

    // Combine profile data and social links
    const responseData = {
      ...profileData,
      socialLinks: socialLinksResult,
    };

    // Close the connection
    await sql.end({ timeout: 5 }); // 5 seconds timeout for closing

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching profile data:', error);
    
    // Try to close the connection if it was established
    if (sql) {
      await sql.end({ timeout: 5 }).catch(closeErr => console.error("Error closing connection:", closeErr));
    }
    
    // Return a generic server error response
    return new Response(JSON.stringify({ error: 'Failed to fetch profile data.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 