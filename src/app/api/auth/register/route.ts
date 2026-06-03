import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, signJWT } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'All fields (email, password, name, role) are required' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'seller') {
      return NextResponse.json(
        { error: "Role must be either 'admin' or 'seller'" },
        { status: 400 }
      );
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

    // Sign JWT
    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    };
    
    const token = await signJWT(tokenPayload, JWT_SECRET);

    const response = NextResponse.json(
      {
        message: 'User registered successfully',
        user: newUser,
      },
      { status: 201 }
    );

    // Set secure cookie
    response.cookies.set({
      name: 'session_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
