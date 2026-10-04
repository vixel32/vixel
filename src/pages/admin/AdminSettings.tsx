import { useEffect, useState } from 'react';
import { Save, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/lib/types';

export default function AdminSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState({
    whatsapp_number: '',
    email: '',
    address: '',
    instagram: '',
    tiktok: '',
    facebook: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image_url: '',
    about_text: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setSettings(data as StoreSettings);
        setForm({
          whatsapp_number: data.whatsapp_number ?? '',
          email: data.email ?? '',
          address: data.address ?? '',
          instagram: data.instagram ?? '',
          tiktok: data.tiktok ?? '',
          facebook: data.facebook ?? '',
          hero_title: data.hero_title ?? '',
          hero_subtitle: data.hero_subtitle ?? '',
          hero_image_url: data.hero_image_url ?? '',
          about_text: data.about_text ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `hero-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, file);
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    setForm((prev) => ({ ...prev, hero_image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (settings) {
      const { error: updErr } = await supabase.from('store_settings').update(form).eq('id', settings.id);
      if (updErr) { setError(updErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('store_settings').insert(form);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-serif text-2xl font-bold text-charcoal-800">Pengaturan Toko</h2>
        <p className="text-charcoal-400 text-sm mt-1">Kelola informasi kontak, sosial media, dan tampilan beranda</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Contact */}
        <div className="card p-6">
          <h3 className="font-serif text-lg font-semibold text-charcoal-800 mb-4">Kontak</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nomor WhatsApp</label>
              <input className="input" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Alamat</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="card p-6">
          <h3 className="font-serif text-lg font-semibold text-charcoal-800 mb-4">Sosial Media</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Instagram URL</label>
              <input className="input" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label className="label">TikTok URL</label>
              <input className="input" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} placeholder="https://tiktok.com/@..." />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Facebook URL</label>
              <input className="input" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="https://facebook.com/..." />
            </div>
          </div>
        </div>

        {/* Hero */}
        <div className="card p-6">
          <h3 className="font-serif text-lg font-semibold text-charcoal-800 mb-4">Banner Beranda</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Judul Hero</label>
              <input className="input" value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} />
            </div>
            <div>
              <label className="label">Subjudul Hero</label>
              <textarea className="input min-h-[60px] resize-y" value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} />
            </div>
            <div>
              <label className="label">Gambar Hero</label>
              {form.hero_image_url && (
                <img src={form.hero_image_url} alt="Hero preview" className="w-full max-w-md rounded-xl mb-3 border border-charcoal-100" />
              )}
              <label className="inline-flex items-center gap-2 cursor-pointer btn-outline text-sm">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Mengupload...' : 'Upload Gambar'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card p-6">
          <h3 className="font-serif text-lg font-semibold text-charcoal-800 mb-4">Tentang Kami</h3>
          <div>
            <label className="label">Teks Tentang</label>
            <textarea className="input min-h-[120px] resize-y" value={form.about_text} onChange={(e) => setForm({ ...form, about_text: e.target.value })} />
          </div>
        </div>

        {error && <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">{error}</div>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Pengaturan
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-600 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Tersimpan
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
