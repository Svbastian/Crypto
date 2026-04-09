import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target, Zap, ShieldCheck, ListOrdered, BarChart3, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BtcCrashDashboard({ liveData = null, isLive = false }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [range, setRange] = useState('all');

  const filterByRange = (arr) => {
    if (range === 'all') return arr;
    const days = range === '30d' ? 30 : 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return arr.filter(item => (item.date || '') >= cutoffStr);
  };

  const xInterval = range === '7d' ? 1 : range === '30d' ? 4 : 20;
  const xFmt = v => { const [,m,d] = v.split('-'); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${mon[+m-1]} ${+d}`; };

  const RangeToggle = () => (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {[['All time','all'],['30d','30d'],['7d','7d']].map(([label, val]) => (
        <button key={val} onClick={() => setRange(val)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${range === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );

  // Tier system — must match crash_bot.py TIERS exactly
  const TIERS = [
    { label: 'Tier 1 (-7%)',  threshold: -7,  units: 1,   color: '#f59e0b' },
    { label: 'Tier 2 (-10%)', threshold: -10, units: 2,   color: '#f97316' },
    { label: 'Tier 3 (-15%)', threshold: -15, units: 3,   color: '#ef4444' },
    { label: 'Tier 4 (-20%)', threshold: -20, units: 4.5, color: '#991b1b' },
  ];
  const USDT_PER_UNIT = 25;

  const tierColors = {
    'Tier 1 (-7%)':  '#f59e0b',
    'Tier 2 (-10%)': '#f97316',
    'Tier 3 (-15%)': '#ef4444',
    'Tier 4 (-20%)': '#991b1b',
  };

  // True when the user has switched to Live AND the API responded
  const showLive = isLive && !!liveData;

  const liveStats = useMemo(() => {
    if (!liveData?.crashBuys?.length) return null;
    const buys = liveData.crashBuys.map(e => ({
      date:      (e.timestamp || '').slice(0, 10),
      price:     e.price,
      usdtSpent: e.usdt_spent,
      btcBought: e.btc_bought,
      dipPct:    e.dip_pct || 0,
      tier:      e.tier || 'Crash buy',
      units:     e.units_requested || 1,
    }));
    const totalInvested = buys.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = buys.reduce((s, e) => s + e.btcBought, 0);
    const currentPrice  = liveData.btcPrice || 0;
    const avgBuyPrice   = totalBtc > 0 ? totalInvested / totalBtc : 0;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const tierCounts    = { 'Tier 1 (-7%)': 0, 'Tier 2 (-10%)': 0, 'Tier 3 (-15%)': 0, 'Tier 4 (-20%)': 0 };
    buys.forEach(e => { if (tierCounts[e.tier] !== undefined) tierCounts[e.tier]++; });
    const latestBuy = buys[buys.length - 1];
    return { buys, totalInvested, totalBtc, avgBuyPrice, positionValue, pnl, pnlPct, tierCounts, currentPrice, latestBuy };
  }, [liveData]);

  // Empty stats shown in live mode when no buys have happened yet
  const emptyLiveStats = {
    totalInvested: 0,
    totalBtc:      0,
    avgBuyPrice:   0,
    positionValue: 0,
    pnl:           0,
    pnlPct:        0,
    tierCounts:    { 'Tier 1 (-7%)': 0, 'Tier 2 (-10%)': 0, 'Tier 3 (-15%)': 0, 'Tier 4 (-20%)': 0 },
  };

  // Mock price series for demo mode only
  const priceSeries = [
    { date: '2022-01-03', btcPrice: 46200,  ma30: 49100 },
    { date: '2022-02-07', btcPrice: 41800,  ma30: 44600 },
    { date: '2022-03-07', btcPrice: 38900,  ma30: 42100 },
    { date: '2022-04-04', btcPrice: 43900,  ma30: 42800 },
    { date: '2022-05-02', btcPrice: 38600,  ma30: 42200 },
    { date: '2022-05-16', btcPrice: 29200,  ma30: 38900 },
    { date: '2022-06-06', btcPrice: 25700,  ma30: 34100 },
    { date: '2022-06-20', btcPrice: 20100,  ma30: 29800 },
    { date: '2022-07-18', btcPrice: 21300,  ma30: 22400 },
    { date: '2022-08-15', btcPrice: 23900,  ma30: 22100 },
    { date: '2022-09-12', btcPrice: 21600,  ma30: 22900 },
    { date: '2022-10-10', btcPrice: 19200,  ma30: 20800 },
    { date: '2022-11-07', btcPrice: 20400,  ma30: 20200 },
    { date: '2022-11-14', btcPrice: 16600,  ma30: 19800 },
    { date: '2022-12-12', btcPrice: 17200,  ma30: 18100 },
    { date: '2023-01-09', btcPrice: 17400,  ma30: 17100 },
    { date: '2023-02-06', btcPrice: 22700,  ma30: 20100 },
    { date: '2023-03-13', btcPrice: 24800,  ma30: 22900 },
    { date: '2023-04-10', btcPrice: 28200,  ma30: 26400 },
    { date: '2023-05-08', btcPrice: 27500,  ma30: 28100 },
    { date: '2023-06-05', btcPrice: 26800,  ma30: 27200 },
    { date: '2023-08-17', btcPrice: 26300,  ma30: 29100 },
    { date: '2023-09-11', btcPrice: 25700,  ma30: 27400 },
    { date: '2023-10-16', btcPrice: 27900,  ma30: 26800 },
    { date: '2023-11-13', btcPrice: 36700,  ma30: 31200 },
    { date: '2023-12-11', btcPrice: 41800,  ma30: 37600 },
    { date: '2024-01-08', btcPrice: 43900,  ma30: 42100 },
    { date: '2024-02-12', btcPrice: 49200,  ma30: 45800 },
    { date: '2024-03-11', btcPrice: 68400,  ma30: 58200 },
    { date: '2024-03-18', btcPrice: 62800,  ma30: 62100 },
    { date: '2024-04-15', btcPrice: 63700,  ma30: 65900 },
    { date: '2024-05-13', btcPrice: 61200,  ma30: 63400 },
    { date: '2024-07-01', btcPrice: 62900,  ma30: 64800 },
    { date: '2024-08-05', btcPrice: 53700,  ma30: 62100 },
    { date: '2024-09-09', btcPrice: 57400,  ma30: 58900 },
    { date: '2024-11-04', btcPrice: 73900,  ma30: 67200 },
    { date: '2024-12-16', btcPrice: 97800,  ma30: 84600 },
    { date: '2025-01-20', btcPrice: 103400, ma30: 97200 },
    { date: '2025-02-24', btcPrice: 84500,  ma30: 95800 },
    { date: '2025-03-03', btcPrice: 86200,  ma30: 93100 },
    { date: '2025-03-17', btcPrice: 82900,  ma30: 90400 },
    { date: '2026-03-28', btcPrice: 87400,  ma30: 88200 },
  ];

  // Mock crash buy events — demo mode only
  const buyEvents = [
    { date: '2022-05-12', price: 28600,  dipPct: -13.2, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2022-05-19', price: 28900,  dipPct: -11.8, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2022-06-13', price: 22500,  dipPct: -21.4, tier: 'Tier 4 (-20%)', units: 4.5, usdtSpent: 112.50 },
    { date: '2022-06-18', price: 19400,  dipPct: -16.9, tier: 'Tier 3 (-15%)', units: 3,   usdtSpent: 75.00  },
    { date: '2022-09-13', price: 20300,  dipPct: -10.6, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2022-11-09', price: 15900,  dipPct: -22.1, tier: 'Tier 4 (-20%)', units: 4.5, usdtSpent: 112.50 },
    { date: '2023-03-03', price: 22100,  dipPct: -10.9, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2023-04-26', price: 27900,  dipPct: -11.4, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2023-08-17', price: 26300,  dipPct: -10.2, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2024-03-19', price: 61900,  dipPct: -10.5, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2024-08-05', price: 53700,  dipPct: -17.3, tier: 'Tier 3 (-15%)', units: 3,   usdtSpent: 75.00  },
    { date: '2025-02-26', price: 82400,  dipPct: -10.8, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2025-03-03', price: 86100,  dipPct: -12.6, tier: 'Tier 2 (-10%)', units: 2,   usdtSpent: 50.00  },
    { date: '2026-02-05', price: 62700,  dipPct: -14.3, tier: 'Tier 3 (-15%)', units: 3,   usdtSpent: 75.00  },
  ];

  const simulation = useMemo(() => {
    const enriched = buyEvents.map(e => ({ ...e, btcBought: e.usdtSpent / e.price }));
    const totalInvested = enriched.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = enriched.reduce((s, e) => s + e.btcBought, 0);
    const avgBuyPrice   = totalInvested / totalBtc;
    const currentPrice  = priceSeries[priceSeries.length - 1].btcPrice;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = (pnl / totalInvested) * 100;
    const tierCounts    = { 'Tier 1 (-7%)': 0, 'Tier 2 (-10%)': 0, 'Tier 3 (-15%)': 0, 'Tier 4 (-20%)': 0 };
    enriched.forEach(e => { if (tierCounts[e.tier] !== undefined) tierCounts[e.tier]++; });
    const buyDateSet = new Set(enriched.map(e => e.date));
    const chartData = priceSeries.map(p => ({
      ...p,
      crashBuyMarker: buyDateSet.has(p.date) ? p.btcPrice : null,
    }));
    const latestBuy = enriched[enriched.length - 1];
    return { enriched, totalInvested, totalBtc, avgBuyPrice, currentPrice, positionValue, pnl, pnlPct, tierCounts, chartData, latestBuy };
  }, []);

  const formatUsd = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
  const formatBtc = v => `${v.toFixed(6)} BTC`;

  const formatCooldown = (lastBuyAt) => {
    if (!lastBuyAt) return null;
    const elapsedHours = (Date.now() - new Date(lastBuyAt)) / 3_600_000;
    const remaining = 48 - elapsedHours;
    if (remaining <= 0) return null;
    const h = Math.floor(remaining);
    const m = Math.round((remaining - h) * 60);
    return `${h}h ${m}m remaining`;
  };

  // Data sources — live always uses real data (or zeros), never falls back to mock
  const s            = showLive ? (liveStats || emptyLiveStats) : simulation;
  const chartData    = showLive ? (liveData.chartData || []) : simulation.chartData;
  const buyLog       = showLive ? (liveStats?.buys || []) : simulation.enriched;
  const buysCount    = showLive ? (liveStats?.buys?.length ?? 0) : simulation.enriched.length;
  const currentPrice = showLive ? (liveData.btcPrice || 0) : simulation.currentPrice;
  const lb           = showLive ? liveStats?.latestBuy : simulation.latestBuy;
  const cooldown     = showLive ? formatCooldown(liveData?.crashState?.last_buy_at) : null;

  const StatCard = ({ title, value, subtitle, icon: Icon, valueClassName = 'text-slate-900' }) => (
    <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className="rounded-xl bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  );

  const TabButton = ({ id, label, icon: Icon }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${active ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'}`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">BTC Crash Bot Dashboard</h1>
            <p className="mt-1 text-slate-600">
              {showLive
                ? 'Live data from your Crash bot — real buys, real dip triggers, real performance.'
                : 'Buys on dips ≥7% from the 7-day high, only when price is below the 30-day MA. Tier size scales with dip depth. 48h cooldown after each buy.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full px-3 py-1 text-sm">{buysCount} crash buys</Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm">
              Current BTC: {formatUsd(currentPrice)}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3">
          <TabButton id="overview" label="Overview" icon={BarChart3} />
          <TabButton id="log"      label="Buy Log"  icon={ListOrdered} />
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Average Buy Price" value={s.avgBuyPrice > 0 ? formatUsd(s.avgBuyPrice) : '—'} subtitle="weighted average across all crash buys" icon={Target} />
              <StatCard title="Profit / Loss" value={s.totalInvested > 0 ? formatUsd(s.pnl) : '—'} valueClassName={s.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'} subtitle={s.totalInvested > 0 ? `${s.pnlPct >= 0 ? '+' : ''}${s.pnlPct.toFixed(2)}% vs invested capital` : 'No buys yet'} icon={s.pnl >= 0 ? TrendingUp : TrendingDown} />
              <StatCard title="Position Value" value={s.totalBtc > 0 ? formatUsd(s.positionValue) : '—'} subtitle="market value of crash bot BTC holdings" icon={Wallet} />
              <StatCard title="BTC Accumulated" value={s.totalBtc > 0 ? formatBtc(s.totalBtc) : '—'} subtitle={s.totalInvested > 0 ? formatUsd(s.totalInvested) + ' total invested' : 'No buys yet'} icon={Bitcoin} />
            </div>

            {/* Chart + sidebar */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-lg shadow-black/5 xl:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">BTC Price vs MA30 with Buy Events</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        Orange = BTC price. Purple = MA30 (buy filter). Dots mark crash bot buy events.
                      </p>
                    </div>
                    <RangeToggle />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={filterByRange(chartData)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={xFmt} interval={xInterval} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} domain={['dataMin - 3000', 'dataMax + 3000']} />
                          <Tooltip
                            formatter={(value, name) => [
                              formatUsd(Number(value)),
                              name === 'btcPrice' ? 'BTC Price' : name === 'ma30' ? 'MA30' : 'Crash Buy'
                            ]}
                            labelFormatter={l => `Date: ${l}`}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="btcPrice"       name="BTC Price"  stroke="#f97316" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="ma30"           name="MA30"       stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                          <Line type="monotone" dataKey="crashBuyMarker" name="Crash Buy"  stroke="#10b981" strokeWidth={0} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400 text-sm">No chart data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {/* Latest buy */}
                <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Latest Buy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    {lb ? (<>
                      <div className="flex justify-between"><span>Date</span>  <span className="font-medium">{lb.date}</span></div>
                      <div className="flex justify-between"><span>Tier</span>  <span className="font-medium" style={{ color: tierColors[lb.tier] ?? '#64748b' }}>{lb.tier}</span></div>
                      <div className="flex justify-between"><span>Dip</span>   <span className="font-medium text-red-500">{lb.dipPct.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span>Price</span> <span className="font-medium">{formatUsd(lb.price)}</span></div>
                      <div className="flex justify-between"><span>Spent</span> <span className="font-medium">{formatUsd(lb.usdtSpent)}</span></div>
                      <div className="flex justify-between"><span>BTC</span>   <span className="font-medium">{formatBtc(lb.btcBought ?? lb.usdtSpent / lb.price)}</span></div>
                    </>) : (
                      <p className="text-slate-400 text-sm">No crash buys yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Tier breakdown */}
                <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Tier Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {TIERS.map(t => (
                      <div key={t.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-slate-700">{t.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{s.tierCounts[t.label]}×</span>
                          <span className="font-medium text-slate-900">{formatUsd(s.tierCounts[t.label] * t.units * USDT_PER_UNIT)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 pt-2 flex justify-between font-medium text-slate-900">
                      <span>Total</span>
                      <span>{formatUsd(s.totalInvested)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Live: Bot Status — Demo: Bot Rules */}
                {showLive ? (
                  <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                    <CardHeader>
                      <CardTitle className="text-lg">Bot Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <span>Total Buys</span>
                        <span className="font-medium">{buysCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Buy</span>
                        <span className="font-medium">{liveData?.crashState?.last_buy_at ? liveData.crashState.last_buy_at.slice(0, 10) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>48h Cooldown</span>
                        <span className={`font-medium flex items-center gap-1 ${cooldown ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {cooldown ? (<><Clock className="h-3 w-3" />{cooldown}</>) : 'Ready'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>MA30 Filter</span>
                        <span className="font-medium text-violet-600">Active</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                    <CardHeader>
                      <CardTitle className="text-lg">Bot Rules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-violet-500 shrink-0" /><span>Only buys if price is below MA30 — prevents bull run purchases.</span></div>
                      <div className="flex items-start gap-2"><Zap className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" /><span>Triggers on dips ≥7% from the 7-day high.</span></div>
                      <div className="flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" /><span>Deeper dip = larger buy: 1× at -7%, 2× at -10%, 3× at -15%, 4.5× at -20%.</span></div>
                      <div className="flex items-start gap-2"><TrendingDown className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" /><span>48h cooldown after every buy.</span></div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'log' && (
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Buy Log</CardTitle>
              <p className="text-sm text-slate-500">All crash bot purchases with tier, dip %, price, and BTC received.</p>
            </CardHeader>
            <CardContent>
              {buyLog.length === 0 ? (
                <p className="py-8 text-center text-slate-400 text-sm">No crash buys recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Tier</th>
                        <th className="px-4 py-3 font-medium">Dip %</th>
                        <th className="px-4 py-3 font-medium">Multiplier</th>
                        <th className="px-4 py-3 font-medium">BTC Price</th>
                        <th className="px-4 py-3 font-medium">USDT Spent</th>
                        <th className="px-4 py-3 font-medium">BTC Bought</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyLog.map((buy, i) => (
                        <tr key={buy.date + i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 text-slate-700">{buy.date}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: (tierColors[buy.tier] ?? '#64748b') + '20', color: tierColors[buy.tier] ?? '#64748b' }}>
                              {buy.tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-red-500">{buy.dipPct.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-slate-700">{buy.units}×</td>
                          <td className="px-4 py-3 text-slate-700">{formatUsd(buy.price)}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{formatUsd(buy.usdtSpent)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatBtc(buy.btcBought ?? buy.usdtSpent / buy.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
