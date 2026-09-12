import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, MessageSquare,
  Settings, LogOut, Menu, X, ExternalLink, TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const menu = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/produk', label: 'Kelola Produk', icon: Package },
  { to: '/admin/kategori', label: 'Kelola Kategori', icon: FolderTree },
  { to: '/admin/pesanan', label: 'Kelola Pesanan', icon: ShoppingCart },
  { to: '/admin/pendapatan', label: 'Kelola Pendapatan', icon: TrendingUp },
  { to: '/admin/testimoni', label: 'Kelola Testimoni', icon: MessageSquare },
  { to: '/admin/pengaturan', label: 'Pengaturan Toko', icon: Settings },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-cream-100/50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 text-cream-100 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-navy-800">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Vixel"
              className="w-9 h-9 rounded-full object-cover"
            />
            <span className="font-serif text-xl font-bold text-white">Vixel</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-cream-100/60 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gold-400 text-navy-900 shadow-lg shadow-gold-400/20'
                    : 'text-cream-100/70 hover:bg-navy-800 hover:text-cream-100'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t border-navy-800 space-y-1">
          <NavLink
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-cream-100/70 hover:bg-navy-800 transition-all"
            >
            <ExternalLink className="w-5 h-5" />
            Lihat Toko
          </NavLink>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gold-300 hover:bg-gold-400/10 transition-all">
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-charcoal-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-charcoal-100 h-16 flex items-center px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-navy-50">
            <Menu className="w-6 h-6 text-charcoal-700" />
          </button>
          <h1 className="font-serif text-lg font-semibold text-charcoal-800 lg:ml-0 ml-2">Dashboard Admin</h1>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
