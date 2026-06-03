const { Client } = require('pg');
const bcrypt = require('bcryptjs');
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

    // 1. Drop check constraint and add updated check constraint
    console.log('Updating user role constraint to support "buyer"...');
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'seller', 'buyer'));
    `);
    console.log('Constraint updated successfully.');

    // 2. Hash password for sample buyer
    const buyerHash = await bcrypt.hash('buyer123', 10);

    // 3. Seed buyer
    console.log('Inserting seed buyer John Doe...');
    await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING;
    `, ['buyer@aasamedchem.com', buyerHash, 'Buyer John Doe', 'buyer']);
    console.log('Seed buyer inserted.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
