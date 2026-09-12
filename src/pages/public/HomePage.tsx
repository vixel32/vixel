import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, MessageCircle, CheckCircle2, Quote } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppUrl } from '@/lib/utils';
import type { Product, ProductCategory, Testimonial, StoreSettings } from '@/lib/types';
import ProductCard from '@/components/public/ProductCard';
import { CategoryIcon } from '@/components/public/CategoryIcon';

const steps = [
  { num: '01', title: 'Pilih Produk', desc: 'Jelajahi katalog dan pilih produk yang Anda inginkan.' },
  { num: '02', title: 'Isi Form Pemesanan', desc: 'Lengkapi data pemesan dan data acara jika diperlukan.' },
  { num: '03', title: 'Kirim via WhatsApp', desc: 'Pesanan otomatis terkirim ke WhatsApp admin beserta detailnya.' },
  { num: '04', title: 'Konfirmasi & Proses', desc: 'Admin akan mengkonfirmasi pesanan dan memprosesnya dengan cinta.' },
];

export default function HomePage({ settings }: { settings: StoreSettings | null }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const wa = settings?.whatsapp_number ?? '082218730419';

  useEffect(() => {
    (async () => {
      const [catRes, featRes, testRes] = await Promise.all([
        supabase.from('product_categories').select('*').order('sort_order'),
        supabase
          .from('products')
          .select('*, category:product_categories(*), product_images(*)')
          .eq('is_active', true)
          .eq('is_featured', true)
          .order('sort_order')
          .limit(8),
        supabase
          .from('testimonials')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      setCategories(catRes.data as ProductCategory[] ?? []);
      setFeatured(featRes.data as Product[] ?? []);
      setTestimonials(testRes.data as Testimonial[] ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={settings?.hero_image_url ?? 'https://images.pexels.com/photos/19024679/pexels-photo-19024679.jpeg?auto=compress&cs=tinysrgb&h=900&w=1600'}
            alt="Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-charcoal-900/60" />
        </div>
        <div className="container-page relative z-10 py-20">
          <div className="max-w-2xl">
            <p className="text-navy-200 text-sm font-medium tracking-widest uppercase mb-4 animate-fade-up">
              Vixel — Momen Spesialmu
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight text-balance animate-fade-up" style={{ animationDelay: '0.1s' }}>
              {settings?.hero_title ?? 'Setiap Detail Penting Layak Mendapat Sentuhan Khusus'}
            </h1>
            <p className="mt-6 text-lg text-cream-100/90 leading-relaxed max-w-xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
              {settings?.hero_subtitle ?? 'Undangan digital, undangan cetak, buket, dan jasa seserahan untuk momen spesialmu.'}
            </p>
            <div className="flex flex-wrap gap-4 mt-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Link to="/katalog" className="btn-primary">
                Lihat Katalog
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi tentang produk Anda.')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa"
              >
                <MessageCircle className="w-4 h-4" />
                Konsultasi
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-20">
        <div className="text-center mb-12">
          <p className="text-navy-400 text-sm font-medium tracking-widest uppercase mb-2">Layanan Kami</p>
          <h2 className="section-title">Empat Kategori, Banyak Pilihan</h2>
          <p className="section-subtitle">Temukan kebutuhan untuk momen spesialmu</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              to={`/katalog/${cat.slug}`}
              className="card group p-6 text-center hover:shadow-xl hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-navy-100 flex items-center justify-center mb-4 group-hover:bg-navy-200 transition-all">
                <CategoryIcon icon={cat.icon} className="w-7 h-7 text-navy-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800 group-hover:text-navy-600 transition-colors">
                {cat.name}
              </h3>
              <p className="text-xs text-charcoal-400 mt-2 line-clamp-2 leading-relaxed">{cat.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-cream-100/60 py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-navy-400 text-sm font-medium tracking-widest uppercase mb-2">Pilihan Terbaik</p>
              <h2 className="section-title">Produk Unggulan</h2>
            </div>
            <Link to="/katalog" className="btn-outline text-sm">
              Lihat Semua
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-cream-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-cream-200 rounded w-1/3" />
                    <div className="h-5 bg-cream-200 rounded w-3/4" />
                    <div className="h-4 bg-cream-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How to Order */}
      <section className="container-page py-20">
        <div className="text-center mb-12">
          <p className="text-navy-400 text-sm font-medium tracking-widest uppercase mb-2">Mudah & Cepat</p>
          <h2 className="section-title">Cara Pemesanan</h2>
          <p className="section-subtitle">Hanya 4 langkah sampai pesananmu diproses</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div
              key={step.num}
              className="relative card p-6 animate-fade-up"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <span className="font-serif text-5xl font-bold text-navy-100">{step.num}</span>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800 mt-2">{step.title}</h3>
              <p className="text-sm text-charcoal-400 mt-2 leading-relaxed">{step.desc}</p>
              {idx < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-4 w-6 h-6 text-navy-200" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {!loading && testimonials.length > 0 && (
        <section className="bg-cream-200/60 py-20">
          <div className="container-page">
            <div className="text-center mb-12">
              <p className="text-navy-400 text-sm font-medium tracking-widest uppercase mb-2">Kata Mereka</p>
              <h2 className="section-title">Testimoni Pelanggan</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.slice(0, 6).map((t, idx) => (
                <div
                  key={t.id}
                  className="card p-6 animate-fade-up"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <Quote className="w-8 h-8 text-navy-200 mb-3" />
                  <p className="text-sm text-charcoal-600 leading-relaxed italic">"{t.message}"</p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-charcoal-100">
                    <div>
                      <p className="font-semibold text-charcoal-800 text-sm">{t.name}</p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: t.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link to="/testimoni" className="btn-outline">
                Lihat Semua Testimoni
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page py-20">
        <div className="relative rounded-3xl overflow-hidden bg-navy-900 p-10 sm:p-16 text-center">
          <div className="relative">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white text-balance">
              Siap Membuat Momen Spesialmu?
            </h2>
            <p className="mt-4 text-white/90 max-w-xl mx-auto">
              Konsultasi gratis dengan tim Vixel. Kami siap membantu mewujudkan undangan, buket, dan seserahan impianmu.
            </p>
            <a
              href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi tentang produk Anda.')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa mt-8 shadow-xl"
            >
              <MessageCircle className="w-5 h-5" />
              Konsultasi Sekarang
            </a>
            <div className="flex items-center justify-center gap-6 mt-8 text-white/80 text-sm flex-wrap">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Konsultasi Gratis</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Desain Eksklusif</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Pengerjaan Cepat</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
