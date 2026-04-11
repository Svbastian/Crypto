import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target, CalendarClock, Layers, Repeat, ListOrdered, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { hybridWeekly, hybridMaBuys, hybridRetainedFinal } from './data/hybridBacktest';

export default function BtcDcaDashboard({ liveData = null, isLive = false }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [range, setRange] = useState('all');

  const filterByRange = (arr) => {
    if (range === 'all') return arr;
    const days = range === '30d' ? 30 : range === '1y' ? 365 : 730;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return arr.filter(item => (item.date || '') >= cutoffStr);
  };

  const xInterval = range === '30d' ? 1 : range === '1y' ? 7 : range === '2y' ? 13 : 25;
  const xFmt = v => {
    const [y, m, d] = v.split('-');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return range === '30d' ? `${mon[+m-1]} ${+d}` : `${mon[+m-1]} '${y.slice(2)}`;
  };

  const RangeDropdown = () => (
    <select value={range} onChange={e => setRange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300">
      <option value="all">All time</option>
      <option value="2y">2y</option>
      <option value="1y">1y</option>
      <option value="30d">30d</option>
    </select>
  );

  // If live data is provided, derive real stats from buy_log.json entries
  const liveStats = useMemo(() => {
    if (!liveData?.dcaBuys?.length) return null;
    const buys = liveData.dcaBuys.map(e => ({
      date:                  (e.timestamp || e.time || '').slice(0, 10),
      price:                 e.price,
      usdtSpent:             e.usdt_spent ?? e.usdtSpent ?? 0,
      btcBought:             e.btc_bought ?? e.btcBought ?? 0,
      trigger:               e.trigger || (e.units_requested ? `${e.units_requested}× buy` : 'buy'),
      retainedWeeksIncluded: e.retainedWeeksIncluded ?? null,
      multiplier:            e.multiplier ?? null,
      formulaText:           e.formula ?? null,
    }));
    const totalInvested = buys.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = buys.reduce((s, e) => s + e.btcBought, 0);
    const currentPrice  = liveData.btcPrice || 0;
    const avgBuyPrice   = totalInvested / totalBtc;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = (pnl / totalInvested) * 100;
    const triggerCounts = { '7d MA': 0, '30d MA': 0, '100d MA': 0, '200d MA': 0 };
    buys.forEach(b => { if (b.trigger in triggerCounts) triggerCounts[b.trigger]++; });
    const latestBuy = buys[buys.length - 1];
    return { buys, totalInvested, totalBtc, avgBuyPrice, positionValue, pnl, pnlPct, currentPrice, triggerCounts, latestBuy };
  }, [liveData]);

  const BASE_UNIT = 25;
  const MULTIPLIERS = {
    ma7: 1,
    ma30: 2,
    ma100: 3,
    ma200: 4.5,
  };

  // Live chart data — one point per real buy at its exact date, merged with hybridWeekly
  const liveChartData = useMemo(() => {
    if (!liveStats) return null;
    const buys = [...liveStats.buys].sort((a, b) => a.date.localeCompare(b.date));
    let runBtc = 0, runInvested = 0;
    const buyByDate = {};
    buys.forEach(b => {
      runBtc += b.btcBought; runInvested += b.usdtSpent;
      buyByDate[b.date] = { avg: runInvested / runBtc, price: b.price };
    });
    const weeklyByDate = Object.fromEntries(hybridWeekly.map(w => [w.date, w]));
    const allDates = [...new Set([...hybridWeekly.map(w => w.date), ...buys.map(b => b.date)])].sort();
    let lastAvg = null;
    return allDates.map(date => {
      const w   = weeklyByDate[date];
      const buy = buyByDate[date];
      if (buy) lastAvg = buy.avg;
      return {
        date,
        btcPrice:    buy?.price ?? w?.btcPrice,
        ma7:         w?.ma7    ?? null,
        ma30:        w?.ma30   ?? null,
        ma100:       w?.ma100  ?? null,
        ma200:       w?.ma200  ?? null,
        avgBuyPrice: lastAvg,
      };
    });
  }, [liveStats]);

  // Hybrid dispatcher backtest — MA mode only (ATH mode buys shown in ATH-DCA dashboard)
  const simulation = useMemo(() => {
    const buyEvents = hybridMaBuys;

    const triggerCounts = { '7d MA': 0, '30d MA': 0, '100d MA': 0, '200d MA': 0 };
    buyEvents.forEach(b => { if (b.trigger in triggerCounts) triggerCounts[b.trigger]++; });

    // Chart data: use MA-specific running average so ATH-mode buys don't influence this line
    const chartData = hybridWeekly.map(w => ({
      date: w.date, btcPrice: w.btcPrice,
      ma7: w.ma7, ma30: w.ma30, ma100: w.ma100, ma200: w.ma200,
      avgBuyPrice: w.avgBuyPriceMa,
    }));

    const totalInvested = buyEvents.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = buyEvents.reduce((s, e) => s + e.btcBought, 0);
    const currentPrice  = hybridWeekly[hybridWeekly.length - 1].btcPrice;
    const avgBuyPrice   = totalInvested / totalBtc;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const latestBuy     = buyEvents[buyEvents.length - 1];

    const athWeeks      = hybridWeekly.filter(w => w.mode === 'ATH').length;
    const noTriggerWeeks = hybridWeekly.filter(w => w.mode === 'none').length;
    const totalWeeksRolledForward = buyEvents.reduce((sum, b) => sum + (b.retainedWeeksIncluded - 1), 0);

    return {
      buyEvents, triggerCounts, chartData, latestBuy, currentPrice,
      totalBtc, totalInvested, avgBuyPrice, positionValue, pnl, pnlPct,
      skippedPeriods: noTriggerWeeks,
      athModeWeeks: athWeeks,
      totalWeeksRolledForward,
      pendingRetentionUsd: hybridRetainedFinal * BASE_UNIT,
      pendingRetentionWeeks: hybridRetainedFinal,
      buysCount: buyEvents.length,
    };
  }, []);

  const formatUsd = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);

  const formatBtc = (value) => `${value.toFixed(6)} BTC`;

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, valueClassName = 'text-slate-900' }) => (
    <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className="rounded-xl bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          {trend}
          <span>{subtitle}</span>
        </div>
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

  const MovingAverageLegend = () => {
    const items = [
      { label: 'BTC Price', color: '#f97316' },
      { label: '7d MA', color: '#16a34a' },
      { label: '30d MA', color: '#7c3aed' },
      { label: '100d MA', color: '#0f766e' },
      { label: '200d MA', color: '#475569' },
    ];

    return (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">BTC DCA Dashboard</h1>
            <p className="mt-1 text-slate-600">
              {isLive
                ? 'Live data from your DCA bot — real buys, real prices, real performance.'
                : 'Hybrid dispatcher — MA mode. Activates when BTC is within 15% of its 5yr rolling ATH. Retained weeks accumulate (no cap) and roll into the next executed order.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full px-3 py-1 text-sm">
              {liveStats ? liveStats.buys.length : simulation.buysCount} executed buys
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm">
              Current BTC: {formatUsd(liveStats ? liveStats.currentPrice : simulation.currentPrice)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <TabButton id="overview" label="Overview" icon={BarChart3} />
          <TabButton id="log" label="Buy Log" icon={ListOrdered} />
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(() => {
                const s = liveStats || simulation;
                return (<>
                  <StatCard title="Average Buy Price" value={formatUsd(s.avgBuyPrice)} subtitle="weighted average across all executed buys" icon={Target} trend={<span className="text-slate-500">Avg</span>} />
                  <StatCard title="Profit / Loss" value={formatUsd(s.pnl)} valueClassName={s.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'} subtitle={`${s.pnlPct >= 0 ? '+' : ''}${s.pnlPct.toFixed(2)}% vs invested capital`} icon={s.pnl >= 0 ? TrendingUp : TrendingDown} trend={<span className={`font-medium ${s.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{s.pnl >= 0 ? 'In profit' : 'In loss'}</span>} />
                  <StatCard title="Position Value" value={formatUsd(s.positionValue)} subtitle="market value of your BTC holdings" icon={Wallet} trend={<span className="text-slate-500">Now</span>} />
                  <StatCard title="BTC Accumulated" value={formatBtc(s.totalBtc)} subtitle={formatUsd(s.totalInvested) + ' total invested'} icon={Bitcoin} trend={<span className="text-slate-500">Stacked</span>} />
                </>);
              })()}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-lg shadow-black/5 xl:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">BTC Price vs Your Average Buy Price</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        Orange is BTC. The blue stepped line only changes on executed buys, so you can see how retained weeks and deeper MA triggers pulled your average entry over time.
                      </p>
                    </div>
                    <RangeDropdown />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filterByRange(liveChartData || simulation.chartData)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={xFmt} interval={xInterval} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} domain={['dataMin - 4000', 'dataMax + 4000']} />
                        <Tooltip
                          formatter={(value, name) => [formatUsd(Number(value)), name === 'btcPrice' ? 'BTC Price' : 'Avg Buy Price']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="btcPrice" name="BTC Price" stroke="#f97316" strokeWidth={3} dot={false} />
                        <Line type="stepAfter" dataKey="avgBuyPrice" name="Avg Buy Price" stroke="#2563eb" strokeWidth={3} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Latest Buy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                  {(() => { const lb = liveStats?.latestBuy || simulation.latestBuy; return (<>
                    <div className="flex items-center justify-between"><span>BTC Bought</span><span className="font-medium">{formatBtc(lb.btcBought)}</span></div>
                    <div className="flex items-center justify-between"><span>Price</span><span className="font-medium">{formatUsd(lb.price)}</span></div>
                    <div className="flex items-center justify-between"><span>USDT Spent</span><span className="font-medium">{formatUsd(lb.usdtSpent)}</span></div>
                    <div className="flex items-center justify-between"><span>Retained Weeks</span><span className="font-medium">{lb.retainedWeeksIncluded ?? 0}</span></div>
                    <div className="flex items-center justify-between"><span>Trigger</span><span className="font-medium">{lb.trigger ?? '—'}</span></div>
                  </>); })()}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Algorithm Trigger Mix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    {Object.entries((liveStats || simulation).triggerCounts).map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span>{label}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Retention Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    {liveStats ? (<>
                      <div className="flex items-center justify-between"><span>Pending Weeks</span><span className="font-medium">{liveData?.skippedWeeks ?? 0}</span></div>
                      <div className="flex items-center justify-between"><span>Pending USDT</span><span className="font-medium">{formatUsd((liveData?.skippedWeeks ?? 0) * BASE_UNIT)}</span></div>
                      <div className="flex items-center justify-between"><span>Total Buys</span><span className="font-medium">{liveStats.buys.length}</span></div>
                      <div className="flex items-center justify-between"><span>Base Unit</span><span className="font-medium">{formatUsd(BASE_UNIT)}</span></div>
                    </>) : (<>
                      <div className="flex items-center justify-between"><span>MA buys</span><span className="font-medium">{simulation.buysCount}</span></div>
                      <div className="flex items-center justify-between"><span>ATH mode weeks</span><span className="font-medium text-violet-600">{simulation.athModeWeeks}</span></div>
                      <div className="flex items-center justify-between"><span>No-trigger weeks</span><span className="font-medium">{simulation.skippedPeriods}</span></div>
                      <div className="flex items-center justify-between"><span>Rolled Forward</span><span className="font-medium">{simulation.totalWeeksRolledForward} wks</span></div>
                      <div className="flex items-center justify-between"><span>Pending Retention</span><span className="font-medium">{formatUsd(simulation.pendingRetentionUsd)}</span></div>
                    </>)}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-lg shadow-black/5 xl:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">BTC Price with 7d, 30d, 100d, and 200d Moving Averages</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        The bot only buys when BTC is below the 7d MA. Position sizing then scales with deeper discounts: 1x below 7d, 2x below 30d, 3x below 100d, and 4.5x below 200d.
                      </p>
                    </div>
                    <RangeDropdown />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filterByRange(liveChartData || simulation.chartData)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={xFmt} interval={xInterval} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} domain={['dataMin - 4000', 'dataMax + 4000']} />
                        <Tooltip formatter={(value, name) => [formatUsd(Number(value)), name]} labelFormatter={(label) => `Date: ${label}`} />
                        <Legend content={() => <MovingAverageLegend />} />
                        <Line type="monotone" dataKey="btcPrice" name="BTC Price" stroke="#f97316" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="ma7" name="7d MA" stroke="#16a34a" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="ma30" name="30d MA" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="ma100" name="100d MA" stroke="#0f766e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="ma200" name="200d MA" stroke="#475569" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {!liveStats && (
              <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
                <CardHeader>
                  <CardTitle className="text-lg">Hybrid Dispatcher — MA Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" /><span>MA mode only activates when BTC is within 15% of the 5yr rolling ATH.</span></div>
                  <div className="flex items-start gap-2"><Repeat className="mt-0.5 h-4 w-4 text-slate-500" /><span>If price is above all MAs, the week is skipped and retained counter grows.</span></div>
                  <div className="flex items-start gap-2"><Layers className="mt-0.5 h-4 w-4 text-slate-500" /><span>When ATH mode fires, retained weeks reset to 0 — shared counter between both modes.</span></div>
                  <div className="flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 text-slate-500" /><span>MA buy = retained weeks × $25 × MA tier multiplier (1×–4.5×, no cap).</span></div>
                </CardContent>
              </Card>
              )}
            </div>
          </>
        )}

        {activeTab === 'log' && (
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Buy Log Table</CardTitle>
              <p className="text-sm text-slate-500">
                Every executed order with date, trigger, retained weeks, multiplier, formula, total spent, and BTC received.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Trigger</th>
                      <th className="px-4 py-3 font-medium">Retained Weeks</th>
                      <th className="px-4 py-3 font-medium">Multiplier</th>
                      <th className="px-4 py-3 font-medium">Formula</th>
                      <th className="px-4 py-3 font-medium">BTC Price</th>
                      <th className="px-4 py-3 font-medium">USDT Spent</th>
                      <th className="px-4 py-3 font-medium">BTC Bought</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(liveStats ? liveStats.buys : simulation.buyEvents).map((buy, index) => (
                      <tr key={buy.date + index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 text-slate-700">{buy.date}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {buy.trigger}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{buy.retainedWeeksIncluded ?? 0}</td>
                        <td className="px-4 py-3 text-slate-700">{buy.multiplier != null ? `${buy.multiplier}x` : 0}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{buy.formulaText ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatUsd(buy.price)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatUsd(buy.usdtSpent)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatBtc(buy.btcBought ?? buy.usdtSpent / buy.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">Example JSON Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
{`[
  {
    "btcBought": 0.003634,
    "price": 92836.98,
    "time": "2026-01-19 09:00",
    "usdtSpent": 337.50,
    "retainedWeeksIncluded": 3,
    "baseUnit": 25,
    "multiplier": 4.5,
    "trigger": "200d MA",
    "formula": "3 × 25 × 4.5"
  }
]`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
