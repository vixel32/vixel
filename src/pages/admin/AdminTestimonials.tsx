import { useEffect, useState, useCallback } from 'react';
import { Check, X, Trash2, Plus, Star, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Testimonial } from '@/lib/types';

const filterOptions = [
  { value: 'pending', label: 'Menunggu Review', icon: Clock },
  { value: 'approved', label: 'Disetujui', icon: CheckCircle2 },
  { value: 'all', label: 'Semua', icon: Star },
];

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', message: '', rating: 5 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('testimonials').select('*').order('created_at', { ascending: false });
    setTestimonials((data as Testimonial[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? testimonials : testimonials.filter((t) => t.status === filter);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('testimonials').update({ status }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus testimoni ini?')) return;
    await supabase.from('testimonials').delete().eq('id', id);
    load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.message) { setError('Nama dan testimoni wajib diisi.'); return; }
    setSaving(true);
    setError(null);
    const { error: insErr } = await supabase.from('testimonials').insert({
      name: form.name,
      message: form.message,
      rating: form.rating,
      status: 'approved',
    });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    setShowForm(false);
    setForm({ name: '', message: '', rating: 5 });
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = testimonials.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">Kelola Testimoni</h2>
          <p className="text-charcoal-400 text-sm mt-1">
            {pendingCount > 0 && <span className="text-navy-600 font-medium">{pendingCount} menunggu review</span>}
            {pendingCount === 0 && `${testimonials.length} testimoni total`}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Tambah Testimoni
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              filter === f.value ? 'bg-navy-600 text-white' : 'bg-white text-charcoal-600 border border-charcoal-100 hover:bg-navy-50'
            }`}
          >
            <f.icon className="w-4 h-4" />
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-charcoal-400">Tidak ada testimoni.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-charcoal-600 font-semibold text-sm">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-charcoal-800 text-sm">{t.name}</p>
                    <p className="text-xs text-charcoal-400">{formatDate(t.created_at)}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  t.status === 'approved' ? 'bg-green-100 text-green-700' :
                  t.status === 'pending' ? 'bg-gold-100 text-gold-700' :
                  'bg-navy-100 text-navy-700'
                }`}>
                  {t.status === 'approved' ? 'Disetujui' : t.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                </span>
              </div>

              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-gold-400 text-gold-400" />
                ))}
              </div>

              <p className="text-sm text-charcoal-600 leading-relaxed italic">"{t.message}"</p>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-charcoal-100">
                {t.status !== 'approved' && (
                  <button onClick={() => updateStatus(t.id, 'approved')} className="btn text-xs px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 flex-1">
                    <Check className="w-3.5 h-3.5" /> Setujui
                  </button>
                )}
                {t.status !== 'rejected' && (
                  <button onClick={() => updateStatus(t.id, 'rejected')} className="btn text-xs px-3 py-2 bg-gold-50 text-gold-600 hover:bg-gold-100 flex-1">
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                )}
                <button onClick={() => handleDelete(t.id)} className="btn text-xs px-3 py-2 bg-navy-50 text-navy-700 hover:bg-navy-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal-100">
              <h3 className="font-serif text-xl font-bold text-charcoal-800">Tambah Testimoni</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-navy-50"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="label">Nama *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, rating: r })} className="p-1">
                      <Star className={`w-6 h-6 ${r <= form.rating ? 'fill-gold-400 text-gold-400' : 'text-charcoal-200'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Testimoni *</label>
                <textarea className="input min-h-[100px] resize-y" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              {error && <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
              <p className="text-xs text-charcoal-400 text-center">Testimoni ini akan langsung berstatus disetujui.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
