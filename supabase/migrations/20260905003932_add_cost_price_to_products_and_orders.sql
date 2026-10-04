-- Add cost_price (harga beli) to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

-- Add cost_price snapshot to orders (so historical reports stay accurate even if product cost changes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;