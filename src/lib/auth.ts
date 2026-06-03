import bcrypt from 'bcryptjs';

// JWT implementation using globally available Web Crypto API
// This works perfectly in both Node.js (API routes) and Edge (Middleware) runtimes on Vercel.

const encoder = new TextEncoder();

function base64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'seller';
  name: string;
  exp?: number;
}

/**
 * Signs a payload with HS256 algorithm and returns a JWT string
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // Set default expiration of 7 days if not provided
  const exp = payload.exp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const fullPayload = { ...payload, exp };

  const headerStr = base64url(encoder.encode(JSON.stringify(header)));
  const payloadStr = base64url(encoder.encode(JSON.stringify(fullPayload)));
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${headerStr}.${payloadStr}`)
  );
  
  return `${headerStr}.${payloadStr}.${base64url(new Uint8Array(signature))}`;
}

/**
 * Verifies a JWT string using HS256 algorithm and returns decoded payload, or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerStr, payloadStr, signatureStr] = parts;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signatureStr) as any,
      encoder.encode(`${headerStr}.${payloadStr}`)
    );
    
    if (!verified) return null;
    
    const decodedPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadStr))) as JWTPayload;
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Hash password using bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare plain password against bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
