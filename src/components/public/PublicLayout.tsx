import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { buildWhatsAppUrl } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Beranda' },
  { to: '/katalog', label: 'Katalog' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/testimoni', label: 'Testimoni' },
  { to: '/kontak', label: 'Kontak' },
];

export default function PublicLayout() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useStoreSettings();
  const wa = settings?.whatsapp_number ?? '082218730419';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isHome = location.pathname === '/';
  const solid = scrolled || !isHome;

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          solid
            ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-charcoal-100'
            : 'bg-transparent'
        }`}
      >
        <div className="container-page flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/assets/images/ChatGPT_Image_23_Jun_2026,_11.14.58.png"
              alt="Vixel"
              className="w-9 h-9 rounded-full object-cover"
            />
            <span className={`font-serif text-xl font-bold transition-colors ${
              solid ? 'text-navy-900' : 'text-white'
            }`}>
              Vixel
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = link.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? (solid ? 'bg-navy-50 text-navy-700' : 'bg-white/15 text-white')
                      : (solid ? 'text-charcoal-600 hover:bg-navy-50' : 'text-white/80 hover:bg-white/10')
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi.')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa text-sm px-4 py-2"
            >
              <MessageCircle className="w-4 h-4" />
              Konsultasi
            </a>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
              solid ? 'text-charcoal-700 hover:bg-navy-50' : 'text-white hover:bg-white/10'
            }`}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-charcoal-100 shadow-lg">
            <nav className="container-page py-4 space-y-1">
              {navLinks.map((link) => {
                const active = link.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-navy-50 text-navy-700' : 'text-charcoal-600 hover:bg-cream-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <a
                href={buildWhatsAppUrl(wa, 'Halo Vixel, saya ingin berkonsultasi.')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa w-full mt-2"
              >
                <MessageCircle className="w-4 h-4" />
                Konsultasi
              </a>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 pt-16">
        <Outlet />
      </main>

      <footer className="bg-navy-900 text-cream-100/80">
        <div className="container-page py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <img
                  src="/assets/images/ChatGPT_Image_23_Jun_2026,_11.14.58.png"
                  alt="Vixel"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <span className="font-serif text-xl font-bold text-white">Vixel</span>
              </div>
              <p className="text-sm text-cream-100/60 leading-relaxed">
                Undangan digital, undangan cetak, buket, dan jasa seserahan untuk momen spesialmu.
              </p>
            </div>

            <div>
              <h4 className="font-serif text-sm font-semibold text-white mb-4">Tautan</h4>
              <ul className="space-y-2 text-sm">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-cream-100/60 hover:text-gold-300 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-serif text-sm font-semibold text-white mb-4">Kontak</h4>
              <ul className="space-y-2 text-sm text-cream-100/60">
                <li>WhatsApp: {wa}</li>
                {settings?.email && <li>Email: {settings.email}</li>}
                {settings?.address && <li>Alamat: {settings.address}</li>}
                {settings?.instagram && (
                  <li>
                    <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300 transition-colors">
                      Instagram
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t border-navy-800 mt-8 pt-6 text-center text-xs text-cream-100/40">
            &copy; {new Date().getFullYear()} Vixel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
