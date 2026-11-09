-- Apply this migration once after 0001_create_orders.sql.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE orders ADD COLUMN customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
ON orders(customer_id, created_at DESC);
