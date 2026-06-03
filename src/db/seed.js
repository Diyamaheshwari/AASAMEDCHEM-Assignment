const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env.local file manually since this script runs outside Next.js
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
    console.log('Connecting to Neon PostgreSQL...');
    await client.connect();
    console.log('Connected successfully.');

    // 1. Read and run schema.sql
    console.log('Executing schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('Schema executed successfully.');

    // 2. Hash passwords
    console.log('Hashing passwords for seed users...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const sellerHash = await bcrypt.hash('seller123', 10);

    // 3. Insert Users
    console.log('Inserting seed users...');
    const userInsertQuery = `
      INSERT INTO users (email, password_hash, name, role)
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      RETURNING id, email, role;
    `;
    const userRes = await client.query(userInsertQuery, [
      'admin@aasamedchem.com', adminHash, 'Admin Dr. Sarah', 'admin',
      'seller@aasamedchem.com', sellerHash, 'Seller Ravi Kumar', 'seller'
    ]);
    console.log('Inserted users:', userRes.rows);

    // 4. Insert Products
    console.log('Inserting seed products...');
    const products = [
      {
        sku: 'CHEM-ETH-001',
        name: 'Ethanol 99.9% AR Grade',
        description: 'High-purity Absolute Ethanol, suitable for chemical analysis and synthesis applications.',
        category: 'Solvents',
        dimension: 'volume',
        base_unit: 'mL',
        base_price: 0.15, // Price per mL (equivalent to ₹150 per L)
        stock_quantity: 500000 // 500 Liters (stored in milliliters)
      },
      {
        sku: 'CHEM-NACL-002',
        name: 'Sodium Chloride Analytical Reagent',
        description: 'Analytical reagent grade Sodium Chloride powder, purity >= 99.5%.',
        category: 'Salts & Reagents',
        dimension: 'weight',
        base_unit: 'g',
        base_price: 0.85, // Price per gram (equivalent to ₹850 per kg)
        stock_quantity: 25000 // 25 kg (stored in grams)
      },
      {
        sku: 'CHEM-ASP-003',
        name: 'Aspirin (Acetylsalicylic Acid)',
        description: 'Acetylsalicylic acid active pharmaceutical ingredient (API), reference standard grade.',
        category: 'Active Ingredients',
        dimension: 'weight',
        base_unit: 'g',
        base_price: 1.25, // Price per gram (equivalent to ₹1250 per kg)
        stock_quantity: 15000 // 15 kg (stored in grams)
      },
      {
        sku: 'CHEM-METH-004',
        name: 'Methanol Anhydrous 99.8%',
        description: 'Anhydrous Methanol solvent with low moisture content (< 0.005%) for laboratory analysis.',
        category: 'Solvents',
        dimension: 'volume',
        base_unit: 'mL',
        base_price: 0.22, // Price per mL (equivalent to ₹220 per L)
        stock_quantity: 350000 // 350 Liters (stored in milliliters)
      },
      {
        sku: 'EQP-PIP-005',
        name: 'Volumetric Pipette 25mL Class A',
        description: 'Calibrated Class A volumetric pipette made of borosilicate glass.',
        category: 'Labware',
        dimension: 'count',
        base_unit: 'items',
        base_price: 320.00, // Price per item
        stock_quantity: 75 // 75 items (stored in items count)
      },
      {
        sku: 'CHEM-NaOH-006',
        name: 'Sodium Hydroxide Pellets',
        description: 'Analytical grade NaOH pellets, moisture protected packaging.',
        category: 'Salts & Reagents',
        dimension: 'weight',
        base_unit: 'g',
        base_price: 0.50, // Price per gram (equivalent to ₹500 per kg)
        stock_quantity: 50000 // 50 kg (stored in grams)
      }
    ];

    const productInsertQuery = `
      INSERT INTO products (sku, name, description, category, dimension, base_unit, base_price, stock_quantity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, sku, name;
    `;

    for (const prod of products) {
      const prodRes = await client.query(productInsertQuery, [
        prod.sku, prod.name, prod.description, prod.category,
        prod.dimension, prod.base_unit, prod.base_price, prod.stock_quantity
      ]);
      console.log(`Inserted product: ${prodRes.rows[0].name} (${prodRes.rows[0].sku})`);
    }

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
