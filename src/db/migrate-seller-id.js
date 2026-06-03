const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env.local file
const envPath = path.join(__dirname, '..', '..', '.env.local');
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.*)/);
  if (match && match[1]) {
    databaseUrl = match[1].trim();
  }
}

if (!databaseUrl) {
  console.error('Error: DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    // 1. Check if column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'seller_id'
    `);

    if (columnCheck.rowCount === 0) {
      console.log('Adding seller_id column to products table...');
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN seller_id UUID REFERENCES users(id) ON DELETE SET NULL;
        
        CREATE INDEX idx_products_seller_id ON products(seller_id);
      `);
      console.log('Column and index added.');
    } else {
      console.log('seller_id column already exists in products table.');
    }

    // 2. Fetch default seller ID to seed existing products
    const sellerRes = await client.query("SELECT id FROM users WHERE email = 'seller@aasamedchem.com'");
    if (sellerRes.rowCount > 0) {
      const sellerId = sellerRes.rows[0].id;
      console.log(`Setting seller_id for existing products to default seller (ID: ${sellerId})...`);
      const updateRes = await client.query(
        "UPDATE products SET seller_id = $1 WHERE seller_id IS NULL",
        [sellerId]
      );
      console.log(`Updated ${updateRes.rowCount} products.`);
    } else {
      console.log('Default seller user (seller@aasamedchem.com) not found. Skipping product seeding.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
