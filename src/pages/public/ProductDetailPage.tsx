import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Star, CheckCircle2, ExternalLink, Play, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppUrl, formatPrice, normalizeImageUrl, getGoogleDriveEmbedUrl, isGoogleDriveVideo } from '@/lib/utils';
import type { Product, StoreSettings } from '@/lib/types';
import OrderForm from '@/components/public/OrderForm';

export default function ProductDetailPage({ settings }: { settings: StoreSettings | null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const wa = settings?.whatsapp_number ?? '082218730419';

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*, category:product_categories(*), product_images(*)')
        .eq('id', id)
        .maybeSingle();
      setProduct(data as Product | null);
      setLoading(false);
    })();
  }, [id]);

  const isUndangan = product?.category?.slug === 'undangan-digital' || product?.category?.slug === 'undangan-cetak';

  if (loading) {
    return (
      <div className="container-page py-20">
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="aspect-square bg-cream-200 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 bg-cream-200 rounded w-1/4 animate-pulse" />
            <div className="h-8 bg-cream-200 rounded w-3/4 animate-pulse" />
            <div className="h-6 bg-cream-200 rounded w-1/3 animate-pulse" />
            <div className="h-24 bg-cream-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="section-title">Produk Tidak Ditemukan</h1>
        <p className="section-subtitle mt-2">Produk yang Anda cari mungkin telah dihapus atau tidak tersedia.</p>
        <Link to="/katalog" className="btn-primary mt-6">Kembali ke Katalog</Link>
      </div>
    );
  }

  const images = product.product_images ?? [];
  const displayImage = images[activeImage]?.image_url ?? images[0]?.image_url;

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container-page py-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-charcoal-500 hover:text-navy-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Gallery */}
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-sm border border-charcoal-100">
              {displayImage ? (
                <img src={normalizeImageUrl(displayImage)} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-charcoal-300">No image</div>
              )}
              {product.video_url && (
                <button
                  onClick={() => setShowVideo(true)}
                  className="absolute bottom-4 right-4 btn bg-white/90 text-charcoal-700 hover:bg-white shadow-lg text-sm"
                >
                  <Play className="w-4 h-4 fill-charcoal-700" />
                  Lihat Video
                </button>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto scrollbar-hide pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(idx)}
                    className={`w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      activeImage === idx ? 'border-navy-400' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={normalizeImageUrl(img.image_url)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.category && (
              <span className="text-sm font-medium text-navy-400 uppercase tracking-wider">{product.category.name}</span>
            )}
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-800 mt-1">{product.name}</h1>

            <div className="flex items-center gap-4 mt-4">
              <span className="text-3xl font-bold text-charcoal-800">{formatPrice(product.price)}</span>
              {product.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-700">
                  <Star className="w-3 h-3 fill-gold-500 text-gold-500" />
                  Produk Unggulan
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className={`inline-flex items-center gap-1.5 ${product.stock === null || product.stock > 0 ? 'text-green-600' : 'text-navy-600'}`}>
                <CheckCircle2 className="w-4 h-4" />
                {product.stock === null ? 'Stok tersedia' : product.stock > 0 ? `Stok tersedia (${product.stock})` : 'Stok habis'}
              </span>
            </div>

            <div className="mt-6 prose prose-sm max-w-none">
              <p className="text-charcoal-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>

            {product.preview_link && (
              <a href={product.preview_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm text-navy-600 hover:underline">
                <ExternalLink className="w-4 h-4" />
                Lihat Preview Produk
              </a>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setShowOrderForm(true)}
                disabled={product.stock !== null && product.stock <= 0}
                className="btn-primary flex-1"
              >
                Pesan Sekarang
              </button>
              <a
                href={buildWhatsAppUrl(wa, `Halo Vixel, saya tertarik dengan produk "${product.name}" (${formatPrice(product.price)}). Mohon info lebih lanjut.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa flex-1"
              >
                <MessageCircle className="w-4 h-4" />
                Tanya via WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {showVideo && product.video_url && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/80 flex items-center justify-center p-4" onClick={() => setShowVideo(false)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {isGoogleDriveVideo(product.video_url) ? (
              <iframe
                src={getGoogleDriveEmbedUrl(product.video_url)}
                allow="autoplay"
                className="w-full aspect-video rounded-2xl bg-black"
                allowFullScreen
              />
            ) : (
              <video src={product.video_url} controls autoPlay className="w-full rounded-2xl bg-black" />
            )}
          </div>
        </div>
      )}

      {/* Order Form Modal */}
      {showOrderForm && (
        <OrderForm
          product={product}
          whatsapp={wa}
          isUndangan={isUndangan}
          onClose={() => setShowOrderForm(false)}
        />
      )}
    </div>
  );
}
