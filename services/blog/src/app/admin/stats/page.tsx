'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total: number;
  today: number;
  dailyVisitors: { date: string; count: number }[];
  topPages: { path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topUserAgents: { userAgent: string; count: number }[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500">Failed to load stats</div>
      </div>
    );
  }

  const maxDaily = Math.max(...stats.dailyVisitors.map((d) => d.count), 1);
  const maxPage = Math.max(...stats.topPages.map((d) => d.count), 1);
  const maxReferrer = Math.max(...stats.topReferrers.map((d) => d.count), 1);
  const maxUA = Math.max(...stats.topUserAgents.map((d) => d.count), 1);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Site Stats
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        방문자 통계
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Total Visitors
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.total.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Today
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.today.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Daily Visitors Chart */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6 mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Daily Visitors (Last 30 Days)
        </h2>
        {stats.dailyVisitors.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {stats.dailyVisitors.map((d) => (
              <div
                key={d.date}
                className="flex-1 group relative"
                title={`${d.date}: ${d.count}`}
              >
                <div
                  className="bg-indigo-500/80 dark:bg-indigo-400/80 rounded-t transition-all hover:bg-indigo-600 dark:hover:bg-indigo-300"
                  style={{
                    height: `${(d.count / maxDaily) * 100}%`,
                    minHeight: d.count > 0 ? '4px' : '0px',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top Referrers */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6 mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Top Referrers
        </h2>
        {stats.topReferrers.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet</p>
        ) : (
          <div className="space-y-3">
            {stats.topReferrers.map((r, i) => (
              <div key={r.referrer}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">
                      {i + 1}
                    </span>
                    <span className="truncate max-w-md">{r.referrer}</span>
                  </span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {r.count}
                  </span>
                </div>
                <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
                    style={{ width: `${(r.count / maxReferrer) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top Pages */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6 mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Top Pages
        </h2>
        {stats.topPages.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet</p>
        ) : (
          <div className="space-y-3">
            {stats.topPages.map((p, i) => (
              <div key={p.path}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">
                      {i + 1}
                    </span>
                    <span className="font-mono text-xs">{p.path}</span>
                  </span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {p.count}
                  </span>
                </div>
                <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full"
                    style={{ width: `${(p.count / maxPage) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top User Agents */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 p-6 mb-8">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Top User Agents
        </h2>
        {stats.topUserAgents.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet</p>
        ) : (
          <div className="space-y-3">
            {stats.topUserAgents.map((u, i) => (
              <div key={u.userAgent}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">
                      {i + 1}
                    </span>
                    <span className="truncate max-w-lg text-xs font-mono">
                      {u.userAgent}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {u.count}
                  </span>
                </div>
                <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full"
                    style={{ width: `${(u.count / maxUA) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
