import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import Decimal from 'decimal.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

// PUT: Update a product (Admin only)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const { sku, name, description, category, dimension, base_unit, base_price, stock_quantity } = await request.json();

    if (!sku || !name || !category || !dimension || !base_unit || base_price === undefined || stock_quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify product exists
    const prodCheck = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (prodCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check SKU uniqueness if changed
    const skuCheck = await query('SELECT id FROM products WHERE sku = $1 AND id != $2', [sku.trim(), id]);
    if (skuCheck.rowCount! > 0) {
      return NextResponse.json({ error: 'Product with this SKU already exists' }, { status: 409 });
    }

    const price = new Decimal(base_price);
    const stock = new Decimal(stock_quantity);

    if (price.isNaN() || price.isNegative()) {
      return NextResponse.json({ error: 'Invalid base price' }, { status: 400 });
    }
    if (stock.isNaN() || stock.isNegative()) {
      return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE products
       SET sku = $1, name = $2, description = $3, category = $4, dimension = $5, base_unit = $6, base_price = $7, stock_quantity = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [sku.trim().toUpperCase(), name.trim(), description || '', category.trim(), dimension, base_unit, price.toString(), stock.toString(), id]
    );

    return NextResponse.json(updateRes.rows[0]);
  } catch (error: any) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a product (Admin only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const prodCheck = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (prodCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await query('DELETE FROM products WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
