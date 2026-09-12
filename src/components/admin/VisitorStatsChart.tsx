import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Eye, MousePointerClick, Calendar } from 'lucide-react';

type FilterRange = 'hari' | 'minggu' | 'bulan' | 'tahun';

interface VisitRow {
  visited_at: string;
  session_id: string;
  page_path: string;
}

interface ChartBucket {
  label: string;
  visits: number;
  unique: number;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function fmtShort(d: Date, range: FilterRange): string {
  if (range === 'hari') {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === 'minggu' || range === 'bulan') {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('id-ID', { month: 'short' });
}

function buildBuckets(range: FilterRange, now: Date): { start: Date; buckets: ChartBucket[] } {
  const buckets: ChartBucket[] = [];
  let start: Date;

  if (range === 'hari') {
    start = startOfDay(now);
    for (let i = 0; i < 24; i++) {
      const bStart = new Date(start);
      bStart.setHours(i, 0, 0, 0);
      buckets.push({ label: bStart.toLocaleTimeString('id-ID', { hour: '2-digit' }), visits: 0, unique: 0 });
    }
  } else if (range === 'minggu') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start = startOfDay(start);
    for (let i = 0; i < 7; i++) {
      const bStart = new Date(start);
      bStart.setDate(bStart.getDate() + i);
      buckets.push({ label: bStart.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }), visits: 0, unique: 0 });
    }
  } else if (range === 'bulan') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 0; i < daysInMonth; i++) {
      const bStart = new Date(start);
      bStart.setDate(bStart.getDate() + i);
      buckets.push({ label: String(i + 1), visits: 0, unique: 0 });
    }
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    for (let i = 0; i < 12; i++) {
      const bStart = new Date(now.getFullYear(), i, 1);
      buckets.push({ label: bStart.toLocaleDateString('id-ID', { month: 'short' }), visits: 0, unique: 0 });
    }
  }

  return { start, buckets };
}

function assignToBuckets(rows: VisitRow[], range: FilterRange, now: Date, buckets: ChartBucket[]): ChartBucket[] {
  const start = buckets[0] ? getBucketStart(range, now, 0) : new Date(0);

  for (const row of rows) {
    const d = new Date(row.visited_at);
    let idx = -1;

    if (range === 'hari') {
      idx = d.getHours();
    } else if (range === 'minggu') {
      const diff = Math.floor((startOfDay(d).getTime() - startOfDay(new Date(buckets[0] ? getBucketStart(range, now, 0) : new Date())).getTime()) / 86400000);
      idx = diff;
    } else if (range === 'bulan') {
      idx = d.getDate() - 1;
    } else {
      idx = d.getMonth();
    }

    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].visits += 1;
    }
  }

  // unique visitors per bucket
  const bucketSessions: Set<string>[] = buckets.map(() => new Set());
  for (const row of rows) {
    const d = new Date(row.visited_at);
    let idx = -1;
    if (range === 'hari') idx = d.getHours();
    else if (range === 'minggu') {
      const refStart = startOfDay(getBucketStart(range, now, 0));
      idx = Math.floor((startOfDay(d).getTime() - refStart.getTime()) / 86400000);
    } else if (range === 'bulan') idx = d.getDate() - 1;
    else idx = d.getMonth();

    if (idx >= 0 && idx < buckets.length) {
      bucketSessions[idx].add(row.session_id);
    }
  }
  buckets.forEach((b, i) => { b.unique = bucketSessions[i].size; });

  return buckets;
}

function getBucketStart(range: FilterRange, now: Date, idx: number): Date {
  if (range === 'hari') {
    const d = startOfDay(now);
    d.setHours(idx, 0, 0, 0);
    return d;
  }
  if (range === 'minggu') {
    const d0 = new Date(now);
    d0.setDate(d0.getDate() - 6);
    const d1 = startOfDay(d0);
    d1.setDate(d1.getDate() + idx);
    return d1;
  }
  if (range === 'bulan') {
    return new Date(now.getFullYear(), now.getMonth(), idx + 1);
  }
  return new Date(now.getFullYear(), idx, 1);
}

export default function VisitorStatsChart() {
  const [range, setRange] = useState<FilterRange>('minggu');
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      let startDate: Date;
      if (range === 'hari') startDate = startOfDay(now);
      else if (range === 'minggu') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate = startOfDay(startDate);
      } else if (range === 'bulan') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const { data, error } = await supabase
        .from('visit_logs')
        .select('visited_at, session_id, page_path')
        .gte('visited_at', startDate.toISOString())
        .order('visited_at', { ascending: true });

      if (error) {
        setLoading(false);
        return;
      }
      setRows((data as VisitRow[]) ?? []);
      setLoading(false);
    })();
  }, [range]);

  const buckets = useMemo(() => {
    const now = new Date();
    const { buckets: empty } = buildBuckets(range, now);
    return assignToBuckets(rows, range, now, empty);
  }, [rows, range]);

  const totalVisits = buckets.reduce((s, b) => s + b.visits, 0);
  const totalUnique = new Set(rows.map((r) => r.session_id)).size;
  const totalPageViews = rows.length;
  const maxVisits = Math.max(...buckets.map((b) => b.visits), 1);

  const filters: { key: FilterRange; label: string }[] = [
    { key: 'hari', label: 'Hari' },
    { key: 'minggu', label: 'Minggu' },
    { key: 'bulan', label: 'Bulan' },
    { key: 'tahun', label: 'Tahun' },
  ];

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-navy-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">Statistik Pengunjung</h3>
            <p className="text-xs text-charcoal-400">Laporan kunjungan website</p>
          </div>
        </div>
        <div className="flex bg-cream-100 rounded-xl p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setRange(f.key); setLoading(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                range === f.key
                  ? 'bg-white text-navy-700 shadow-sm'
                  : 'text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-cream-50 rounded-xl p-3 text-center">
          <Eye className="w-4 h-4 text-navy-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-charcoal-800">{totalPageViews}</p>
          <p className="text-[11px] text-charcoal-400">Total Kunjungan</p>
        </div>
        <div className="bg-cream-50 rounded-xl p-3 text-center">
          <Users className="w-4 h-4 text-gold-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-charcoal-800">{totalUnique}</p>
          <p className="text-[11px] text-charcoal-400">Pengunjung Unik</p>
        </div>
        <div className="bg-cream-50 rounded-xl p-3 text-center">
          <MousePointerClick className="w-4 h-4 text-navy-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-charcoal-800">{totalVisits}</p>
          <p className="text-[11px] text-charcoal-400">View Periode</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-1 sm:gap-2 h-44 sm:h-52">
            {buckets.map((b, i) => {
              const h = b.visits > 0 ? Math.max((b.visits / maxVisits) * 100, 4) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end group relative min-w-0">
                  <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-charcoal-800 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                    {b.visits} kunjungan
                  </div>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-navy-400 to-navy-600 hover:from-gold-400 hover:to-gold-500 transition-all"
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 sm:gap-2 mt-2">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 text-center min-w-0">
                <span className="text-[9px] sm:text-[10px] text-charcoal-400 truncate block">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-charcoal-100">
        <Calendar className="w-3.5 h-3.5 text-charcoal-400" />
        <p className="text-[11px] text-charcoal-400">
          Data kunjungan {range === 'hari' ? 'per jam hari ini' : range === 'minggu' ? '7 hari terakhir' : range === 'bulan' ? 'bulan ini' : '12 bulan terakhir'}
        </p>
      </div>
    </div>
  );
}
