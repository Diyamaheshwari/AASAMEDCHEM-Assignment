import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool, { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { createNotification, notifyAllStaff } from '@/lib/notifications';
import Decimal from 'decimal.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

// PUT: Update order status (Seller only)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'seller') {
      return NextResponse.json({ error: 'Forbidden: Only sellers can verify or update order statuses' }, { status: 403 });
    }

    const { id } = await params;

    // Verify that the logged-in seller is responsible for at least one product in this order
    const sellerCheck = await query(
      `SELECT DISTINCT p.seller_id 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    const isResponsible = sellerCheck.rows.some((row: any) => row.seller_id === session.userId);
    if (!isResponsible) {
      return NextResponse.json({ error: 'Forbidden: You can only update orders containing your products' }, { status: 403 });
    }

    const { status } = await request.json(); // 'pending', 'approved', 'rejected', 'completed'

    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Connect database client for transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch the current order
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      if (orderRes.rowCount === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];
      const previousStatus = order.status;

      if (previousStatus === status) {
        // Status is the same, no action needed
        await client.query('COMMIT');
        client.release();
        return NextResponse.json(order);
      }

      // If transitioning to 'rejected' from a non-rejected state, restore stock
      if (status === 'rejected' && previousStatus !== 'rejected') {
        // Fetch order items to restore stock
        const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        const items = itemsRes.rows;

        for (const item of items) {
          // Lock product row
          const prodRes = await client.query('SELECT stock_quantity, name FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
          if (prodRes.rowCount! > 0) {
            const product = prodRes.rows[0];
            const currentStock = new Decimal(product.stock_quantity);
            const baseQty = new Decimal(item.base_quantity);
            const restoredStock = currentStock.plus(baseQty);

            await client.query(
              'UPDATE products SET stock_quantity = $1 WHERE id = $2',
              [restoredStock.toString(), item.product_id]
            );
            console.log(`\x1b[35m[INVENTORY]\x1b[0m ♻️ Restored stock for '${product.name}': +${baseQty.toString()} (New: ${restoredStock.toString()})`);
          }
        }
      }

      // If transitioning OUT of 'rejected' into a active state (e.g. pending/approved/completed), deduct stock
      if (previousStatus === 'rejected' && status !== 'rejected') {
        const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        const items = itemsRes.rows;

        for (const item of items) {
          // Lock product row and check stock
          const prodRes = await client.query('SELECT stock_quantity, name, sku, base_unit FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
          if (prodRes.rowCount === 0) {
            throw new Error(`Product not found during stock deduction.`);
          }

          const product = prodRes.rows[0];
          const currentStock = new Decimal(product.stock_quantity);
          const baseQty = new Decimal(item.base_quantity);

          if (currentStock.lessThan(baseQty)) {
            throw new Error(`Cannot re-activate order: Insufficient stock for '${product.name}'. Available: ${currentStock.toString()}, Needed: ${baseQty.toString()}`);
          }

          const newStock = currentStock.minus(baseQty);
          await client.query(
            'UPDATE products SET stock_quantity = $1 WHERE id = $2',
            [newStock.toString(), item.product_id]
          );
          console.log(`\x1b[35m[INVENTORY]\x1b[0m 📦 Deducted stock for '${product.name}': -${baseQty.toString()} (New: ${newStock.toString()})`);

          // Check low stock threshold on re-deduction
          const threshold = product.base_unit === 'items' ? new Decimal(10) : new Decimal(1000);
          if (newStock.lessThan(threshold)) {
            notifyAllStaff({
              title: `Low Stock Alert: ${product.name}`,
              message: `Stock level for ${product.name} (${product.sku}) is critically low: ${newStock.toString()} ${product.base_unit} remaining.`,
              type: 'low_stock',
              link: '/admin?tab=products'
            }).catch(err => console.error('Low stock notification error:', err));
          }
        }
      }

      // Update Order Status
      const updateRes = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      await client.query('COMMIT');
      client.release();

      // Trigger notification for the user who placed the order
      const statusTextMap: Record<string, string> = {
        approved: 'Approved',
        rejected: 'Rejected',
        completed: 'Completed',
      };
      
      const statusLabel = statusTextMap[status];
      if (statusLabel) {
        createNotification({
          userId: order.user_id,
          title: `Quotation ${statusLabel}`,
          message: `Your quotation #${id.substring(0, 8)}... of total ₹${parseFloat(order.total_price).toFixed(2)} has been ${status.toLowerCase()} by Seller ${session.name}.`,
          type: 'order_status',
          link: '/seller?tab=history'
        }).catch(err => console.error('Notification error on status change:', err));
      }

      return NextResponse.json(updateRes.rows[0]);
    } catch (txError: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error('Order status update rollback reason:', txError.message);
      return NextResponse.json({ error: txError.message || 'Transaction failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
