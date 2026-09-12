import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { trackVisit } from '@/lib/visitorTracking';

import PublicLayout from '@/components/public/PublicLayout';
import HomePage from '@/pages/public/HomePage';
import CatalogPage from '@/pages/public/CatalogPage';
import ProductDetailPage from '@/pages/public/ProductDetailPage';
import AboutPage from '@/pages/public/AboutPage';
import TestimonialsPage from '@/pages/public/TestimonialsPage';
import ContactPage from '@/pages/public/ContactPage';

import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminCategories from '@/pages/admin/AdminCategories';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminRevenue from '@/pages/admin/AdminRevenue';
import AdminTestimonials from '@/pages/admin/AdminTestimonials';
import AdminSettings from '@/pages/admin/AdminSettings';

function PublicRoutes() {
  const { settings } = useStoreSettings();
  const location = useLocation();

  useEffect(() => {
    trackVisit(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage settings={settings} />} />
        <Route path="/katalog" element={<CatalogPage />} />
        <Route path="/katalog/:slug" element={<CatalogPage />} />
        <Route path="/produk/:id" element={<ProductDetailPage settings={settings} />} />
        <Route path="/tentang" element={<AboutPage settings={settings} />} />
        <Route path="/testimoni" element={<TestimonialsPage />} />
        <Route path="/kontak" element={<ContactPage settings={settings} />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/vixel">
        <Routes>
          {/* Public storefront */}
          <Route path="/*" element={<PublicRoutes />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="produk" element={<AdminProducts />} />
            <Route path="kategori" element={<AdminCategories />} />
            <Route path="pesanan" element={<AdminOrders />} />
            <Route path="pendapatan" element={<AdminRevenue />} />
            <Route path="testimoni" element={<AdminTestimonials />} />
            <Route path="pengaturan" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
