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

// GET: Retrieve the list of notifications for the active user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationsRes = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [session.userId]
    );

    return NextResponse.json(notificationsRes.rows);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Mark notification(s) as read
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, all } = await request.json();

    if (all) {
      await query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE user_id = $1`,
        [session.userId]
      );
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing notification ID or "all" flag' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE user_id = $1 AND id = $2 
       RETURNING *`,
      [session.userId, id]
    );

    if (updateRes.rowCount === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(updateRes.rows[0]);
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
