import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

// GET: Fetch all users (Admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const dbRes = await query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY role, name'
    );
    return NextResponse.json(dbRes.rows);
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
