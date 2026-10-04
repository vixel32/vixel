import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CategoryIcon } from '@/components/public/CategoryIcon';
import type { ProductCategory } from '@/lib/types';

const emptyForm = { name: '', slug: '', description: '', icon: 'package', sort_order: 0 };

const iconOptions = [
  { value: 'monitor', label: 'Monitor' },
  { value: 'file-text', label: 'File Text' },
  { value: 'flower', label: 'Flower' },
  { value: 'gift', label: 'Gift' },
  { value: 'package', label: 'Package' },
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('category_id'),
    ]);
    const cats = (catRes.data as ProductCategory[]) ?? [];
    setCategories(cats);
    const counts: Record<string, number> = {};
    (prodRes.data ?? []).forEach((p: { category_id: string }) => {
      counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    setProductCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: categories.length + 1 });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (cat: ProductCategory) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      icon: cat.icon ?? 'package',
      sort_order: cat.sort_order,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) {
      setError('Nama dan slug wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
      description: form.description || null,
      icon: form.icon,
      sort_order: form.sort_order,
    };
    if (editing) {
      const { error: updErr } = await supabase.from('product_categories').update(payload).eq('id', editing.id);
      if (updErr) { setError(updErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('product_categories').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (cat: ProductCategory) => {
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    await supabase.from('product_categories').delete().eq('id', cat.id);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">Kelola Kategori</h2>
          <p className="text-charcoal-400 text-sm mt-1">{categories.length} kategori</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center">
                  <CategoryIcon icon={cat.icon} className="w-6 h-6 text-navy-600" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-charcoal-800">{cat.name}</h3>
                  <span className="text-xs text-charcoal-400">/katalog/{cat.slug}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-charcoal-400 mt-3 line-clamp-2">{cat.description}</p>
            <p className="text-xs text-charcoal-500 mt-2">{productCounts[cat.id] ?? 0} produk</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openEdit(cat)} className="btn-outline text-xs px-3 py-2 flex-1">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => handleDelete(cat)} className="btn text-xs px-3 py-2 bg-navy-50 text-navy-700 hover:bg-navy-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] bg-charcoal-900/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal-100">
              <h3 className="font-serif text-xl font-bold text-charcoal-800">{editing ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-navy-50"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nama *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Slug *</label>
                <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="undangan-digital" />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input min-h-[60px] resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ikon</label>
                  <select className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                    {iconOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Urutan</label>
                  <input type="number" className="input" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              {error && <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
