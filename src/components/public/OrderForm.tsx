import { useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, buildWhatsAppUrl } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface OrderFormProps {
  product: Product;
  whatsapp: string;
  isUndangan: boolean;
  onClose: () => void;
}

export default function OrderForm({ product, whatsapp, isUndangan, onClose }: OrderFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [groomParents, setGroomParents] = useState('');
  const [brideParents, setBrideParents] = useState('');
  const [akadVenue, setAkadVenue] = useState('');
  const [akadDate, setAkadDate] = useState('');
  const [akadTime, setAkadTime] = useState('');
  const [receptionVenue, setReceptionVenue] = useState('');
  const [receptionDate, setReceptionDate] = useState('');
  const [receptionTime, setReceptionTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      setError('Nama dan nomor WhatsApp wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await supabase.from('orders').insert({
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        cost_price: product.cost_price ?? 0,
        customer_name: customerName,
        customer_phone: customerPhone,
        quantity,
        groom_name: isUndangan ? groomName || null : null,
        bride_name: isUndangan ? brideName || null : null,
        groom_parents: isUndangan ? groomParents || null : null,
        bride_parents: isUndangan ? brideParents || null : null,
        akad_venue: isUndangan ? akadVenue || null : null,
        akad_date: isUndangan ? akadDate || null : null,
        akad_time: isUndangan ? akadTime || null : null,
        reception_venue: isUndangan ? receptionVenue || null : null,
        reception_date: isUndangan ? receptionDate || null : null,
        reception_time: isUndangan ? receptionTime || null : null,
        notes: notes || null,
        status: 'baru',
      });

      const total = product.price * quantity;
      let message = `Halo Vixel, saya ingin memesan:\n\n`;
      message += `Produk: ${product.name}\n`;
      message += `Harga: ${formatPrice(product.price)}\n`;
      message += `Jumlah: ${quantity}\n`;
      message += `Total: ${formatPrice(total)}\n\n`;
      message += `Nama: ${customerName}\n`;
      message += `WhatsApp: ${customerPhone}\n`;
      if (isUndangan) {
        if (groomName || brideName) message += `Mempelai: ${groomName} & ${brideName}\n`;
        if (groomParents) message += `Ortu Pria: ${groomParents}\n`;
        if (brideParents) message += `Ortu Wanita: ${brideParents}\n`;
        if (akadVenue) message += `Akad: ${akadVenue}, ${akadDate} ${akadTime}\n`;
        if (receptionVenue) message += `Resepsi: ${receptionVenue}, ${receptionDate} ${receptionTime}\n`;
      }
      if (notes) message += `\nCatatan: ${notes}\n`;

      window.open(buildWhatsAppUrl(whatsapp, message), '_blank');
      onClose();
    } catch {
      setError('Gagal mengirim pesanan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-charcoal-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-serif text-xl font-bold text-charcoal-800">Form Pemesanan</h3>
            <p className="text-xs text-charcoal-400 mt-0.5">{product.name} — {formatPrice(product.price)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Pemesan *</label>
              <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="label">Nomor WhatsApp *</label>
              <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
            <div>
              <label className="label">Jumlah</label>
              <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
            </div>
          </div>

          {isUndangan && (
            <>
              <div className="border-t border-charcoal-100 pt-4">
                <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-3">Data Acara</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nama Mempelai Pria</label>
                    <input className="input" value={groomName} onChange={(e) => setGroomName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Nama Mempelai Wanita</label>
                    <input className="input" value={brideName} onChange={(e) => setBrideName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Orang Tua Pria</label>
                    <input className="input" value={groomParents} onChange={(e) => setGroomParents(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Orang Tua Wanita</label>
                    <input className="input" value={brideParents} onChange={(e) => setBrideParents(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="border-t border-charcoal-100 pt-4">
                <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-3">Akad</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="label">Tempat Akad</label>
                    <input className="input" value={akadVenue} onChange={(e) => setAkadVenue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Tanggal Akad</label>
                    <input type="date" className="input" value={akadDate} onChange={(e) => setAkadDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Waktu Akad</label>
                    <input type="time" className="input" value={akadTime} onChange={(e) => setAkadTime(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="border-t border-charcoal-100 pt-4">
                <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-3">Resepsi</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="label">Tempat Resepsi</label>
                    <input className="input" value={receptionVenue} onChange={(e) => setReceptionVenue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Tanggal Resepsi</label>
                    <input type="date" className="input" value={receptionDate} onChange={(e) => setReceptionDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Waktu Resepsi</label>
                    <input type="time" className="input" value={receptionTime} onChange={(e) => setReceptionTime(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="label">Catatan Tambahan</label>
            <textarea className="input min-h-[80px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan untuk admin..." />
          </div>

          {error && <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">{error}</div>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim Pesanan via WhatsApp
          </button>
          <p className="text-xs text-charcoal-400 text-center">Pesanan akan dikirim ke WhatsApp admin Vixel.</p>
        </form>
      </div>
    </div>
  );
}
