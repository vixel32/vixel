import { Link } from 'react-router-dom';
import { Sparkles, Heart, Award, MessageCircle, ArrowRight } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/utils';
import type { StoreSettings } from '@/lib/types';

const values = [
  { icon: Heart, title: 'Dibuat dengan Cinta', desc: 'Setiap produk dikerjakan dengan dedikasi dan perhatian terhadap detail.' },
  { icon: Award, title: 'Kualitas Premium', desc: 'Bahan terbaik dan desain eksklusif untuk momen spesialmu.' },
  { icon: Sparkles, title: 'Desain Elegan', desc: 'Estetika modern dan timeless yang membuat momenmu tak terlupakan.' },
];

export default function AboutPage({ settings }: { settings: StoreSettings | null }) {
  const wa = settings?.whatsapp_number ?? '082218730419';

  return (
    <div className="bg-cream-50">
      {/* Hero */}
      <section className="relative bg-cream-200 py-20">
        <div className="container-page text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/80 flex items-center justify-center mb-4 shadow-md">
            <Sparkles className="w-8 h-8 text-navy-600" />
          </div>
          <h1 className="section-title">Tentang Vixel</h1>
          <p className="section-subtitle max-w-2xl mx-auto mt-3">
            {settings?.hero_subtitle ?? 'Setiap detail penting dalam hidupmu layak mendapatkan sentuhan khusus.'}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="container-page py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl font-bold text-charcoal-800 mb-6">Kisah Kami</h2>
          <p className="text-charcoal-600 leading-relaxed text-lg">
            {settings?.about_text ?? 'Vixel hadir untuk membuat setiap momen spesial dalam hidupmu menjadi lebih berkesan. Kami menyediakan undangan digital dan cetak, buket cantik, serta paket seserahan pernikahan dengan kualitas premium dan desain elegan.'}
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-cream-100/60 py-20">
        <div className="container-page">
          <div className="text-center mb-12">
            <p className="text-navy-400 text-sm font-medium tracking-widest uppercase mb-2">Nilai Kami</p>
            <h2 className="section-title">Mengapa Memilih Vixel</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((v, idx) => (
              <div key={v.title} className="card p-8 text-center animate-fade-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className="w-14 h-14 mx-auto rounded-full bg-navy-100 flex items-center justify-center mb-4">
                  <v.icon className="w-6 h-6 text-navy-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-charcoal-800">{v.title}</h3>
                <p className="text-sm text-charcoal-400 mt-2 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-20">
        <div className="rounded-3xl bg-navy-700 p-10 sm:p-16 text-center">
          <h2 className="font-serif text-3xl font-bold text-white">Mari Wujudkan Momen Impianmu</h2>
          <p className="mt-4 text-white/90 max-w-xl mx-auto">
            Konsultasi gratis dengan tim Vixel. Kami siap membantu mewujudkan undangan, buket, dan seserahan impianmu.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi.')} target="_blank" rel="noopener noreferrer" className="btn-wa shadow-xl">
              <MessageCircle className="w-5 h-5" /> Konsultasi
            </a>
            <Link to="/katalog" className="btn bg-navy-700 text-white hover:bg-navy-700">
              Lihat Katalog <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
