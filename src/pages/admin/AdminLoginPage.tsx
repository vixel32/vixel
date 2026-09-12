import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminLoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/assets/images/ChatGPT_Image_23_Jun_2026,_11.14.58.png"
            alt="Vixel"
            className="w-16 h-16 mx-auto rounded-full object-cover shadow-lg mb-4"
          />
          <h1 className="font-serif text-3xl font-bold text-white">Vixel Admin</h1>
          <p className="text-cream-100/60 text-sm mt-2">Masuk untuk mengelola toko Anda</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-300" />
                <input
                  type="email"
                  className="input pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vixel.my.id"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-300" />
                <input
                  type="password"
                  className="input pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-navy-50 border border-navy-200 px-4 py-3 text-sm text-navy-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-charcoal-100 text-center">
            {/*   <p className="text-xs text-charcoal-400">
              Default login:<br />
              <span className="font-medium text-charcoal-600">admin@vixel.my.id</span> / <span className="font-medium text-charcoal-600">vixeladmin123</span>
            </p> */}
          
          </div>
        </div>
      </div>
    </div>
  );
}
