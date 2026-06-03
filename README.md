# AasaMedChem | Inventory & Order Management System

A high-performance, real-time inventory and quotation management system built for pharmaceutical chemical distribution. It provides precise calculations for pricing and unit conversions (grams, kilograms, liters, milliliters, items count) with 20-digit precision math, role-based security, interactive SVG telemetry graphs, and conversion auditing logs.

## Live Application
- **Live URL**: [https://diya-hackathon-assignment-round.vercel.app](https://diya-hackathon-assignment-round.vercel.app) *(To be deployed on Vercel)*
- **Neon-Hosted PostgreSQL**: Shared production database instance.

---

## 🔐 Sandbox Test Credentials
To explore the system, we have pre-seeded the database with two primary role profiles. The login panel features an automatic credential-fill widget for swift testing.
- 🧑‍🔬 **Seller / User Account**:
  - **Email**: `seller@aasamedchem.com`
  - **Password**: `seller123`
- 👑 **Administrator Account**:
  - **Email**: `admin@aasamedchem.com`
  - **Password**: `admin123`

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: **Next.js (App Router)** in TypeScript. Renders highly responsive pages, cart drawers, real-time calculators, and custom theme switches.
- **Styling**: **Vanilla CSS (Design Tokens & HSL Variable Palettes)**. Zero CSS bundle pollution, complete design override control, glassmorphism card panels, and pixel-perfect transitions.
- **Backend**: **Next.js Route Handlers** (Node.js runtime environment). Handles user profiles, JWT creation, and atomic database transactions.
- **Database**: **Neon Serverless PostgreSQL**. Highly scalable postgres clusters with connection pooling.
- **Calculations Engine**: **decimal.js**. Prevents floating-point decimal inaccuracies in billing, conversions, and rate audits.
- **Visuals/Graphics**: **Pure Responsive SVGs**. Telmetery analytics (Donut chart for category stock shares, Area curve for sales values, and Stacked status bars) rendered natively using math coordinate projections.

---

## 🧮 Unit Storage & Conversion Strategy

Chemical reagents are traded in different physical weights, volumes, or counts, creating conversion risks. The application employs a strict **Base-Unit Normalization Strategy** to eliminate precision drift:

### 1. Dimension Matrix
Each product belongs to one dimension and has a fixed **Internal Base Unit** in which all database quantities are tracked:
- ⚖️ **Weight**: Base Unit = **grams (g)**. Display Units = `g`, `kg`. (1 kg = 1000 g).
- 🧪 **Volume**: Base Unit = **milliliters (mL)**. Display Units = `mL`, `L`. (1 L = 1000 mL).
- 📦 **Count**: Base Unit = **items**. Display Units = `items`. (1 item = 1 item).

### 2. Internals Storage Data Types
In PostgreSQL (`src/db/schema.sql`), all numeric rates, quantities, and totals are stored as:
- `NUMERIC(20, 8)`: Handles values up to 100 billion with 8 decimal places of exact precision.
  - **Base Price**: Price per 1 base unit (e.g., price per 1 gram of NaCl or 1 mL of Ethanol).
  - **Stock Quantity**: Total current inventory in base units (e.g. 50 kg is stored as `50000.00000000` grams).

### 3. Verification & Auditing Math
When a Seller orders a quantity in their chosen unit:
1. **Convert to Base**: `Base Quantity = Ordered Quantity * Conversion Factor`.
2. **Determine Unit Rate**: `Unit Price = Base Price * Conversion Factor`.
3. **Calculate Total Item Price**: `Total Price = Base Quantity * Base Price = Ordered Quantity * Unit Price`.

*Example: NaCl base price is configured as ₹0.85 per gram. The Seller orders `1.5` `kg`:*
- Base Quantity = $1.5 \text{ kg} \times 1000 = 1500 \text{ g}$ (stored in database `base_quantity` column).
- Unit Price = $\text{₹}0.85 \times 1000 = \text{₹}850.00$ per kg.
- Total Price = $1500 \text{ g} \times \text{₹}0.85 = \text{₹}1275.00$ (stored in database `total_item_price` column).

---

## 🗄️ Database Schema Details

- **`users`**: Contains credential hashes, profile names, and system authorization roles (`admin` or `seller`).
- **`products`**: Tracks SKUs, categories, base prices, internal base units, and absolute stock levels in base units.
- **`orders`**: Holds header details (requesting seller, overall total price, and fulfillment status: `pending`, `approved`, `rejected`, `completed`).
- **`order_items`**: Logs transaction lines. By archiving the *original user inputs* (`ordered_unit`, `ordered_quantity`) alongside *resolved math* (`base_quantity`, `unit_price`, `total_item_price`), it provides a granular **Audit Log** for accountants.

---

## 🚀 Local Installation & Setup

Ensure you have **Node.js (v18+)** and **npm** installed.

### 1. Clone & Install Dependencies
```bash
git clone <repository_url>
cd "diya Hackathon Assignment Round"
npm install
```

### 2. Configure Environment Secrets
Create a `.env.local` file in the root folder and insert the database string and JWT credentials:
```env
DATABASE_URL=postgresql://neondb_owner:npg_hUgCY8aeXH5z@ep-delicate-dust-apwx0cb9.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=super_secret_key_123_abc_xyz_aasa_medchem
```

### 3. Set Up Tables & Seed Data
Execute the migration seed script. This drops any old tables, initializes the tables with indexes, and seeds sandbox accounts and test reagents.
```bash
node src/db/seed.js
```

### 4. Boot Development Server
Start the local server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Running Verification Tests
A dedicated mathematical check test suite can be run locally to verify unit conversion factors, price multipliers, and precision equations under `decimal.js`:
```bash
node src/scripts/test-conversions.js
```

---

## ☁️ Vercel Deployment Instructions

1. Install Vercel CLI: `npm install -g vercel`
2. Run deployment setup: `vercel`
3. Configure the environment variables (`DATABASE_URL` and `JWT_SECRET`) when prompted or inside the Vercel Dashboard under **Project Settings > Environment Variables**.
4. Deploy: `vercel --prod`
