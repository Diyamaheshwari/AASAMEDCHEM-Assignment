import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL || '';

// Dynamically handle verify-full to resolve the SSL Mode warnings in pg driver
if (connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Required for Neon connection in production
    },
  });
} else {
  // Prevent multiple pool instances in development hot reloading
  if (!(global as any)._postgresPool) {
    (global as any)._postgresPool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  pool = (global as any)._postgresPool;
}

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Premium database logging format
    if (process.env.NODE_ENV !== 'production') {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const statusEmoji = duration > 500 ? '⚠️' : '⚡';
      const durationColor = duration > 500 ? '\x1b[33m' : '\x1b[32m'; // Yellow for slow, Green for fast
      console.log(
        `\x1b[34m[DATABASE]\x1b[0m ${statusEmoji} ${durationColor}${duration}ms\x1b[0m | ` +
        `\x1b[35mRows: ${res.rowCount !== null ? res.rowCount : 0}\x1b[0m | ` +
        `\x1b[36m"${cleanText.length > 80 ? cleanText.substring(0, 80) + '...' : cleanText}"\x1b[0m`
      );
    }
    return res;
  } catch (error) {
    console.error('\x1b[31m[DB ERROR]\x1b[0m Error executing query', { text, error });
    throw error;
  }
};

export default pool;
