import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashPassword, signJWT, verifyJWT } from '@/lib/auth';
import { notifyAllAdmins } from '@/lib/notifications';
import { query } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'All fields (email, password, name, role) are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'seller', 'buyer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin', 'seller', or 'buyer'" },
        { status: 400 }
      );
    }

    // Role protection: Only Admins can create Admins and Sellers
    if (role === 'admin' || role === 'seller') {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can create sellers or administrators' },
          { status: 403 }
        );
      }
    }

    // Check if email already exists
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rowCount! > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashed = await hashPassword(password);

    // Insert user
    const insertRes = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email.toLowerCase().trim(), hashed, name.trim(), role]
    );

    const newUser = insertRes.rows[0];

    const response = NextResponse.json(
      {
        message: 'User registered successfully',
        user: newUser,
      },
      { status: 201 }
    );

    // Sign session token only for new self-registered Buyers
    // If Admin created the account, do not overwrite the Admin's session token!
    if (role === 'buyer') {
      const tokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
      };
      
      const token = await signJWT(tokenPayload, JWT_SECRET);

      // Set secure cookie for Buyer session
      response.cookies.set({
        name: 'session_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
      
      // Notify all admins of the new buyer registration
      await notifyAllAdmins({
        title: 'New Client Registered',
        message: `Client ${newUser.name} (${newUser.email}) has created a buyer account.`,
        type: 'new_user',
        link: '/admin?tab=users'
      });
    }

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
