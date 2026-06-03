import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signJWT } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      HAS_JWT_SECRET: !!process.env.JWT_SECRET,
    },
    database: {
      connected: false,
      error: null,
      tableCheck: {},
    },
    crypto: {
      working: false,
      error: null,
    }
  };

  // 1. Check database connection
  try {
    const dbRes = await query('SELECT NOW()');
    diagnostics.database.connected = true;
    diagnostics.database.time = dbRes.rows[0]?.now;
    
    // Check tables
    try {
      const usersCheck = await query('SELECT COUNT(*) FROM users');
      diagnostics.database.tableCheck.users = `Exists (${usersCheck.rows[0].count} rows)`;
    } catch (e: any) {
      diagnostics.database.tableCheck.users = `Error: ${e.message}`;
    }

    try {
      const productsCheck = await query('SELECT COUNT(*) FROM products');
      diagnostics.database.tableCheck.products = `Exists (${productsCheck.rows[0].count} rows)`;
    } catch (e: any) {
      diagnostics.database.tableCheck.products = `Error: ${e.message}`;
    }

    try {
      const notificationsCheck = await query('SELECT COUNT(*) FROM notifications');
      diagnostics.database.tableCheck.notifications = `Exists (${notificationsCheck.rows[0].count} rows)`;
    } catch (e: any) {
      diagnostics.database.tableCheck.notifications = `Error: ${e.message}`;
    }
  } catch (err: any) {
    diagnostics.database.error = err.message || 'Unknown database connection error';
  }

  // 2. Check crypto logic
  try {
    const testSecret = process.env.JWT_SECRET || 'test_secret_key_123';
    const testPayload = { userId: '1', email: 'test@example.com', role: 'admin' as any, name: 'Test' };
    const token = await signJWT(testPayload, testSecret);
    diagnostics.crypto.working = !!token;
  } catch (err: any) {
    diagnostics.crypto.error = err.message || 'Crypto error';
  }

  return NextResponse.json(diagnostics);
}
