/*
# Add order_button_url column to products

1. Modified Tables
- `products`
  - New column `order_button_url` (text, nullable)
  - When NULL: the "Pesan Sekarang" button opens the WhatsApp order form (default behavior)
  - When set: the "Pesan Sekarang" button redirects to this URL (e.g. affiliate link)
2. Security
- No changes to RLS policies. Existing policies on `products` remain unchanged.
3. Notes
- This is a non-destructive ALTER TABLE ADD COLUMN.
- Existing products will have order_button_url = NULL, preserving current behavior.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS order_button_url text;