import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool, { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { createNotification, notifyAllAdmins, notifyAllStaff } from '@/lib/notifications';
import { convertToBase, calculateUnitPrice, calculateItemPrice, UNIT_DIMENSIONS } from '@/lib/converter';
import Decimal from 'decimal.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  return verifyJWT(token, JWT_SECRET);
}

// GET: Fetch orders list (Admin sees all, Seller sees their own)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let ordersQuery = '';
    let queryParams: any[] = [];

    if (session.role === 'admin') {
      // Admin query: Fetch all orders with user names
      ordersQuery = `
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `;
    } else {
      // Seller query: Fetch user's own orders
      ordersQuery = `
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `;
      queryParams = [session.userId];
    }

    const ordersRes = await query(ordersQuery, queryParams);
    const orders = ordersRes.rows;

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsRes = await query(
          `SELECT oi.*, p.name as product_name, p.sku as product_sku, p.category as product_category, p.base_unit as product_base_unit, p.base_price as product_base_price
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        return {
          ...order,
          items: itemsRes.rows,
        };
      })
    );

    return NextResponse.json(ordersWithItems);
  } catch (error) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Place a quotation/order (Sellers only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'seller' && session.role !== 'buyer') {
      return NextResponse.json({ error: 'Forbidden: Only sellers and buyers can place orders' }, { status: 403 });
    }

    const { items } = await request.json(); // Array of { productId, orderedQuantity, orderedUnit }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one product' }, { status: 400 });
    }

    // Connect database client for transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let orderTotalPrice = new Decimal(0);
      const itemsToInsert: any[] = [];
      const lowStockAlerts: any[] = [];

      for (const item of items) {
        const { productId, orderedQuantity, orderedUnit } = item;

        if (!productId || orderedQuantity === undefined || !orderedUnit) {
          throw new Error('Invalid item fields: productId, orderedQuantity, and orderedUnit are required.');
        }

        const qtyOrdered = new Decimal(orderedQuantity);
        if (qtyOrdered.isNaN() || qtyOrdered.lessThanOrEqualTo(0)) {
          throw new Error('Ordered quantity must be greater than zero.');
        }

        // Lock product row for update to prevent stock race conditions
        const prodRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (prodRes.rowCount === 0) {
          throw new Error(`Product not found (ID: ${productId}).`);
        }

        const product = prodRes.rows[0];

        // Validate unit dimension compatibility
        const expectedDimension = product.dimension;
        const actualDimension = UNIT_DIMENSIONS[orderedUnit];
        if (actualDimension !== expectedDimension) {
          throw new Error(`Invalid unit '${orderedUnit}' for product '${product.name}' (dimension: ${expectedDimension}).`);
        }

        // Perform conversions using decimal.js
        const baseQty = convertToBase(qtyOrdered, orderedUnit);
        const currentStock = new Decimal(product.stock_quantity);

        // Check stock availability
        if (currentStock.lessThan(baseQty)) {
          throw new Error(`Insufficient stock for '${product.name}'. Available: ${currentStock.toString()} ${product.base_unit}, Requested: ${baseQty.toString()} ${product.base_unit}.`);
        }

        // Deduct stock
        const newStock = currentStock.minus(baseQty);
        await client.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [newStock.toString(), productId]);

        // Check low stock threshold
        const threshold = product.base_unit === 'items' ? new Decimal(10) : new Decimal(1000);
        if (newStock.lessThan(threshold)) {
          lowStockAlerts.push({
            name: product.name,
            sku: product.sku,
            unit: product.base_unit,
            stock: newStock.toString(),
          });
        }

        // Price calculations
        const basePrice = new Decimal(product.base_price);
        const unitPrice = calculateUnitPrice(basePrice, orderedUnit);
        const itemPrice = calculateItemPrice(basePrice, qtyOrdered, orderedUnit);

        orderTotalPrice = orderTotalPrice.plus(itemPrice);

        itemsToInsert.push({
          productId,
          orderedUnit,
          orderedQuantity: qtyOrdered.toString(),
          baseQuantity: baseQty.toString(),
          unitPrice: unitPrice.toString(),
          totalItemPrice: itemPrice.toString(),
        });
      }

      // Insert Order Header
      const orderInsertRes = await client.query(
        `INSERT INTO orders (user_id, status, total_price)
         VALUES ($1, 'pending', $2)
         RETURNING id`,
        [session.userId, orderTotalPrice.toString()]
      );

      const orderId = orderInsertRes.rows[0].id;

      // Insert Order Items
      for (const item of itemsToInsert) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, ordered_unit, ordered_quantity, base_quantity, unit_price, total_item_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            item.productId,
            item.orderedUnit,
            item.orderedQuantity,
            item.baseQuantity,
            item.unitPrice,
            item.totalItemPrice,
          ]
        );
      }

      await client.query('COMMIT');
      client.release();

      // Trigger notifications asynchronously
      Promise.all([
        notifyAllAdmins({
          title: 'New Quotation Placed',
          message: `Quotation #${orderId.substring(0, 8)}... placed by ${session.name} (${session.email}) of total ₹${orderTotalPrice.toFixed(2)}.`,
          type: 'new_order',
          link: '/admin?tab=orders'
        }),
        createNotification({
          userId: session.userId,
          title: 'Quotation Placed Successfully',
          message: `Your quotation #${orderId.substring(0, 8)}... of ₹${orderTotalPrice.toFixed(2)} has been submitted and is pending review.`,
          type: 'order_status',
          link: '/seller?tab=history'
        }),
        ...lowStockAlerts.map(alert =>
          notifyAllStaff({
            title: `Low Stock Alert: ${alert.name}`,
            message: `Stock level for ${alert.name} (${alert.sku}) is critically low: ${alert.stock} ${alert.unit} remaining.`,
            type: 'low_stock',
            link: '/admin?tab=products'
          })
        )
      ]).catch(err => console.error('Notification trigger error:', err));

      return NextResponse.json({ message: 'Order placed successfully', orderId }, { status: 201 });
    } catch (txError: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error('Order transaction rollback reason:', txError.message);
      return NextResponse.json({ error: txError.message || 'Transaction failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
