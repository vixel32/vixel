import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, CalendarDays, Printer, FileDown, DollarSign, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Order } from '@/lib/types';

type ReportPeriod = 'month' | 'year' | 'all' | 'custom';

export default function AdminRevenue() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const reportOrders = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
    if (period === 'custom' && startDate) start = new Date(`${startDate}T00:00:00`);
    if (period === 'custom' && endDate) end = new Date(`${endDate}T23:59:59`);
    return orders.filter((order) => {
      if (order.status !== 'selesai') return false;
      const createdAt = new Date(order.created_at);
      return (!start || createdAt >= start) && (!end || createdAt <= end);
    });
  }, [orders, period, startDate, endDate]);

  const reportRevenue = reportOrders.reduce((sum, order) => sum + order.product_price * order.quantity, 0);
  const reportCost = reportOrders.reduce((sum, order) => sum + (order.cost_price ?? 0) * order.quantity, 0);
  const reportGrossProfit = reportRevenue - reportCost;

  const reportRows = useMemo(() => {
    const grouped = new Map<string, { date: string; transactions: number; revenue: number; cost: number }>();
    reportOrders.forEach((order) => {
      const date = order.created_at.slice(0, 10);
      const current = grouped.get(date) ?? { date, transactions: 0, revenue: 0, cost: 0 };
      current.transactions += 1;
      current.revenue += order.product_price * order.quantity;
      current.cost += (order.cost_price ?? 0) * order.quantity;
      grouped.set(date, current);
    });
    return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [reportOrders]);

  const periodLabel = period === 'month' ? 'Bulan ini'
    : period === 'year' ? 'Tahun ini'
    : period === 'all' ? 'Semua transaksi'
    : 'Rentang tanggal';

  const printReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const rows = reportRows.map((row) => {
      const profit = row.revenue - row.cost;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e2e5">${formatDate(`${row.date}T00:00:00`)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e2e5;text-align:center">${row.transactions}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e2e5;text-align:right">${formatPrice(row.revenue)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e2e5;text-align:right">${formatPrice(row.cost)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e2e5;text-align:right">${formatPrice(profit)}</td>
      </tr>`;
    }).join('');
    win.document.write(`<!doctype html><html><head><title>Laporan Pendapatan Vixel</title><style>body{font-family:Arial,sans-serif;color:#172f5e;padding:48px;max-width:900px;margin:auto}h1{font-size:28px}h2{color:#a8742f;font-size:13px;letter-spacing:2px}header{border-bottom:2px solid #d4a64e;padding-bottom:20px;margin-bottom:28px}.summary{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}.box{background:#f6f8fc;padding:16px 20px;border-radius:10px;min-width:160px}.box span{font-size:12px;color:#71747e}.box strong{font-size:20px;display:block;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;padding-bottom:12px;border-bottom:2px solid #172f5e;color:#71747e}td{color:#33343b}.total{font-size:22px;font-weight:bold}</style></head><body><header><h1>Laporan Pendapatan</h1><h2>VIXEL · ${periodLabel.toUpperCase()}</h2></header><div class="summary"><div class="box"><span>Total Pendapatan</span><strong>${formatPrice(reportRevenue)}</strong></div><div class="box"><span>Total Modal</span><strong>${formatPrice(reportCost)}</strong></div><div class="box"><span>Keuntungan Kotor</span><strong>${formatPrice(reportGrossProfit)}</strong></div><div class="box"><span>Total Transaksi</span><strong>${reportOrders.length}</strong></div></div><table><thead><tr><th>Tanggal</th><th style="text-align:center">Transaksi</th><th style="text-align:right">Pendapatan</th><th style="text-align:right">Modal</th><th style="text-align:right">Keuntungan</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">Kelola Pendapatan</h2>
          <p className="text-charcoal-400 text-sm mt-1">Laporan pendapatan dari transaksi yang sudah selesai.</p>
        </div>
        <button onClick={printReport} disabled={reportRows.length === 0} className="btn-outline text-sm">
          <Printer className="w-4 h-4" /> Cetak Laporan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-navy-600" />
            </div>
            <div>
              <p className="text-xs text-charcoal-400">Total Pendapatan</p>
              <p className="font-bold text-navy-800 text-lg">{formatPrice(reportRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-charcoal-500" />
            </div>
            <div>
              <p className="text-xs text-charcoal-400">Total Modal</p>
              <p className="font-bold text-charcoal-700 text-lg">{formatPrice(reportCost)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-charcoal-400">Keuntungan Kotor</p>
              <p className="font-bold text-green-600 text-lg">{formatPrice(reportGrossProfit)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-gold-600" />
            </div>
            <div>
              <p className="text-xs text-charcoal-400">Total Transaksi</p>
              <p className="font-bold text-charcoal-700 text-lg">{reportOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="font-serif text-xl font-semibold text-charcoal-800">Ringkasan</h3>
            <p className="text-sm text-charcoal-400 mt-1">Periode: {periodLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="input">
            <option value="month">Bulan ini</option>
            <option value="year">Tahun ini</option>
            <option value="all">Semua transaksi</option>
            <option value="custom">Rentang tanggal</option>
          </select>
          {period === 'custom' && <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" aria-label="Tanggal mulai" />}
          {period === 'custom' && <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" aria-label="Tanggal akhir" />}
        </div>

        {reportRows.length === 0 ? (
          <p className="text-sm text-charcoal-400 text-center py-8">Belum ada pendapatan pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-100 text-left text-charcoal-400">
                  <th className="pb-3 font-medium">Tanggal</th>
                  <th className="pb-3 font-medium text-center">Transaksi</th>
                  <th className="pb-3 font-medium text-right">Pendapatan</th>
                  <th className="pb-3 font-medium text-right">Modal</th>
                  <th className="pb-3 font-medium text-right">Keuntungan</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => {
                  const profit = row.revenue - row.cost;
                  return (
                    <tr key={row.date} className="border-b border-charcoal-100/70">
                      <td className="py-3 text-charcoal-700">{formatDate(`${row.date}T00:00:00`)}</td>
                      <td className="py-3 text-charcoal-600 text-center">{row.transactions}</td>
                      <td className="py-3 text-right font-semibold text-navy-700">{formatPrice(row.revenue)}</td>
                      <td className="py-3 text-right text-charcoal-500">{formatPrice(row.cost)}</td>
                      <td className="py-3 text-right font-semibold text-green-600">{formatPrice(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-charcoal-200">
                  <td className="py-3 font-semibold text-charcoal-800" colSpan={2}>Total</td>
                  <td className="py-3 text-right font-bold text-navy-800">{formatPrice(reportRevenue)}</td>
                  <td className="py-3 text-right font-bold text-charcoal-600">{formatPrice(reportCost)}</td>
                  <td className="py-3 text-right font-bold text-green-600">{formatPrice(reportGrossProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-lg font-semibold text-charcoal-800 mb-4">Rincian Transaksi</h3>
        {reportOrders.length === 0 ? (
          <p className="text-sm text-charcoal-400 text-center py-8">Belum ada transaksi selesai pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-100 text-left text-charcoal-400">
                  <th className="pb-3 font-medium">Tanggal</th>
                  <th className="pb-3 font-medium">Pelanggan</th>
                  <th className="pb-3 font-medium">Produk</th>
                  <th className="pb-3 font-medium text-center">Qty</th>
                  <th className="pb-3 font-medium text-right">Pendapatan</th>
                  <th className="pb-3 font-medium text-right">Keuntungan</th>
                </tr>
              </thead>
              <tbody>
                {reportOrders.map((order) => {
                  const revenue = order.product_price * order.quantity;
                  const cost = (order.cost_price ?? 0) * order.quantity;
                  const profit = revenue - cost;
                  return (
                    <tr key={order.id} className="border-b border-charcoal-100/70">
                      <td className="py-3 text-charcoal-700 whitespace-nowrap">{formatDate(order.created_at)}</td>
                      <td className="py-3 text-charcoal-600">{order.customer_name}</td>
                      <td className="py-3 text-charcoal-600">{order.product_name}</td>
                      <td className="py-3 text-charcoal-600 text-center">{order.quantity}</td>
                      <td className="py-3 text-right font-semibold text-navy-700">{formatPrice(revenue)}</td>
                      <td className="py-3 text-right font-semibold text-green-600">{formatPrice(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
