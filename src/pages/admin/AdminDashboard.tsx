import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Order } from '@/lib/types';
import VisitorStatsChart from '@/components/admin/VisitorStatsChart';

interface Stats {
  newOrders: number;
  totalProducts: number;
  thisMonthOrders: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ newOrders: 0, totalProducts: 0, thisMonthOrders: 0, totalRevenue: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [ordersRes, productsRes, recentRes] = await Promise.all([
        supabase.from('orders').select('id, status, product_price, quantity, created_at'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const allOrders = ordersRes.data ?? [];
      const newOrders = allOrders.filter((o) => o.status === 'baru').length;
      const thisMonth = allOrders.filter((o) => new Date(o.created_at) >= new Date(monthStart)).length;
      const revenue = allOrders
        .filter((o) => o.status === 'selesai')
        .reduce((sum, o) => sum + (o.product_price * o.quantity), 0);

      setStats({
        newOrders,
        totalProducts: productsRes.count ?? 0,
        thisMonthOrders: thisMonth,
        totalRevenue: revenue,
      });
      setRecentOrders((recentRes.data as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Pesanan Baru', value: stats.newOrders, icon: ShoppingCart, color: 'bg-navy-600' },
    { label: 'Total Produk', value: stats.totalProducts, icon: Package, color: 'bg-gold-500' },
    { label: 'Pesanan Bulan Ini', value: stats.thisMonthOrders, icon: Clock, color: 'bg-navy-500' },
    { label: 'Total Pendapatan', value: formatPrice(stats.totalRevenue), icon: TrendingUp, color: 'bg-gold-600' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-charcoal-800">Selamat Datang</h2>
        <p className="text-charcoal-400 text-sm mt-1">Ringkasan toko Vixel Anda</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-charcoal-800">{card.value}</p>
            <p className="text-sm text-charcoal-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <VisitorStatsChart />

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold text-charcoal-800">Pesanan Terbaru</h3>
          <Link to="/admin/pesanan" className="text-sm text-navy-600 hover:underline inline-flex items-center gap-1">
            Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-charcoal-400 text-center py-8">Belum ada pesanan masuk.</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-cream-100/50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-charcoal-800 text-sm truncate">{order.product_name}</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">
                    {order.customer_name} - {formatDate(order.created_at)}
                  </p>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ml-3 ${
                  order.status === 'baru' ? 'bg-blue-100 text-blue-700' :
                  order.status === 'diproses' ? 'bg-gold-100 text-gold-700' :
                  order.status === 'selesai' ? 'bg-green-100 text-green-700' :
                  'bg-navy-100 text-navy-700'
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
