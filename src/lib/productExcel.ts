import * as XLSX from 'xlsx';
import type { Product, ProductCategory } from '@/lib/types';

export interface ProductExportRow {
  Nama: string;
  Kategori: string;
  Deskripsi: string;
  'Harga Jual': number;
  'Harga Beli': number;
  Stok: number | string;
  Tema: string;
  'URL Video': string;
  'Link Preview': string;
  Unggulan: string;
  Aktif: string;
  'URL Gambar Utama': string;
}

export function exportProductsToExcel(products: Product[], categories: ProductCategory[]): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const rows: ProductExportRow[] = products.map((p) => ({
    Nama: p.name,
    Kategori: categoryMap.get(p.category_id) ?? '',
    Deskripsi: p.description ?? '',
    'Harga Jual': p.price,
    'Harga Beli': p.cost_price ?? 0,
    Stok: p.stock === null ? 'Tanpa batas' : p.stock,
    Tema: p.theme ?? '',
    'URL Video': p.video_url ?? '',
    'Link Preview': p.preview_link ?? '',
    Unggulan: p.is_featured ? 'Ya' : 'Tidak',
    Aktif: p.is_active ? 'Ya' : 'Tidak',
    'URL Gambar Utama': p.product_images?.[0]?.image_url ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 10 },
    { wch: 10 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produk');

  const catWs = XLSX.utils.json_to_sheet(
    categories.map((c) => ({ Nama: c.name, Slug: c.slug, Deskripsi: c.description ?? '' }))
  );
  XLSX.utils.book_append_sheet(wb, catWs, 'Kategori');

  const now = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `daftar-produk-${now}.xlsx`);
}

export interface ImportedProduct {
  name: string;
  category_name: string;
  description: string;
  price: number;
  cost_price: number;
  stock: number | null;
  theme: string;
  video_url: string;
  preview_link: string;
  is_featured: boolean;
  is_active: boolean;
  image_url: string;
}

export async function importProductsFromExcel(
  file: File,
  categories: ProductCategory[]
): Promise<ImportedProduct[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['Produk'] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Sheet "Produk" tidak ditemukan dalam file Excel.');

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  if (rows.length === 0) throw new Error('Tidak ada data dalam file Excel.');

  const imported: ImportedProduct[] = rows.map((row) => {
    const rawStock = String(row['Stok'] ?? row['stok'] ?? '').trim();
    const stock = rawStock === '' || rawStock.toLowerCase() === 'tanpa batas' || rawStock.toLowerCase() === 'unlimited' ? null : (parseInt(rawStock) || 0);
    return {
    name: String(row['Nama'] ?? row['nama'] ?? '').trim(),
    category_name: String(row['Kategori'] ?? row['kategori'] ?? '').trim(),
    description: String(row['Deskripsi'] ?? row['deskripsi'] ?? '').trim(),
    price: parseFloat(String(row['Harga Jual'] ?? row['harga jual'] ?? row['harga_jual'] ?? 0)) || 0,
    cost_price: parseFloat(String(row['Harga Beli'] ?? row['harga beli'] ?? row['harga_beli'] ?? 0)) || 0,
    stock,
    theme: String(row['Tema'] ?? row['tema'] ?? '').trim(),
    video_url: String(row['URL Video'] ?? row['url video'] ?? '').trim(),
    preview_link: String(row['Link Preview'] ?? row['link preview'] ?? '').trim(),
    is_featured: String(row['Unggulan'] ?? row['unggulan'] ?? '').toLowerCase() === 'ya',
    is_active: String(row['Aktif'] ?? row['aktif'] ?? '').toLowerCase() !== 'tidak',
    image_url: String(row['URL Gambar Utama'] ?? row['url gambar utama'] ?? '').trim(),
  };}).filter((p) => p.name);

  return imported;
}

export function downloadImportTemplate(categories: ProductCategory[]): void {
  const sample: Partial<ProductExportRow>[] = [{
    Nama: 'Contoh Produk',
    Kategori: categories[0]?.name ?? 'Nama Kategori',
    Deskripsi: 'Deskripsi produk contoh',
    'Harga Jual': 50000,
    'Harga Beli': 30000,
    Stok: 'Tanpa batas',
    Tema: 'Floral Garden',
    'URL Video': '',
    'Link Preview': '',
    Unggulan: 'Tidak',
    Aktif: 'Ya',
    'URL Gambar Utama': '',
  }];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [
    { wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 10 },
    { wch: 10 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produk');
  XLSX.writeFile(wb, 'template-import-produk.xlsx');
}
