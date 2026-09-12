import { Link } from 'react-router-dom';
import { Star, ImageIcon } from 'lucide-react';
import { formatPrice, normalizeImageUrl } from '@/lib/utils';
import type { Product } from '@/lib/types';

export default function ProductCard({ product }: { product: Product }) {
  const img = product.product_images?.[0]?.image_url;

  return (
   <Link to={`/produk/${product.id}`} className="card group overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative aspect-[4/3] bg-cream-100 overflow-hidden">
        {img ? (
          <img
            src={normalizeImageUrl(img)}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300">
            <ImageIcon className="w-10 h-10" />
          </div>
        )}
        {product.is_featured && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-gold-400 px-2.5 py-0.5 text-xs font-semibold text-navy-900">
            <Star className="w-3 h-3 fill-navy-900" /> Unggulan
          </span>
        )}
        {product.stock !== null && product.stock <= 0 && (
          <div className="absolute inset-0 bg-charcoal-900/40 flex items-center justify-center">
            <span className="bg-white px-3 py-1.5 rounded-full text-xs font-semibold">Stok Habis</span>
          </div>
        )}
      </div>
      <div className="p-4">
        {product.category && (
          <span className="text-xs text-navy-400">{product.category.name}</span>
        )}
        <h3 className="font-serif text-base font-semibold text-charcoal-800 mt-0.5 line-clamp-1 group-hover:text-navy-600 transition-colors">
          {product.name}
        </h3>
        {product.theme && (
          <p className="text-xs text-gold-600 mt-1">Tema: {product.theme}</p>
        )}
        <p className="text-sm font-bold text-charcoal-800 mt-2">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
