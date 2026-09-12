import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductCategory } from '@/lib/types';
import ProductCard from '@/components/public/ProductCard';
import { CategoryIcon } from '@/components/public/CategoryIcon';

type SortOption = 'newest' | 'price-low' | 'price-high' | 'name';

const PRODUCTS_PER_PAGE = 9;

export default function CatalogPage() {
  const { slug } = useParams();

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [sort, setSort] = useState<SortOption>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [theme, setTheme] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [catRes, prodRes] = await Promise.all([
        supabase
          .from('product_categories')
          .select('*')
          .order('sort_order'),

        supabase
          .from('products')
          .select('*, category:product_categories(*), product_images(*)')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      setCategories((catRes.data as ProductCategory[]) ?? []);
      setProducts((prodRes.data as Product[]) ?? []);

      setLoading(false);
    })();
  }, []);

  const activeCategory = slug
    ? categories.find((c) => c.slug === slug)
    : null;

  const isInvitationCategory =
    slug === 'undangan-digital' || slug === 'undangan-cetak';

  /*
   * Filter + sorting
   */
  const filtered = useMemo(() => {
    let list = [...products];

    // Filter kategori
    if (activeCategory) {
      list = list.filter(
        (p) => p.category_id === activeCategory.id
      );
    }

    // Filter harga minimum
    if (minPrice) {
      const min = parseFloat(minPrice);

      if (!Number.isNaN(min)) {
        list = list.filter((p) => p.price >= min);
      }
    }

    // Filter harga maksimum
    if (maxPrice) {
      const max = parseFloat(maxPrice);

      if (!Number.isNaN(max)) {
        list = list.filter((p) => p.price <= max);
      }
    }

    // Filter tema
    if (theme) {
      list = list.filter((p) => p.theme === theme);
    }

    // Sorting
    switch (sort) {
      case 'price-low':
        list.sort((a, b) => a.price - b.price);
        break;

      case 'price-high':
        list.sort((a, b) => b.price - a.price);
        break;

      case 'name':
        list.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        break;

      default:
        list.sort((a, b) => a.sort_order - b.sort_order);
    }

    return list;
  }, [
    products,
    activeCategory,
    sort,
    minPrice,
    maxPrice,
    theme,
  ]);

  /*
   * Reset halaman ketika filter/sorting/kategori berubah
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [
    slug,
    sort,
    minPrice,
    maxPrice,
    theme,
  ]);

  /*
   * Pagination calculation
   */
  const totalProducts = filtered.length;

  const totalPages = Math.ceil(
    totalProducts / PRODUCTS_PER_PAGE
  );

  const paginatedProducts = useMemo(() => {
    const startIndex =
      (currentPage - 1) * PRODUCTS_PER_PAGE;

    const endIndex =
      startIndex + PRODUCTS_PER_PAGE;

    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage]);

  /*
   * Daftar halaman yang ditampilkan
   *
   * Contoh:
   * 1 2 3 4 5
   *
   * Jika halaman banyak:
   * 1 ... 4 5 6 ... 10
   */
  const paginationPages = useMemo(() => {
    const pages: (number | 'dots')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 4) {
      pages.push('dots');
    }

    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(
      totalPages - 1,
      currentPage + 1
    );

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 3) {
      pages.push('dots');
    }

    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  /*
   * Theme options
   */
  const themes = [
    ...new Set(
      products
        .filter((product) =>
          activeCategory?.id
            ? product.category_id === activeCategory.id
            : false
        )
        .map((product) => product.theme)
        .filter(
          (value): value is string => Boolean(value)
        )
    ),
  ].sort((a, b) => a.localeCompare(b));

  /*
   * Pagination handlers
   */
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);

    // Scroll kembali ke bagian atas katalog
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const goToPreviousPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  return (
    <div className="bg-cream-50 min-h-screen">

      {/* Banner */}
      <div className="bg-cream-200 py-16">
        <div className="container-page text-center">
          {activeCategory ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-white/80 flex items-center justify-center mb-4 shadow-md">
                <CategoryIcon
                  icon={activeCategory.icon}
                  className="w-8 h-8 text-navy-600"
                />
              </div>

              <h1 className="section-title">
                {activeCategory.name}
              </h1>

              <p className="section-subtitle max-w-xl mx-auto mt-2">
                {activeCategory.description}
              </p>
            </>
          ) : (
            <>
              <h1 className="section-title">
                Katalog Produk
              </h1>

              <p className="section-subtitle mt-2">
                Jelajahi semua produk Vixel
              </p>
            </>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="container-page py-6">
        <div className="flex flex-wrap gap-2 justify-center">

          <a
            to="/katalog"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !slug
                ? 'bg-navy-600 text-white'
                : 'bg-white text-charcoal-600 hover:bg-navy-50 border border-charcoal-100'
            }`}
          >
            Semua
          </a>

          {categories.map((cat) => (
            <a
              key={cat.id}
              to={`/katalog/${cat.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                slug === cat.slug
                  ? 'bg-navy-600 text-white'
                  : 'bg-white text-charcoal-600 hover:bg-navy-50 border border-charcoal-100'
              }`}
            >
              {cat.name}
            </a>
          ))}

        </div>
      </div>

      <div className="container-page pb-20">

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Filters sidebar */}
          <aside
            className={`lg:w-64 shrink-0 ${
              showFilters
                ? 'fixed inset-0 z-50 bg-white p-6 overflow-auto lg:static lg:p-0'
                : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between mb-6 lg:hidden">
              <h3 className="font-serif text-xl font-semibold">
                Filter
              </h3>

              <button
                onClick={() => setShowFilters(false)}
                className="p-2 rounded-lg hover:bg-navy-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="card p-5 lg:sticky lg:top-24">

              <h3 className="font-serif text-lg font-semibold mb-4 hidden lg:block">
                Filter
              </h3>

              {/* Price */}
              <div className="mb-5">
                <label className="label">
                  Rentang Harga
                </label>

                <div className="flex items-center gap-2">

                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) =>
                      setMinPrice(e.target.value)
                    }
                    className="input text-xs"
                  />

                  <span className="text-charcoal-300">
                    -
                  </span>

                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) =>
                      setMaxPrice(e.target.value)
                    }
                    className="input text-xs"
                  />

                </div>
              </div>

              {/* Theme */}
              {isInvitationCategory &&
                themes.length > 0 && (
                  <div className="mb-5">

                    <label className="label">
                      Tema Undangan
                    </label>

                    <select
                      value={theme}
                      onChange={(e) =>
                        setTheme(e.target.value)
                      }
                      className="input"
                    >
                      <option value="">
                        Semua tema
                      </option>

                      {themes.map((item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      ))}
                    </select>

                  </div>
                )}

              {/* Sort */}
              <div className="mb-5">

                <label className="label">
                  Urutkan
                </label>

                <select
                  value={sort}
                  onChange={(e) =>
                    setSort(
                      e.target.value as SortOption
                    )
                  }
                  className="input"
                >
                  <option value="newest">
                    Terbaru
                  </option>

                  <option value="price-low">
                    Harga Terendah
                  </option>

                  <option value="price-high">
                    Harga Tertinggi
                  </option>

                  <option value="name">
                    Nama A-Z
                  </option>
                </select>

              </div>

              {/* Reset */}
              {(minPrice || maxPrice || theme) && (
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setTheme('');
                  }}
                  className="text-xs text-navy-600 hover:underline"
                >
                  Reset filter
                </button>
              )}

            </div>
          </aside>

          {/* Products */}
          <div className="flex-1">

            <div className="flex items-center justify-between mb-6">

              <p className="text-sm text-charcoal-400">
                {loading
                  ? 'Memuat...'
                  : `${filtered.length} produk ditemukan`}
              </p>

              <button
                onClick={() => setShowFilters(true)}
                className="lg:hidden btn-outline text-sm px-4 py-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filter
              </button>

            </div>

            {/* Loading */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="card overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[4/3] bg-cream-200" />

                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-cream-200 rounded w-1/3" />
                      <div className="h-5 bg-cream-200 rounded w-3/4" />
                      <div className="h-4 bg-cream-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}

              </div>

            ) : filtered.length === 0 ? (

              /* Empty */
              <div className="card p-16 text-center">
                <p className="text-charcoal-400">
                  Tidak ada produk yang cocok dengan filter ini.
                </p>
              </div>

            ) : (

              <>
                {/* Product grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                  {paginatedProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                    />
                  ))}

                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">

                    {/* Previous */}
                    <button
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      aria-label="Halaman sebelumnya"
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-charcoal-100 bg-white text-charcoal-600 transition-all hover:bg-navy-50 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-2">

                      {paginationPages.map(
                        (page, index) =>
                          page === 'dots' ? (
                            <span
                              key={`dots-${index}`}
                              className="w-10 h-10 flex items-center justify-center text-charcoal-400"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={page}
                              onClick={() =>
                                goToPage(page)
                              }
                              aria-label={`Halaman ${page}`}
                              aria-current={
                                currentPage === page
                                  ? 'page'
                                  : undefined
                              }
                              className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                                currentPage === page
                                  ? 'bg-navy-600 text-white'
                                  : 'border border-charcoal-100 bg-white text-charcoal-600 hover:bg-navy-50 hover:text-navy-600'
                              }`}
                            >
                              {page}
                            </button>
                          )
                      )}

                    </div>

                    {/* Next */}
                    <button
                      onClick={goToNextPage}
                      disabled={
                        currentPage === totalPages
                      }
                      aria-label="Halaman berikutnya"
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-charcoal-100 bg-white text-charcoal-600 transition-all hover:bg-navy-50 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                  </div>
                )}

                {/* Pagination info */}
                {totalPages > 1 && (
                  <p className="text-center text-sm text-charcoal-400 mt-4">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                )}

              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
