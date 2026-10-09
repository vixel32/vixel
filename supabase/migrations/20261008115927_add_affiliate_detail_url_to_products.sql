/*
# Add affiliate detail page URL to products

1. Modified Tables
- `products`
  - Adds `affiliate_detail_url` (text, nullable).
  - When empty or NULL, product cards continue opening the built-in Vixel detail page.
  - When filled with an affiliate URL, product cards open that external detail page instead.

2. Security
- No RLS policy changes are needed because this is an additional product content field and the existing product policies remain unchanged.
- The frontend accepts only HTTP(S) URLs for this destination before using them as external links.

3. Data Safety
- This is a non-destructive ALTER TABLE ADD COLUMN operation.
- Existing products receive NULL and keep their current navigation behavior.

4. Notes
- The column is separate from `order_button_url`, so the product card destination and the order button destination can be configured independently.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS affiliate_detail_url text;