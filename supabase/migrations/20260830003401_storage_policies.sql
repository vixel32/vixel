/*
# Storage bucket policies for product-images

Allows public read access and authenticated upload/update/delete for the product-images bucket.
*/

DROP POLICY IF EXISTS "anon_read_product_images_storage" ON storage.objects;
CREATE POLICY "anon_read_product_images_storage" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_insert_product_images_storage" ON storage.objects;
CREATE POLICY "auth_insert_product_images_storage" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_update_product_images_storage" ON storage.objects;
CREATE POLICY "auth_update_product_images_storage" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_delete_product_images_storage" ON storage.objects;
CREATE POLICY "auth_delete_product_images_storage" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'product-images');
