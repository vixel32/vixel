-- Allow stock to be NULL (NULL = unlimited / tanpa batas)
ALTER TABLE products ALTER COLUMN stock DROP NOT NULL;