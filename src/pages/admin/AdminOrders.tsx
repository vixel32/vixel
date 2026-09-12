import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Phone, Calendar, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice, normalizePhone, buildWhatsAppUrl } from '@/lib/utils';
import type { Order } from '@/lib/types';

const statusOptions = [
  { value: 'baru', label: 'Baru', color: 'bg-blue-100 text-blue-700' },
  { value: 'diproses', label: 'Diproses', color: 'bg-gold-100 text-gold-700' },
  { value: 'selesai', label: 'Selesai', color: 'bg-green-100 text-green-700' },
  { value: 'dibatalkan', label: 'Dibatalkan', color: 'bg-navy-100 text-navy-700' },
];

const filterOptions = [
  { value: 'all', label: 'Semua' },
  { value: 'baru', label: 'Baru' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    load();
  };

  const openDetail = (order: Order) => {
    setSelected(order);
    setAdminNote(order.admin_note ?? '');
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase.from('orders').update({ admin_note: adminNote }).eq('id', selected.id);
    setSaving(false);
    load();
    setSelected(null);
  };

  const printInvoice = (order: Order) => {
    const invoiceWindow = window.open('', '_blank', 'width=900,height=700');
    if (!invoiceWindow) return;
    const escapeHtml = (value: string | null | undefined) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[character] ?? character));
    const total = order.product_price * order.quantity;
    invoiceWindow.document.write(`<!doctype html><html><head><title>Faktur Vixel - ${escapeHtml(order.id.slice(0, 8))}</title><style>body{font-family:Arial,sans-serif;color:#172f5e;padding:48px;max-width:760px;margin:auto}h1{margin:0;font-size:32px;letter-spacing:5px}h2{color:#a8742f;font-size:14px;letter-spacing:2px}header{display:flex;justify-content:space-between;border-bottom:2px solid #d4a64e;padding-bottom:24px;margin-bottom:32px}.meta{text-align:right;color:#565963;font-size:13px}.customer{background:#f6f8fc;padding:18px;border-radius:10px;margin-bottom:24px}.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e2e2e5}.total{font-size:20px;font-weight:bold;color:#172f5e;border:0}.muted{color:#71747e;font-size:13px;margin-top:40px}</style></head><body><header><div><h1>VIXEL</h1><h2>UNDANGAN · DIGITAL · SESERAHAN · DESAIN</h2></div><div class="meta">FAKTUR PEMBELIAN<br><strong>${escapeHtml(order.id.slice(0, 8).toUpperCase())}</strong><br>${escapeHtml(formatDate(order.created_at))}</div></header><div class="customer"><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.customer_phone)}</div><div class="row"><span>${escapeHtml(order.product_name)} × ${order.quantity}</span><strong>${formatPrice(total)}</strong></div><div class="row total"><span>Total</span><span>${formatPrice(total)}</span></div><p class="muted">Terima kasih telah mempercayakan momen spesial Anda kepada Vixel.</p><script>window.onload=function(){window.print()}</script></body></html>`);
    invoiceWindow.document.close();
  };

  const hasEventData = (order: Order) => order.groom_name || order.bride_name;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-charcoal-800">Kelola Pesanan</h2>
        <p className="text-charcoal-400 text-sm mt-1">{orders.length} total pesanan</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === f.value ? 'bg-navy-600 text-white' : 'bg-white text-charcoal-600 border border-charcoal-100 hover:bg-navy-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-charcoal-400">Belum ada pesanan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isOpen = expanded === order.id;
            const statusOpt = statusOptions.find((s) => s.value === order.status);
            return (
              <div key={order.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-cream-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-5 h-5 text-charcoal-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-charcoal-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal-800 text-sm truncate">{order.product_name}</p>
                      <p className="text-xs text-charcoal-400 mt-0.5">
                        {order.customer_name} - {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-charcoal-700 hidden sm:block">{formatPrice(order.product_price * order.quantity)}</span>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusOpt?.color}`}>{statusOpt?.label}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-charcoal-100 p-4 space-y-4 bg-cream-50/30">
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Data Pemesan</p>
                        <p className="text-charcoal-700"><span className="font-medium">Nama:</span> {order.customer_name}</p>
                        <p className="text-charcoal-700">
                          <span className="font-medium">WhatsApp:</span> {order.customer_phone}
                          <a href={buildWhatsAppUrl(order.customer_phone, `Halo ${order.customer_name}, terkait pesanan "${order.product_name}" di Vixel.`)} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-green-600 hover:underline text-xs">
                            <Phone className="w-3 h-3" /> Chat
                          </a>
                        </p>
                        <p className="text-charcoal-700"><span className="font-medium">Jumlah:</span> {order.quantity}</p>
                      </div>
                      {hasEventData(order) && (
                        <div>
                          <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Data Acara</p>
                          <p className="text-charcoal-700"><span className="font-medium">Mempelai:</span> {order.groom_name} & {order.bride_name}</p>
                          {order.groom_parents && <p className="text-charcoal-700"><span className="font-medium">Ortu Pria:</span> {order.groom_parents}</p>}
                          {order.bride_parents && <p className="text-charcoal-700"><span className="font-medium">Ortu Wanita:</span> {order.bride_parents}</p>}
                        </div>
                      )}
                    </div>

                    {hasEventData(order) && (
                      <div className="grid sm:grid-cols-2 gap-4 text-sm border-t border-charcoal-100 pt-4">
                        <div>
                          <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Akad</p>
                          <p className="text-charcoal-700">{order.akad_venue}</p>
                          <p className="text-charcoal-500 text-xs flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" /> {order.akad_date} {order.akad_time}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Resepsi</p>
                          <p className="text-charcoal-700">{order.reception_venue}</p>
                          <p className="text-charcoal-500 text-xs flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" /> {order.reception_date} {order.reception_time}
                          </p>
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <div className="text-sm border-t border-charcoal-100 pt-4">
                        <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Catatan Pelanggan</p>
                        <p className="text-charcoal-600">{order.notes}</p>
                      </div>
                    )}

                    {order.admin_note && (
                      <div className="text-sm border-t border-charcoal-100 pt-4">
                        <p className="text-xs text-charcoal-400 uppercase tracking-wider mb-1">Catatan Internal</p>
                        <p className="text-charcoal-600 italic">{order.admin_note}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-charcoal-100 pt-4">
                      <span className="text-sm text-charcoal-500 mr-2">Ubah Status:</span>
                      {statusOptions.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => updateStatus(order.id, s.value)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                            order.status === s.value ? s.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white border border-charcoal-100 text-charcoal-500 hover:bg-cream-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                      <button onClick={() => printInvoice(order)} className="btn-outline text-xs px-3 py-1.5">
                        <Printer className="w-3.5 h-3.5" /> Cetak Faktur
                      </button>
                      <button onClick={() => openDetail(order)} className="btn-outline text-xs px-3 py-1.5 ml-auto">
                        Catatan Internal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note modal */}
      {selected && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal-100">
              <h3 className="font-serif text-lg font-bold text-charcoal-800">Catatan Internal</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-charcoal-400 mb-3">Pesanan: {selected.product_name}</p>
              <textarea className="input min-h-[100px] resize-y" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Tulis catatan internal..." />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setSelected(null)} className="btn-outline">Batal</button>
                <button onClick={saveNote} disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
