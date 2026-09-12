import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Pencil, Trash2, X, Loader2, Upload, Star, Image as ImageIcon, Check, ChevronsUpDown, Link2, Cloud, Video, Download, FileUp, FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, normalizeImageUrl } from '@/lib/utils';
import { pickFromGoogleDrive, isGoogleDriveConfigured } from '@/lib/googleDrive';
import { exportProductsToExcel, importProductsFromExcel, downloadImportTemplate } from '@/lib/productExcel';
import type { Product, ProductCategory, ProductImage } from '@/lib/types';

const PRODUCTS_PER_PAGE = 6;

const emptyForm = {
  name: '',
  description: '',
  price: '',
  cost_price: '',
  stock: '',
  unlimited_stock: false,
  video_url: '',
  preview_link: '',
  theme: '',
  category_id: '',
  is_featured: false,
  is_active: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [pickingDrive, setPickingDrive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importedData, setImportedData] = useState<ReturnType<typeof importProductsFromExcel> extends Promise<infer T> ? T : never>([]);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; errors: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const driveConfigured = isGoogleDriveConfigured();
  const driveConfig = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    appId: import.meta.env.VITE_GOOGLE_APP_ID,
  };

  const pickImagesFromDrive = async () => {
    setPickingDrive(true);
    setError(null);
    try {
      const files = await pickFromGoogleDrive(driveConfig, true, false);
      if (files.length > 0) {
        setNewImageUrls((prev) => [...prev, ...files.map((f) => f.url)]);
      }
    } catch (err: any) {
      setError(`Gagal memilih dari Google Drive: ${err.message}`);
    }
    setPickingDrive(false);
  };

  const pickVideoFromDrive = async () => {
    setPickingDrive(true);
    setError(null);
    try {
      const files = await pickFromGoogleDrive(driveConfig, false, true);
      if (files.length > 0) {
        const video = files.find((f) => f.isVideo) ?? files[0];
        setForm((prev) => ({ ...prev, video_url: video.url }));
      }
    } catch (err: any) {
      setError(`Gagal memilih dari Google Drive: ${err.message}`);
    }
    setPickingDrive(false);
  };

  const load = useCallback(async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:product_categories(*), product_images(*)').order('sort_order'),
      supabase.from('product_categories').select('*').order('sort_order'),
    ]);
    setProducts((prodRes.data as Product[]) ?? []);
    setCategories((catRes.data as ProductCategory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' });
    setImages([]);
    setNewImageUrls([]);
    setError(null);
    setThemeOpen(false);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),
      cost_price: String(product.cost_price ?? 0),
      stock: product.stock === null ? '' : String(product.stock),
      unlimited_stock: product.stock === null,
      video_url: product.video_url ?? '',
      preview_link: product.preview_link ?? '',
      theme: product.theme ?? '',
      category_id: product.category_id,
      is_featured: product.is_featured,
      is_active: product.is_active,
    });
    setImages(product.product_images ?? []);
    setNewImageUrls([]);
    setError(null);
    setThemeOpen(false);
    setShowForm(true);
  };

  const addImageUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setNewImageUrls((prev) => [...prev, normalizeImageUrl(trimmed)]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fileName = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, file);
      if (upErr) {
        setError(`Gagal upload: ${upErr.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
    setNewImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const removeNewImage = (url: string) => {
    setNewImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const deleteExistingImage = async (img: ProductImage) => {
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    await supabase.from('product_images').delete().eq('id', img.id);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category_id) {
      setError('Nama, harga, dan kategori wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      cost_price: parseFloat(form.cost_price) || 0,
      stock: form.unlimited_stock ? null : (parseInt(form.stock) || 0),
      video_url: form.video_url || null,
      preview_link: form.preview_link || null,
      theme: form.theme || null,
      category_id: form.category_id,
      is_featured: form.is_featured,
      is_active: form.is_active,
    };

    let productId = editing?.id;

    if (editing) {
      const { error: updErr } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (updErr) { setError(updErr.message); setSaving(false); return; }
    } else {
      const { data, error: insErr } = await supabase.from('products').insert(payload).select().single();
      if (insErr) { setError(insErr.message); setSaving(false); return; }
      productId = data.id;
    }

    // Save new images
    if (productId && newImageUrls.length > 0) {
      const imageRows = newImageUrls.map((url, idx) => ({
        product_id: productId,
        image_url: url,
        sort_order: images.length + idx,
      }));
      await supabase.from('product_images').insert(imageRows);
    }

    setSaving(false);
    setShowForm(false);
    setCurrentPage(1);
    load();
  };

  const handleExport = () => {
    if (products.length === 0) {
      setError('Belum ada produk untuk diekspor.');
      return;
    }
    exportProductsToExcel(products, categories);
    setShowExportMenu(false);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const data = await importProductsFromExcel(file, categories);
      if (data.length === 0) {
        setError('Tidak ada data valid dalam file Excel.');
        setImporting(false);
        return;
      }
      setImportedData(data);
      setShowImportPreview(true);
    } catch (err: any) {
      setError(err.message || 'Gagal membaca file Excel.');
    }
    setImporting(false);
  };

  const confirmImport = async () => {
    setImporting(true);
    const added: string[] = [];
    const updated: string[] = [];
    const errors: string[] = [];

    for (const item of importedData) {
      const cat = categories.find((c) => c.name.toLowerCase() === item.category_name.toLowerCase());
      if (!cat) {
        errors.push(`Kategori "${item.category_name}" tidak ditemukan untuk produk "${item.name}".`);
        continue;
      }

      const existing = products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
      const payload = {
        name: item.name,
        description: item.description || null,
        price: item.price,
        cost_price: item.cost_price,
    stock: item.stock === null ? null : item.stock,
        video_url: item.video_url || null,
        preview_link: item.preview_link || null,
        theme: item.theme || null,
        category_id: cat.id,
        is_featured: item.is_featured,
        is_active: item.is_active,
      };

      if (existing) {
        const { error: updErr } = await supabase.from('products').update(payload).eq('id', existing.id);
        if (updErr) {
          errors.push(`Gagal update "${item.name}": ${updErr.message}`);
        } else {
          if (item.image_url) {
            const { data: existingImgs } = await supabase.from('product_images').select('id').eq('product_id', existing.id).limit(1);
            if (!existingImgs || existingImgs.length === 0) {
              await supabase.from('product_images').insert({ product_id: existing.id, image_url: normalizeImageUrl(item.image_url), sort_order: 0 });
            }
          }
          updated.push(item.name);
        }
      } else {
        const { data: insData, error: insErr } = await supabase.from('products').insert(payload).select().single();
        if (insErr) {
          errors.push(`Gagal tambah "${item.name}": ${insErr.message}`);
        } else {
          if (item.image_url) {
            await supabase.from('product_images').insert({ product_id: insData.id, image_url: normalizeImageUrl(item.image_url), sort_order: 0 });
          }
          added.push(item.name);
        }
      }
    }

    setImportResult({ added: added.length, updated: updated.length, errors });
    setImportedData([]);
    setShowImportPreview(false);
    await load();
    setCurrentPage(1);
    setImporting(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('product_images').delete().eq('product_id', confirmDelete.id);
    await supabase.from('products').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    setCurrentPage(1);
    load();
  };

  const allImages = [...images.map((i) => i.image_url), ...newImageUrls];

  // Tema yang sudah pernah digunakan untuk pilihan di form produk.
  const existingThemes = useMemo(
    () => [...new Set(products.map((p) => p.theme).filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  // Daftar tema mengikuti kategori yang dipilih.
  // Jika tidak ada kategori yang dipilih, semua tema ditampilkan.
  const availableThemes = useMemo(() => {
    const sourceProducts = categoryFilter
      ? products.filter((product) => product.category_id === categoryFilter)
      : products;

    return [
      ...new Set(
        sourceProducts
          .map((product) => product.theme)
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim()),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [products, categoryFilter]);

  // Jika kategori berubah dan tema yang dipilih tidak tersedia di kategori tersebut,
  // kosongkan tema agar kombinasi filter selalu valid.
  useEffect(() => {
    if (themeFilter && !availableThemes.includes(themeFilter)) {
      setThemeFilter('');
    }
  }, [availableThemes, themeFilter]);

  // Filter produk berdasarkan nama/deskripsi, tema, dan kategori
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description ?? '').toLowerCase().includes(query);

      const matchesTheme =
        !themeFilter || product.theme === themeFilter;

      const matchesCategory =
        !categoryFilter || product.category_id === categoryFilter;

      return matchesSearch && matchesTheme && matchesCategory;
    });
  }, [products, searchQuery, themeFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Kembali ke halaman 1 saat pencarian/filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, themeFilter, categoryFilter]);

  // Pastikan halaman aktif tidak melebihi jumlah halaman
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Maksimal 5 nomor halaman yang ditampilkan
  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index,
    );
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">Kelola Produk</h2>
          <p className="text-charcoal-400 text-sm mt-1">{products.length} produk total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) { handleImportFile(e.target.files[0]); e.target.value = ''; } }}
          />
          <button
            onClick={() => downloadImportTemplate(categories)}
            className="btn-outline text-sm"
            title="Unduh template Excel untuk import"
          >
            <FileSpreadsheet className="w-4 h-4" /> Template
          </button>
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="btn-outline text-sm"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} Import
          </button>
          <button onClick={handleExport} className="btn-outline text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau deskripsi produk..."
            className="input pl-4 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700"
              aria-label="Hapus pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          className="input sm:w-56"
          title={categoryFilter ? 'Tema yang tersedia mengikuti kategori yang dipilih' : 'Semua tema tersedia'}
        >
          <option value="">Semua Tema</option>
          {availableThemes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input sm:w-56"
        >
          <option value="">Semua Kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {(searchQuery || themeFilter || categoryFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setThemeFilter('');
              setCategoryFilter('');
            }}
            className="btn-outline shrink-0"
          >
            <X className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {(searchQuery || themeFilter || categoryFilter) && (
        <p className="text-sm text-charcoal-400 -mt-2">
          Menampilkan <span className="font-semibold text-charcoal-700">{filteredProducts.length}</span> dari {products.length} produk
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-navy-50 flex items-center justify-center mb-4">
            <ImageIcon className="w-6 h-6 text-navy-400" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-charcoal-800">Produk tidak ditemukan</h3>
          <p className="text-sm text-charcoal-400 mt-1">Coba ubah kata pencarian, tema, atau kategori.</p>
          {(searchQuery || themeFilter || categoryFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setThemeFilter('');
                setCategoryFilter('');
              }}
              className="btn-outline mt-4"
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map((product) => {
            const img = product.product_images?.[0]?.image_url;
            return (
              <div key={product.id} className="card overflow-hidden">
                <div className="relative aspect-[4/3] bg-cream-100">
                  {img ? (
                    <img src={normalizeImageUrl(img)} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-charcoal-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  {!product.is_active && (
                    <div className="absolute inset-0 bg-charcoal-900/40 flex items-center justify-center">
                      <span className="bg-white px-3 py-1.5 rounded-full text-xs font-semibold">Nonaktif</span>
                    </div>
                  )}
                  {product.is_featured && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-gold-400 px-2 py-0.5 text-xs font-semibold text-charcoal-900">
                      <Star className="w-3 h-3 fill-charcoal-900" /> Unggulan
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-xs text-navy-400">{product.category?.name}</span>
                  <h3 className="font-serif text-base font-semibold text-charcoal-800 mt-0.5 line-clamp-1">{product.name}</h3>
                  {product.theme && <p className="text-xs text-gold-600 mt-1">Tema: {product.theme}</p>}
                  <p className="text-sm font-semibold text-charcoal-700 mt-1">{formatPrice(product.price)}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEdit(product)} className="btn-outline text-xs px-3 py-2 flex-1">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => setConfirmDelete(product)} className="btn text-xs px-3 py-2 bg-navy-50 text-navy-700 hover:bg-navy-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-sm text-charcoal-400">
              Menampilkan{' '}
              <span className="font-medium text-charcoal-700">
                {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}
              </span>{' '}
              -{' '}
              <span className="font-medium text-charcoal-700">
                {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)}
              </span>{' '}
              dari{' '}
              <span className="font-medium text-charcoal-700">
                {filteredProducts.length}
              </span>{' '}
              produk
            </p>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-charcoal-200 text-sm font-medium text-charcoal-600 hover:bg-navy-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[40px] h-[40px] px-3 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-navy-600 text-white'
                      : 'border border-charcoal-200 text-charcoal-600 hover:bg-navy-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg border border-charcoal-200 text-sm font-medium text-charcoal-600 hover:bg-navy-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal-100 sticky top-0 bg-white z-10">
              <h3 className="font-serif text-xl font-bold text-charcoal-800">
                {editing ? 'Edit Produk' : 'Tambah Produk'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-navy-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Images */}
              <div>
                <label className="label">Galeri Foto Produk</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {allImages.map((url) => (
                    <div key={url} className="relative group">
                      <img src={url} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-xl object-cover border border-charcoal-100" />
                      <button
                        type="button"
                        onClick={() => images.some((i) => i.image_url === url) ? deleteExistingImage(images.find((i) => i.image_url === url)!) : removeNewImage(url)}
                        className="absolute -top-1 -right-1 bg-navy-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-charcoal-200 flex items-center justify-center cursor-pointer hover:border-gold-300 transition-all text-charcoal-300">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput((v) => !v)}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-charcoal-200 flex items-center justify-center cursor-pointer hover:border-gold-300 transition-all text-charcoal-300"
                    title="Tambah dari URL / Google Drive"
                  >
                    <Link2 className="w-5 h-5" />
                  </button>
                </div>
                {driveConfigured && (
                  <button
                    type="button"
                    onClick={pickImagesFromDrive}
                    disabled={pickingDrive}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-charcoal-200 flex items-center justify-center cursor-pointer hover:border-gold-300 transition-all text-charcoal-300"
                    title="Pilih dari Google Drive"
                  >
                    {pickingDrive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                  </button>
                )}
                {showUrlInput && (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="url"
                      className="input"
                      placeholder="Tempel link Google Drive atau URL gambar..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                    />
                    <button type="button" onClick={addImageUrl} className="btn-primary shrink-0">
                      <Check className="w-4 h-4" /> Tambah
                    </button>
                  </div>
                )}
                <p className="text-xs text-charcoal-400 mt-1">Upload file langsung, pilih dari Google Drive, atau tempel link URL.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Nama Produk *</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Kategori *</label>
                  <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">Pilih kategori</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Harga Jual *</label>
                  <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="label">Harga Beli</label>
                  <input type="number" className="input" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="label">Stok</label>
                  <input
                    type="number"
                    className="input"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="0"
                    disabled={form.unlimited_stock}
                  />
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={form.unlimited_stock}
                      onChange={(e) => setForm({ ...form, unlimited_stock: e.target.checked, stock: e.target.checked ? '' : form.stock })}
                      className="w-4 h-4 rounded text-navy-600"
                    />
                    <span className="text-sm text-charcoal-700">Stok tanpa batas</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">URL Video</label>
                  <div className="flex gap-2">
                    <input className="input" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://... atau link Google Drive" />
                    {driveConfigured && (
                      <button
                        type="button"
                        onClick={pickVideoFromDrive}
                        disabled={pickingDrive}
                        className="btn-outline shrink-0"
                        title="Pilih video dari Google Drive"
                      >
                        {pickingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Cloud className="w-4 h-4" /> Pilih dari Drive</>}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-400 mt-1.5">Bisa link video biasa, link Google Drive, atau pilih langsung dari Google Drive.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Tema Undangan</label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          className="input pr-9"
                          value={form.theme}
                          onChange={(e) => setForm({ ...form, theme: e.target.value })}
                          placeholder="Contoh: Floral Garden, Royal Gold"
                        />
                        {existingThemes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setThemeOpen((open) => !open)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-charcoal-400 hover:text-navy-600 hover:bg-navy-50"
                            aria-label="Pilih tema"
                          >
                            <ChevronsUpDown className="w-4 h-4" />
                          </button>
                        )}
                        {themeOpen && existingThemes.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-xl border border-charcoal-100 bg-white shadow-lg max-h-48 overflow-auto">
                            {existingThemes.map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => { setForm({ ...form, theme: item }); setThemeOpen(false); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-charcoal-700 hover:bg-navy-50 text-left"
                              >
                                {item}
                                {form.theme === item && <Check className="w-4 h-4 text-navy-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-charcoal-400 mt-1.5">Pilih dari tema yang sudah pernah diinput atau ketik tema baru. Hanya untuk produk undangan digital atau cetak.</p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Link Preview Produk</label>
                  <input className="input" value={form.preview_link} onChange={(e) => setForm({ ...form, preview_link: e.target.value })} placeholder="https://..." />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Deskripsi</label>
                  <textarea className="input min-h-[100px] resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="w-4 h-4 rounded text-navy-600" />
                  <span className="text-sm text-charcoal-700">Produk Unggulan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded text-navy-600" />
                  <span className="text-sm text-charcoal-700">Aktif (tampil di toko)</span>
                </label>
              </div>

              {error && <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => !importing && setShowImportPreview(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-serif text-xl font-bold text-charcoal-800">Preview Import</h3>
                <p className="text-xs text-charcoal-400 mt-0.5">{importedData.length} produk akan diproses</p>
              </div>
              <button onClick={() => !importing && setShowImportPreview(false)} className="p-2 rounded-lg hover:bg-navy-50" disabled={importing}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal-100 text-left text-charcoal-400">
                      <th className="pb-2 font-medium">Nama</th>
                      <th className="pb-2 font-medium">Kategori</th>
                      <th className="pb-2 font-medium text-right">Harga Jual</th>
                      <th className="pb-2 font-medium text-right">Harga Beli</th>
                      <th className="pb-2 font-medium text-center">Stok</th>
                      <th className="pb-2 font-medium text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedData.map((item, idx) => {
                      const cat = categories.find((c) => c.name.toLowerCase() === item.category_name.toLowerCase());
                      const existing = products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
                      return (
                        <tr key={idx} className="border-b border-charcoal-100/70">
                          <td className="py-2 text-charcoal-700">{item.name}</td>
                          <td className="py-2 text-charcoal-600">
                            {cat ? item.category_name : <span className="text-red-500">{item.category_name} (tidak ada)</span>}
                          </td>
                          <td className="py-2 text-right text-charcoal-700">{formatPrice(item.price)}</td>
                          <td className="py-2 text-right text-charcoal-500">{formatPrice(item.cost_price)}</td>
                          <td className="py-2 text-center text-charcoal-600">{item.stock === null ? 'Tanpa batas' : item.stock}</td>
                          <td className="py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${existing ? 'bg-gold-100 text-gold-700' : 'bg-green-100 text-green-700'}`}>
                              {existing ? 'Update' : 'Baru'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-charcoal-400 mb-4">
                Produk dengan nama yang sudah ada akan diperbarui. Produk baru akan ditambahkan.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowImportPreview(false)} className="btn-outline" disabled={importing}>Batal</button>
                <button onClick={confirmImport} disabled={importing} className="btn-primary flex-1">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Konfirmasi Import ({importedData.length} produk)</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setImportResult(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-800 text-center">Import Selesai</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-charcoal-400">Produk Baru</p>
                <p className="font-bold text-green-600 text-lg">{importResult.added}</p>
              </div>
              <div className="bg-gold-50 rounded-xl p-3 text-center">
                <p className="text-xs text-charcoal-400">Diperbarui</p>
                <p className="font-bold text-gold-600 text-lg">{importResult.updated}</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-semibold text-red-700 mb-2">{importResult.errors.length} error:</p>
                <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.map((err, i) => <li key={i}>- {err}</li>)}
                </ul>
              </div>
            )}
            <button onClick={() => setImportResult(null)} className="btn-primary w-full mt-4">Tutup</button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 mx-auto rounded-full bg-navy-100 flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-navy-600" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-800">Hapus Produk?</h3>
            <p className="text-sm text-charcoal-400 mt-2">"{confirmDelete.name}" akan dihapus permanen.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn-outline flex-1">Batal</button>
              <button onClick={handleDelete} className="btn bg-navy-600 text-white hover:bg-navy-700 flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
