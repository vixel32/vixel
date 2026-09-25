import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Star,
  CheckCircle2,
  ExternalLink,
  Play,
  X,
  Youtube,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buildWhatsAppUrl,
  formatPrice,
  normalizeImageUrl,
  getGoogleDriveEmbedUrl,
  isGoogleDriveVideo,
  getOriginalPrice,
} from '@/lib/utils';
import type { Product, StoreSettings } from '@/lib/types';
import OrderForm from '@/components/public/OrderForm';

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // https://youtu.be/Nx1LuRiDZfU
    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }

    // https://www.youtube.com/watch?v=Nx1LuRiDZfU
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;

      // /embed/Nx1LuRiDZfU
      // /shorts/Nx1LuRiDZfU
      // /live/Nx1LuRiDZfU
      const parts = parsed.pathname.split('/').filter(Boolean);
      const type = parts[0];
      if (
        (type === 'embed' || type === 'shorts' || type === 'live') &&
        parts[1]
      ) {
        return parts[1];
      }
    }
  } catch {
    // Fall through to a simple pattern for malformed/partial URLs.
  }

  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/
  );

  return match?.[1] ?? null;
}

function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;

  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function isYouTubeVideo(url: string): boolean {
  return Boolean(getYouTubeVideoId(url));
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadProduct() {
      if (!id) return;

      setLoading(true);

      const [{ data: productData }, { data: settingsData }] =
        await Promise.all([
          supabase
            .from('products')
            .select('*, category:product_categories(*), product_images(*)')
            .eq('id', id)
            .maybeSingle(),
          supabase.from('store_settings').select('*').maybeSingle(),
        ]);

      if (!mounted) return;

      setProduct(productData as Product | null);
      setStoreSettings(settingsData as StoreSettings | null);
      setLoading(false);
    }

    loadProduct();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Always stop the video when the modal is closed or the page changes.
  useEffect(() => {
    if (!showVideo) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowVideo(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [showVideo]);

  const categorySlug = product?.category?.slug;
  const isUndanganDigital = categorySlug === 'undangan-digital';
  const isUndanganCetak = categorySlug === 'undangan-cetak';
  const isUndangan = isUndanganDigital || isUndanganCetak;

  const galleryImages = useMemo(() => {
    if (!product) return [];

    const images = (product.product_images ?? [])
      .sort(
        (a: any, b: any) =>
          (a.sort_order ?? a.position ?? 0) -
          (b.sort_order ?? b.position ?? 0)
      )
      .map((image: any) =>
        normalizeImageUrl(image.image_url ?? image.url ?? '')
      )
      .filter(Boolean);

    const mainImage = normalizeImageUrl(
      (product as any).image_url ?? (product as any).image ?? ''
    );

    return Array.from(new Set([mainImage, ...images].filter(Boolean)));
  }, [product]);

  const videoUrl = product?.video_url ?? '';
  const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl);
  const youtubeVideo = isYouTubeVideo(videoUrl);
  const googleDriveVideo = isGoogleDriveVideo(videoUrl);

  const waNumber =
    (storeSettings as any)?.whatsapp_number ||
    (storeSettings as any)?.whatsapp ||
    '082218730419';

  const wa = product
    ? buildWhatsAppUrl(
        waNumber,
        `Halo Vixel, saya tertarik dengan produk "${product.name}".`
      )
    : '#';

  const originalPrice = product ? getOriginalPrice(product.price) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-charcoal-900">
          Produk tidak ditemukan
        </h1>
        <p className="mt-2 text-charcoal-500">
          Produk yang kamu cari mungkin sudah dihapus atau tidak tersedia.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-5 py-3 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
      </div>
    );
  }

  const productName = product.name;
  const description = product.description || 'Produk pilihan dari Vixel.';
  const previewLink = product.preview_link;

  return (
    <div className="min-h-screen bg-white text-charcoal-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="relative overflow-hidden rounded-3xl bg-charcoal-50">
              {galleryImages.length > 0 ? (
                <img
                  src={galleryImages[activeImage] || galleryImages[0]}
                  alt={productName}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full flex items-center justify-center text-charcoal-400">
                  Tidak ada gambar
                </div>
              )}

              {product.video_url && (
                <button
                  type="button"
                  onClick={() => setShowVideo(true)}
                  className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur hover:bg-white transition-colors"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal-900 text-white">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </span>
                  Lihat Video
                </button>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`shrink-0 overflow-hidden rounded-xl border-2 ${
                      activeImage === index
                        ? 'border-charcoal-900'
                        : 'border-transparent'
                    }`}
                    aria-label={`Lihat gambar ${index + 1}`}
                  >
                    <img
                      src={image}
                      alt=""
                      className="h-20 w-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col">
            {product.category?.name && (
              <p className="text-sm font-medium uppercase tracking-wider text-charcoal-500">
                {product.category.name}
              </p>
            )}

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {productName}
            </h1>

            <div className="mt-4 flex items-center gap-2 text-sm text-charcoal-500">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-current" />
                <span>Produk pilihan Vixel</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Siap dipesan</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold">
                  {formatPrice(product.price)}
                </span>
                {originalPrice > product.price && (
                  <span className="pb-1 text-lg text-charcoal-400 line-through">
                    {formatPrice(originalPrice)}
                  </span>
                )}
              </div>

              {originalPrice > product.price && (
                <span className="mt-2 inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  DISKON 20%
                </span>
              )}
            </div>

            <div className="mt-6 whitespace-pre-line leading-7 text-charcoal-600">
              {description}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowOrderForm(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-charcoal-900 px-6 py-4 font-semibold text-white transition hover:opacity-90"
              >
                Pesan Sekarang
              </button>

              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-charcoal-200 px-6 py-4 font-semibold text-charcoal-900 transition hover:bg-charcoal-50"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>

            {previewLink && (
              <a
                href={previewLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-charcoal-200 px-6 py-4 font-medium text-charcoal-700 transition hover:bg-charcoal-50"
              >
                <ExternalLink className="h-5 w-5" />
                Lihat Preview
              </a>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-charcoal-50 p-4">
                <CheckCircle2 className="h-5 w-5" />
                <p className="mt-2 font-medium">Kualitas terjamin</p>
                <p className="mt-1 text-sm text-charcoal-500">
                  Dikerjakan dengan detail untuk kebutuhanmu.
                </p>
              </div>

              <div className="rounded-2xl bg-charcoal-50 p-4">
                <MessageCircle className="h-5 w-5" />
                <p className="mt-2 font-medium">Bantuan via WhatsApp</p>
                <p className="mt-1 text-sm text-charcoal-500">
                  Konsultasikan kebutuhan sebelum memesan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIDEO MODAL */}
      {showVideo && product.video_url && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setShowVideo(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Video ${productName}`}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-full p-2 text-white transition hover:bg-white/10"
            onClick={() => setShowVideo(false)}
            aria-label="Tutup video"
          >
            <X className="h-7 w-7" />
          </button>

          <div
            className="w-full max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl bg-black shadow-2xl">
              {youtubeEmbedUrl ? (
                <iframe
                  key={youtubeEmbedUrl}
                  src={youtubeEmbedUrl}
                  title={productName}
                  className="block aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : googleDriveVideo ? (
                <iframe
                  src={getGoogleDriveEmbedUrl(product.video_url)}
                  title={productName}
                  allow="autoplay"
                  className="block aspect-video w-full bg-black"
                  frameBorder="0"
                  allowFullScreen
                />
              ) : (
                <video
                  key={product.video_url}
                  src={product.video_url}
                  controls
                  autoPlay
                  playsInline
                  className="block aspect-video w-full bg-black object-contain"
                />
              )}
            </div>

            {youtubeVideo && (
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/70">
                <span className="inline-flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  Video dari YouTube
                </span>

                <a
                  href={product.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-white hover:underline"
                >
                  Buka YouTube
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {showOrderForm && (
        <OrderForm
          product={product}
          whatsapp={wa}
          isUndangan={isUndangan}
          isUndanganDigital={isUndanganDigital}
          isUndanganCetak={isUndanganCetak}
          onClose={() => setShowOrderForm(false)}
        />
      )}
    </div>
  );
}
