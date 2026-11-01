
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on("error", (error) => {
    console.error("Database connection error:", error.message);
  });
}

async function initializeDatabase() {
  if (!pool) {
    console.log("Database not configured yet.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      order_id VARCHAR(100) UNIQUE NOT NULL,
      payment_id VARCHAR(100) UNIQUE NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      status VARCHAR(30) NOT NULL DEFAULT 'verified',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("KIRUU PAY database initialized.");
}

async function saveTransaction(transaction) {
  if (!pool) {
    throw new Error("Database is not configured");
  }

  const result = await pool.query(
    `INSERT INTO transactions
      (order_id, payment_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      transaction.orderId,
      transaction.paymentId,
      transaction.amount,
      transaction.currency || "INR",
      "verified"
    ]
  );

  return result.rows[0] || null;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  initializeDatabase,
  saveTransaction,
  closeDatabase
};
