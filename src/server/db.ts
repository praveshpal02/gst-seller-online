import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[DATABASE WARNING] DATABASE_URL is not set in environment variables.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' || databaseUrl?.includes('neon.tech') || databaseUrl?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDatabaseSchema(): Promise<void> {
  if (!databaseUrl) {
    console.warn('[DATABASE] Skipping schema initialization: DATABASE_URL missing.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        business_name TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seller Profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS seller_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gstin TEXT NOT NULL,
        trade_name TEXT NOT NULL,
        party_name TEXT,
        return_type TEXT DEFAULT 'Monthly',
        period_month TEXT NOT NULL,
        period_year TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        state_code TEXT,
        state_name TEXT,
        added_date TEXT,
        last_used_date TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Meesho Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meesho_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gstin TEXT NOT NULL,
        period_month TEXT NOT NULL,
        period_year TEXT NOT NULL,
        marketplace TEXT DEFAULT 'MEESHO',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meesho_tx_user_period
        ON meesho_transactions(user_id, gstin, period_month, period_year);
    `);

    // 5. Manual GSTR1 Entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS manual_gstr1_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gstin TEXT NOT NULL,
        period_month TEXT NOT NULL,
        period_year TEXT NOT NULL,
        section TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_manual_entries_user_period
        ON manual_gstr1_entries(user_id, gstin, period_month, period_year);
    `);

    await client.query('COMMIT');
    console.log('[DATABASE] PostgreSQL schema initialized successfully in Neon.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to initialize schema:', err);
    throw err;
  } finally {
    client.release();
  }
}
