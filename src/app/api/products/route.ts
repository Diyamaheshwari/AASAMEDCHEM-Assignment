import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import Decimal from 'decimal.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

// Utility helper to authenticate role
async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

// GET: Fetch all products
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbRes = await query('SELECT * FROM products ORDER BY category, name');
    return NextResponse.json(dbRes.rows);
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a product (Admin only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { sku, name, description, category, dimension, base_unit, base_price, stock_quantity } = await request.json();

    if (!sku || !name || !category || !dimension || !base_unit || base_price === undefined || stock_quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate dimension and base unit constraints
    const validDimensions = ['weight', 'volume', 'count'];
    const validBaseUnits = ['g', 'mL', 'items'];
    if (!validDimensions.includes(dimension)) {
      return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 });
    }
    if (!validBaseUnits.includes(base_unit)) {
      return NextResponse.json({ error: 'Invalid base unit' }, { status: 400 });
    }

    // Check SKU uniqueness
    const skuCheck = await query('SELECT id FROM products WHERE sku = $1', [sku.trim()]);
    if (skuCheck.rowCount! > 0) {
      return NextResponse.json({ error: 'Product with this SKU already exists' }, { status: 409 });
    }

    // Store prices and stock levels with Decimal
    const price = new Decimal(base_price);
    const stock = new Decimal(stock_quantity);

    if (price.isNaN() || price.isNegative()) {
      return NextResponse.json({ error: 'Invalid base price' }, { status: 400 });
    }
    if (stock.isNaN() || stock.isNegative()) {
      return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 });
    }

    const insertRes = await query(
      `INSERT INTO products (sku, name, description, category, dimension, base_unit, base_price, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sku.trim().toUpperCase(), name.trim(), description || '', category.trim(), dimension, base_unit, price.toString(), stock.toString()]
    );

    return NextResponse.json(insertRes.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
