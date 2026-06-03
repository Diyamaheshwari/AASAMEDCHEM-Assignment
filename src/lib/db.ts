import { Pool } from 'pg';

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Neon connection in production
    },
  });
} else {
  // Prevent multiple pool instances in development hot reloading
  if (!(global as any)._postgresPool) {
    (global as any)._postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
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
    // Log queries in development for visibility
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Error executing query', { text, error });
    throw error;
  }
};

export default pool;
