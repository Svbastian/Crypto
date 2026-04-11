import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target, Zap, ListOrdered, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import { hybridWeekly, hybridAthBuys } from './data/hybridBacktest';

// === Algorithm constants ===
const MIN_DIP      = 0.15;   // trigger at -15% below rolling ATH
const BASE_USDT    = 25;     // buy size at trigger
const MAX_USDT     = 1000;   // demo/backtest max — kept at 1000 so historic simulation is unchanged
const LIVE_MAX_USDT = 500;   // live mode max — real bot config (dispatcher.py ATH_MAX_USDT)
const POW_N        = 2.1;    // power curve exponent

function computeBuySize(price, ath, maxUsdt = MAX_USDT) {
  const dip = (ath - price) / ath;
  if (dip < MIN_DIP) return null;
  const ratio    = Math.min((dip - MIN_DIP) / (1.0 - MIN_DIP), 1.0);
  const powRatio = Math.pow(ratio, POW_N);
  return Math.round(BASE_USDT + powRatio * (maxUsdt - BASE_USDT));
}

export default function AthDcaDashboard({ liveData = null, isLive = false }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [range, setRange] = useState('all');
  const [rangeAvg, setRangeAvg] = useState('all');

  const TabButton = ({ id, label, icon: Icon }) => (
    <button onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );
  const currentPrice = liveData?.btcPrice || 71900;

  // Live buy log from real ATH-DCA bot
  const liveStats = useMemo(() => {
    if (!liveData?.athBuys?.length) return null;
    const buys = liveData.athBuys.map(e => ({
      date:      (e.timestamp || '').slice(0, 10),
      price:     e.price,
      usdtSpent: e.usdt_spent,
      btcBought: e.btc_bought,
      ath:       e.rolling_ath,
      dip:       e.dip_pct,
      buySize:   e.buy_amount,
    }));
    const totalInvested = buys.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = buys.reduce((s, e) => s + e.btcBought, 0);
    const avgBuyPrice   = totalBtc > 0 ? totalInvested / totalBtc : 0;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    return { buys, totalInvested, totalBtc, avgBuyPrice, positionValue, pnl, pnlPct };
  }, [liveData, currentPrice]);

  const xFmt = v => {
    const [y, m, d] = v.split('-');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return range === '30d' ? `${mon[+m-1]} ${+d}` : `${mon[+m-1]} '${y.slice(2)}`;
  };
  const xInterval = range === '30d' ? 1 : range === '1y' ? 7 : range === '2y' ? 13 : 25;

  const RangeDropdown = ({ value, onChange, extraClass = '' }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 ${extraClass}`}>
      <option value="all">All time</option>
      <option value="2y">2y</option>
      <option value="1y">1y</option>
      <option value="30d">30d</option>
    </select>
  );

  // Hybrid dispatcher backtest — ATH mode only (with shared retained weeks, capped at 5)
  const sim = useMemo(() => {
    const buyEvents = hybridAthBuys.map(e => ({
      date: e.date, price: e.price, ath: e.ath,
      dip: e.dip, usdtSpent: e.usdtSpent, btcBought: e.btcBought,
      buySize: e.usdtSpent, btc: e.btcBought,
    }));

    const totalInvested = buyEvents.reduce((s, e) => s + e.usdtSpent, 0);
    const totalBtc      = buyEvents.reduce((s, e) => s + e.btcBought, 0);

    // Enriched weekly series for charts
    const enriched = hybridWeekly.map(w => ({
      date: w.date, price: w.btcPrice,
      ath: w.ath, triggerPrice: w.triggerPrice,
      dip: w.dip, buySize: w.mode === 'ATH' ? w.usdtSpent : 0,
      bought: w.mode === 'ATH',
      ma7: w.ma7, avgBuyPrice: w.avgBuyPriceAth,
    }));

    const last           = enriched[enriched.length - 1];
    const currentAth     = last?.ath || 0;
    const currentDip     = last?.dip || 0;
    const currentBuySize = computeBuySize(currentPrice, currentAth);
    const positionValue  = totalBtc * currentPrice;
    const pnl            = positionValue - totalInvested;
    const pnlPct         = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const avgBuyPrice    = totalBtc > 0 ? totalInvested / totalBtc : 0;

    return { enriched, buyEvents, totalInvested, totalBtc, positionValue, pnl, pnlPct, avgBuyPrice, currentAth, currentDip, currentBuySize };
  }, [currentPrice]);

  // Live chart data — built from real buy log; no simulated dots in live mode
  const liveChartData = useMemo(() => {
    if (!isLive) return null;
    // Real buy dates (Mondays) don't match hybridWeekly dates (Saturdays) — use forward scan
    const sortedBuys = [...(liveStats?.buys || [])].sort((a, b) => a.date.localeCompare(b.date));
    let runBtc = 0, runInvested = 0;
    const buyEvents = sortedBuys.map(b => {
      runBtc += b.btcBought; runInvested += b.usdtSpent;
      return { date: b.date, avg: runInvested / runBtc };
    });
    let buyIdx = 0, lastAvg = null;
    const mapped = sim.enriched.map(w => {
      let isBuy = false;
      while (buyIdx < buyEvents.length && buyEvents[buyIdx].date <= w.date) {
        lastAvg = buyEvents[buyIdx].avg;
        isBuy   = true;
        buyIdx++;
      }
      return { ...w, avgBuyPrice: lastAvg, bought: isBuy };
    });
    // Append buys that fall after the last hybridWeekly entry
    while (buyIdx < buyEvents.length) {
      const b = buyEvents[buyIdx];
      lastAvg = b.avg;
      mapped.push({ date: b.date, price: sortedBuys[buyIdx].price, ath: null, triggerPrice: null, dip: null, ma7: null, avgBuyPrice: lastAvg, bought: true });
      buyIdx++;
    }
    return mapped;
  }, [isLive, liveStats, sim.enriched]);

  const chartData = isLive ? (liveChartData ?? sim.enriched) : sim.enriched;

  // Buy curve — dip 0–90%, showing power curve shape (uses live max in live mode)
  const buyCurve = useMemo(() => {
    const maxUsdt = isLive ? LIVE_MAX_USDT : MAX_USDT;
    return Array.from({ length: 91 }, (_, dipPct) => {
      const dip = dipPct / 100;
      if (dip < MIN_DIP) return { dip: dipPct, buySize: null };
      const ratio    = Math.min((dip - MIN_DIP) / (1.0 - MIN_DIP), 1.0);
      const powRatio = Math.pow(ratio, POW_N);
      return { dip: dipPct, buySize: Math.round(BASE_USDT + powRatio * (maxUsdt - BASE_USDT)) };
    });
  }, [isLive]);

  const filterByDays = (arr, r) => {
    if (r === 'all') return arr;
    const days = r === '30d' ? 30 : r === '1y' ? 365 : 730;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return arr.filter(item => (item.date || '') >= cutoffStr);
  };

  const filterByRange = arr => filterByDays(arr, range);

  const avgXInterval = rangeAvg === '30d' ? 1 : rangeAvg === '1y' ? 7 : rangeAvg === '2y' ? 13 : 25;
  const avgXFmt = v => {
    const [y, m, d] = v.split('-');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return rangeAvg === '30d' ? `${mon[+m-1]} ${+d}` : `${mon[+m-1]} '${y.slice(2)}`;
  };

  const formatUsd = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  const formatBtc = v => `${v.toFixed(6)} BTC`;

  const inBuyZone  = sim.currentDip >= MIN_DIP * 100;
  const currentDipRounded = Math.round(sim.currentDip);

  const StatCard = ({ title, value, subtitle, icon: Icon, valueClassName = 'text-slate-900' }) => (
    <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className="rounded-xl bg-slate-100 p-2"><Icon className="h-4 w-4 text-slate-700" /></div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">ATH-DCA Bot</h1>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Hybrid Dispatcher · ATH Mode · 4yr Backtest</span>
          </div>
          <p className="mt-1 text-slate-600">
            Hybrid dispatcher — ATH mode. Fires when BTC is ≥15% below 5yr rolling ATH. Power curve sizing + retained weeks multiplier (capped at 5 weeks × 0.5×).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3">
          <TabButton id="overview" label="Overview"  icon={BarChart3}  />
          <TabButton id="log" label="Buy Log" icon={ListOrdered} />
        </div>

        {activeTab === 'overview' && (<>

        {/* Current status banner */}
        <Card className={`rounded-2xl border-0 shadow-lg shadow-black/5 ${inBuyZone ? 'bg-emerald-50' : 'bg-slate-100'}`}>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`rounded-xl p-3 ${inBuyZone ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                  <Zap className={`h-5 w-5 ${inBuyZone ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Current Status (live price)</p>
                  <p className={`text-lg font-bold ${inBuyZone ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {inBuyZone ? '✅ Buy zone — would trigger this week' : '⏭️ Above threshold — no buy this week'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div><p className="text-slate-500">Current Price</p><p className="font-bold text-slate-900">{formatUsd(currentPrice)}</p></div>
                <div><p className="text-slate-500">5yr Rolling ATH</p><p className="font-bold text-slate-900">{formatUsd(sim.currentAth)}</p></div>
                <div><p className="text-slate-500">Dip from ATH</p><p className={`font-bold ${inBuyZone ? 'text-emerald-600' : 'text-slate-500'}`}>{sim.currentDip.toFixed(1)}%</p></div>
                <div><p className="text-slate-500">Would Buy</p><p className={`font-bold ${inBuyZone ? 'text-emerald-600' : 'text-slate-400'}`}>{sim.currentBuySize ? formatUsd(isLive ? computeBuySize(currentPrice, sim.currentAth, LIVE_MAX_USDT) : sim.currentBuySize) : '—'}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stat cards — live: real buys; demo: backtest simulation */}
        {(() => {
          const s = isLive ? liveStats : sim;
          const noBuys = !s || (isLive && !liveStats);
          return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="BTC Accumulated"  value={noBuys ? '—' : formatBtc(s.totalBtc)}      subtitle={noBuys ? 'No live buys yet' : isLive ? `${liveStats.buys.length} live buys` : `${sim.buyEvents.length} buys over 4yr backtest`} icon={Bitcoin} />
              <StatCard title="Avg Buy Price"    value={noBuys ? '—' : formatUsd(s.avgBuyPrice)}   subtitle="weighted average across all buys" icon={Target} />
              <StatCard title="Position Value"   value={noBuys ? '—' : formatUsd(s.positionValue)} subtitle={`at current ${formatUsd(currentPrice)}`} icon={Wallet} />
              <StatCard
                title={isLive ? 'Profit / Loss' : 'Backtest P/L'}
                value={noBuys ? '—' : formatUsd(s.pnl)}
                valueClassName={noBuys ? 'text-slate-400' : s.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}
                subtitle={noBuys ? 'No buys yet' : `${s.pnlPct >= 0 ? '+' : ''}${s.pnlPct.toFixed(1)}% vs ${formatUsd(s.totalInvested)} invested`}
                icon={noBuys || s.pnl >= 0 ? TrendingUp : TrendingDown}
              />
            </div>
          );
        })()}

        {/* Price vs ATH — full width, tall */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">BTC Price vs 5yr Rolling ATH</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Orange = BTC price. Grey dashed = rolling ATH. Green dashed = buy trigger (-15%). Purple dots = {isLive ? 'real buys' : 'simulated buys'}.
                </p>
              </div>
              <RangeDropdown value={range} onChange={setRange} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filterByRange(chartData)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={xFmt} interval={xInterval} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} domain={['dataMin - 5000', 'dataMax + 5000']} />
                  <Tooltip formatter={(v, name) => [formatUsd(v), name]} labelFormatter={l => `Week of ${l}`} />
                  <Line type="monotone" dataKey="ath"          stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="6 3" name="Rolling ATH" />
                  <Line type="monotone" dataKey="triggerPrice" stroke="#10b981" strokeWidth={1}   dot={false} strokeDasharray="4 4" name="Trigger -15%" />
                  <Line type="monotone" dataKey="price"        stroke="#f97316" strokeWidth={2.5} name="BTC Price"
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.bought) return null;
                      return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bottom row: buy curve (left) + avg buy price chart (right) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* Algorithm curve */}
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Buy Size vs Dip from ATH</CardTitle>
              <p className="text-sm text-slate-500">
                Power curve — stays cheap at moderate dips, accelerates hard at extreme crashes. Green line = current position.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={buyCurve} margin={{ bottom: 20 }}>
                    <defs>
                      <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dip" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`}
                      label={{ value: '% below ATH', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => v ? [`$${v}`, 'Buy size'] : ['No buy', '']} labelFormatter={l => `${l}% below ATH`} />
                    <ReferenceLine x={15} stroke="#94a3b8" strokeDasharray="4 4"
                      label={{ value: 'Trigger', position: 'top', fontSize: 10, fill: '#94a3b8' }} />
                    {inBuyZone && (
                      <ReferenceLine x={currentDipRounded} stroke="#10b981" strokeWidth={2}
                        label={{ value: `Now ${currentDipRounded}%`, position: 'top', fontSize: 10, fill: '#10b981' }} />
                    )}
                    <Area type="monotone" dataKey="buySize" stroke="#7c3aed" strokeWidth={2.5}
                      fill="url(#buyGrad)" connectNulls={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Reference table */}
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                {[15, 25, 40, 55, 70].map(dipPct => {
                  const fakePrice = sim.currentAth * (1 - dipPct / 100);
                  const size = computeBuySize(fakePrice, sim.currentAth, isLive ? LIVE_MAX_USDT : MAX_USDT);
                  const isNow = Math.abs(dipPct - sim.currentDip) < 5;
                  return (
                    <div key={dipPct} className={`rounded-lg p-2 ${isNow ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}`}>
                      <p className="font-medium text-slate-600">-{dipPct}%</p>
                      <p className="font-bold text-violet-600">{size ? `$${size}` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* BTC price + 7d MA + ATH-DCA avg buy price */}
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">BTC Price vs Avg Buy Price</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Orange = BTC price. Green = 7d MA. Green dashed = ATH-DCA buy trigger (-15% from ATH). Blue stepped = running avg buy price.
                  </p>
                </div>
                <RangeDropdown value={rangeAvg} onChange={setRangeAvg} extraClass="ml-2" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filterByDays(chartData, rangeAvg)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={avgXFmt} interval={avgXInterval} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} domain={['dataMin - 3000', 'dataMax + 3000']} />
                    <Tooltip formatter={(v, name) => [formatUsd(v), name]} labelFormatter={l => `Week of ${l}`} />
                    <Line type="monotone"   dataKey="price"        stroke="#f97316" strokeWidth={2.5} dot={false} name="BTC Price" />
                    <Line type="monotone"   dataKey="ma7"          stroke="#16a34a" strokeWidth={1.5} dot={false} name="7d MA" strokeDasharray="4 2" />
                    <Line type="monotone"   dataKey="triggerPrice" stroke="#10b981" strokeWidth={1.5} dot={false} name="ATH Trigger -15%" strokeDasharray="6 3" />
                    <Line type="stepAfter"  dataKey="avgBuyPrice"  stroke="#2563eb" strokeWidth={2}   dot={false} name="Avg Buy Price" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 rounded-full bg-orange-400" /> BTC Price</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 rounded-full bg-green-600" /> 7d MA</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-emerald-500" /> ATH Trigger -15%</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 rounded-full bg-blue-600" /> Avg Buy Price</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm config */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">Algorithm Parameters</CardTitle>
            <p className="text-sm text-slate-500">Current config — edit in <code className="rounded bg-slate-100 px-1 text-xs">ATH-DCA-BOT/ath_dca.py</code></p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                ['ATH Window', '5 years', '1,825 daily candles'],
                ['Buy Trigger', '-15% from ATH', `currently ${formatUsd(sim.currentAth * 0.85)}`],
                ['Min Buy', '$25', 'at exactly -15%'],
                ['Max Buy', isLive ? '$500' : '$1,000', isLive ? 'live mode cap' : 'demo/backtest cap'],
                ['Curve', 'Power curve', `exponent n=${POW_N}`],
              ].map(([label, val, sub]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-bold text-slate-900">{val}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        </>)}

        {activeTab === 'log' && (() => {
          const logEntries = isLive ? (liveStats?.buys || []) : sim.buyEvents;
          const title = isLive ? 'Live Buy Log' : 'Simulated Buy Log — 4yr Backtest';
          const subtitle = isLive
            ? `${logEntries.length} real buys from ATH-DCA bot`
            : `Real BTC prices, real algorithm. What would have been bought weekly since ${sim.enriched[0]?.date}.`;
          return (
            <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <p className="text-sm text-slate-500">{subtitle}</p>
              </CardHeader>
              <CardContent>
                {logEntries.length === 0 ? (
                  <p className="py-8 text-center text-slate-400 text-sm">No ATH-DCA buys recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">{isLive ? 'Date' : 'Week'}</th>
                          <th className="px-4 py-3 font-medium">BTC Price</th>
                          <th className="px-4 py-3 font-medium">Rolling ATH</th>
                          <th className="px-4 py-3 font-medium">Dip from ATH</th>
                          <th className="px-4 py-3 font-medium">USDT Spent</th>
                          <th className="px-4 py-3 font-medium">BTC Bought</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logEntries.map((e, i) => (
                          <tr key={e.date + i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 text-slate-700">{e.date}</td>
                            <td className="px-4 py-3 text-slate-700">{formatUsd(e.price)}</td>
                            <td className="px-4 py-3 text-slate-500">{formatUsd(e.ath)}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                                -{(isLive ? e.dip : e.dip).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{formatUsd(e.usdtSpent || e.buySize)}</td>
                            <td className="px-4 py-3 text-slate-700">{formatBtc(e.btcBought || e.btc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

      </div>
    </div>
  );
}
