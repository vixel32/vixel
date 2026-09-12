/*
# Vixel — Full Schema Setup

Creates all tables needed by the Vixel storefront and admin panel:
product_categories, products, product_images, orders, testimonials, store_settings.

## Security Model
- Public (anon) can READ products, categories, approved testimonials, and store settings.
- Public (anon) can CREATE orders and testimonials (with status=pending).
- Authenticated (admin) has full CRUD on all tables.
- Orders are read/update only by authenticated (admin).
- Testimonials: anon sees only approved; authenticated sees all.

## Tables
1. product_categories — product category definitions (slug, name, icon, sort order)
2. products — products with price, stock, theme, featured/active flags
3. product_images — gallery images per product
4. orders — customer orders with optional wedding event data
5. testimonials — customer reviews with approval workflow
6. store_settings — single-row store configuration (WhatsApp, hero, about text, etc.)
*/

-- ============ product_categories ============
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'package',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_categories" ON product_categories;
CREATE POLICY "anon_read_categories" ON product_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_categories" ON product_categories;
CREATE POLICY "auth_insert_categories" ON product_categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_categories" ON product_categories;
CREATE POLICY "auth_update_categories" ON product_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_categories" ON product_categories;
CREATE POLICY "auth_delete_categories" ON product_categories FOR DELETE
  TO authenticated USING (true);

-- ============ products ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  video_url text,
  preview_link text,
  theme text,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_products" ON products;
CREATE POLICY "anon_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- ============ product_images ============
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_product_images" ON product_images;
CREATE POLICY "anon_read_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_product_images" ON product_images;
CREATE POLICY "auth_insert_product_images" ON product_images FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_product_images" ON product_images;
CREATE POLICY "auth_update_product_images" ON product_images FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_product_images" ON product_images;
CREATE POLICY "auth_delete_product_images" ON product_images FOR DELETE
  TO authenticated USING (true);

-- ============ orders ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_price numeric NOT NULL DEFAULT 0,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  groom_name text,
  bride_name text,
  groom_parents text,
  bride_parents text,
  akad_venue text,
  akad_date text,
  akad_time text,
  reception_venue text,
  reception_date text,
  reception_time text,
  notes text,
  status text NOT NULL DEFAULT 'baru',
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_orders" ON orders;
CREATE POLICY "auth_read_orders" ON orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_orders" ON orders;
CREATE POLICY "auth_update_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_orders" ON orders;
CREATE POLICY "auth_delete_orders" ON orders FOR DELETE
  TO authenticated USING (true);

-- ============ testimonials ============
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  rating int NOT NULL DEFAULT 5,
  photo_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_approved_testimonials" ON testimonials;
CREATE POLICY "anon_read_approved_testimonials" ON testimonials FOR SELECT
  TO anon USING (status = 'approved');

DROP POLICY IF EXISTS "auth_read_all_testimonials" ON testimonials;
CREATE POLICY "auth_read_all_testimonials" ON testimonials FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_testimonials" ON testimonials;
CREATE POLICY "anon_insert_testimonials" ON testimonials FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_testimonials" ON testimonials;
CREATE POLICY "auth_update_testimonials" ON testimonials FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_testimonials" ON testimonials;
CREATE POLICY "auth_delete_testimonials" ON testimonials FOR DELETE
  TO authenticated USING (true);

-- ============ store_settings ============
CREATE TABLE IF NOT EXISTS store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL DEFAULT '082218730419',
  email text,
  address text,
  instagram text,
  tiktok text,
  facebook text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  about_text text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_settings" ON store_settings;
CREATE POLICY "anon_read_settings" ON store_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_settings" ON store_settings;
CREATE POLICY "auth_insert_settings" ON store_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_settings" ON store_settings;
CREATE POLICY "auth_update_settings" ON store_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_settings" ON store_settings;
CREATE POLICY "auth_delete_settings" ON store_settings FOR DELETE
  TO authenticated USING (true);

-- ============ Indexes ============
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON products(is_active, is_featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);

-- ============ Seed: default categories ============
INSERT INTO product_categories (slug, name, description, icon, sort_order)
VALUES
  ('undangan-digital', 'Undangan Digital', 'Undangan digital interaktif untuk momen spesialmu', 'monitor', 1),
  ('undangan-cetak', 'Undangan Cetak', 'Undangan cetak premium dengan desain eksklusif', 'file-text', 2),
  ('buket', 'Buket', 'Buket bunga cantik untuk berbagai acara', 'flower', 3),
  ('seserahan', 'Seserahan', 'Paket seserahan pernikahan lengkap dan elegan', 'gift', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============ Seed: default store settings ============
INSERT INTO store_settings (whatsapp_number, hero_title, hero_subtitle, about_text)
VALUES (
  '082218730419',
  'Setiap Detail Penting Layak Mendapat Sentuhan Khusus',
  'Undangan digital, undangan cetak, buket, dan jasa seserahan untuk momen spesialmu.',
  'Vixel hadir untuk membuat setiap momen spesial dalam hidupmu menjadi lebih berkesan. Kami menyediakan undangan digital dan cetak, buket cantik, serta paket seserahan pernikahan dengan kualitas premium dan desain elegan.'
)
ON CONFLICT DO NOTHING;
