import { useState } from 'react';
import { MessageCircle, Mail, MapPin, Instagram, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/utils';
import type { StoreSettings } from '@/lib/types';

export default function ContactPage({ settings }: { settings: StoreSettings | null }) {
  const wa = settings?.whatsapp_number ?? '082218730419';
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !message) return;
    const text = `Halo Vixel, saya ${name}.\n\n${message}`;
    window.open(buildWhatsAppUrl(wa, text), '_blank');
    setSent(true);
  };

  return (
    <div className="bg-cream-50">
      <section className="bg-cream-200 py-16">
        <div className="container-page text-center">
          <h1 className="section-title">Hubungi Kami</h1>
          <p className="section-subtitle mt-2">Kami siap membantu mewujudkan momen spesialmu</p>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid lg:grid-cols-2 gap-10">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-charcoal-800">WhatsApp</h3>
                  <p className="text-sm text-charcoal-400 mt-1">Chat langsung untuk konsultasi atau pemesanan</p>
                  <a href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi.')} target="_blank" rel="noopener noreferrer" className="btn-wa mt-3 text-sm">
                    <MessageCircle className="w-4 h-4" /> {wa}
                  </a>
                </div>
              </div>
            </div>

            {settings?.email && (
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-navy-100 flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-navy-600" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-charcoal-800">Email</h3>
                    <p className="text-sm text-charcoal-600 mt-1">{settings.email}</p>
                  </div>
                </div>
              </div>
            )}

            {settings?.address && (
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-gold-600" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-charcoal-800">Alamat</h3>
                    <p className="text-sm text-charcoal-600 mt-1">{settings.address}</p>
                  </div>
                </div>
              </div>
            )}

            {settings?.instagram && (
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-navy-600 flex items-center justify-center shrink-0">
                    <Instagram className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-charcoal-800">Instagram</h3>
                    <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="text-sm text-navy-600 hover:underline mt-1 inline-block">
                      @happyvixel
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact form */}
          <div className="card p-8">
            <h2 className="font-serif text-2xl font-bold text-charcoal-800 mb-2">Kirim Pesan</h2>
            <p className="text-sm text-charcoal-400 mb-6">Pesan akan diteruskan ke WhatsApp kami</p>
            {sent ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-charcoal-800">Pesan Terkirim!</h3>
                <p className="text-sm text-charcoal-500 mt-2">WhatsApp telah terbuka dengan pesan Anda. Silakan kirim untuk konfirmasi.</p>
                <button onClick={() => { setSent(false); setName(''); setMessage(''); }} className="btn-outline mt-6">Kirim Pesan Lain</button>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="label">Nama</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" required />
                </div>
                <div>
                  <label className="label">Pesan</label>
                  <textarea className="input min-h-[120px] resize-y" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis pesan Anda..." required />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <Send className="w-4 h-4" />
                  Kirim via WhatsApp
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
