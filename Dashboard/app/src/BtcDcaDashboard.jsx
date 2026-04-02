import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target, CalendarClock, Layers, Repeat, ListOrdered, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BtcDcaDashboard({ liveData = null, isLive = false }) {
  const [activeTab, setActiveTab] = useState('overview');

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

  const marketSeries = [
    { date: '2024-05-06', btcPrice: 64200, ma7: 65100, ma30: 63400, ma100: 59800, ma200: 52200 },
    { date: '2024-05-20', btcPrice: 66800, ma7: 66000, ma30: 64200, ma100: 60500, ma200: 52800 },
    { date: '2024-06-03', btcPrice: 69400, ma7: 68100, ma30: 65500, ma100: 61400, ma200: 53600 },
    { date: '2024-06-17', btcPrice: 67100, ma7: 68200, ma30: 66600, ma100: 62100, ma200: 54400 },
    { date: '2024-07-01', btcPrice: 62900, ma7: 64800, ma30: 66200, ma100: 62600, ma200: 55100 },
    { date: '2024-07-15', btcPrice: 61100, ma7: 62500, ma30: 65100, ma100: 62900, ma200: 55800 },
    { date: '2024-07-29', btcPrice: 65400, ma7: 63900, ma30: 64600, ma100: 63200, ma200: 56600 },
    { date: '2024-08-12', btcPrice: 59200, ma7: 61800, ma30: 63700, ma100: 62800, ma200: 57300 },
    { date: '2024-08-26', btcPrice: 57700, ma7: 59400, ma30: 62100, ma100: 61900, ma200: 57900 },
    { date: '2024-09-09', btcPrice: 60300, ma7: 59200, ma30: 61100, ma100: 61400, ma200: 58600 },
    { date: '2024-09-23', btcPrice: 64100, ma7: 62200, ma30: 61500, ma100: 61600, ma200: 59400 },
    { date: '2024-10-07', btcPrice: 68200, ma7: 66100, ma30: 62900, ma100: 62200, ma200: 60300 },
    { date: '2024-10-21', btcPrice: 70400, ma7: 69100, ma30: 64600, ma100: 63100, ma200: 61200 },
    { date: '2024-11-04', btcPrice: 73900, ma7: 72100, ma30: 67200, ma100: 64500, ma200: 62300 },
    { date: '2024-11-18', btcPrice: 81200, ma7: 77900, ma30: 72100, ma100: 67200, ma200: 63600 },
    { date: '2024-12-02', btcPrice: 89600, ma7: 86100, ma30: 78100, ma100: 71200, ma200: 65400 },
    { date: '2024-12-16', btcPrice: 97800, ma7: 94200, ma30: 84600, ma100: 76400, ma200: 67200 },
    { date: '2024-12-30', btcPrice: 101200, ma7: 99300, ma30: 90200, ma100: 81200, ma200: 68900 },
    { date: '2025-01-13', btcPrice: 96300, ma7: 98500, ma30: 93400, ma100: 85000, ma200: 70300 },
    { date: '2025-01-27', btcPrice: 91800, ma7: 94800, ma30: 94700, ma100: 87600, ma200: 71800 },
    { date: '2025-02-10', btcPrice: 88100, ma7: 90600, ma30: 93600, ma100: 89200, ma200: 73100 },
    { date: '2025-02-24', btcPrice: 84500, ma7: 86800, ma30: 91300, ma100: 89800, ma200: 74400 },
    { date: '2025-03-10', btcPrice: 82400, ma7: 83900, ma30: 88900, ma100: 89400, ma200: 75600 },
    { date: '2025-03-24', btcPrice: 85200, ma7: 84100, ma30: 87100, ma100: 88800, ma200: 76800 },
    { date: '2025-04-07', btcPrice: 89600, ma7: 87200, ma30: 86700, ma100: 88600, ma200: 78100 },
    { date: '2025-04-21', btcPrice: 93800, ma7: 91700, ma30: 87800, ma100: 89000, ma200: 79600 },
    { date: '2025-05-05', btcPrice: 97300, ma7: 95500, ma30: 90100, ma100: 90100, ma200: 81100 },
    { date: '2025-05-19', btcPrice: 101900, ma7: 98800, ma30: 93200, ma100: 92000, ma200: 82700 },
    { date: '2025-06-02', btcPrice: 104800, ma7: 103200, ma30: 96100, ma100: 94300, ma200: 84300 },
    { date: '2025-06-16', btcPrice: 108600, ma7: 106500, ma30: 99200, ma100: 97000, ma200: 86000 },
    { date: '2025-06-30', btcPrice: 112800, ma7: 110700, ma30: 102600, ma100: 99800, ma200: 87800 },
    { date: '2025-07-14', btcPrice: 109400, ma7: 111200, ma30: 105100, ma100: 101700, ma200: 89500 },
    { date: '2025-07-28', btcPrice: 103700, ma7: 106800, ma30: 106100, ma100: 102600, ma200: 91200 },
    { date: '2025-08-11', btcPrice: 97800, ma7: 101300, ma30: 104500, ma100: 102100, ma200: 92900 },
    { date: '2025-08-25', btcPrice: 94800, ma7: 96800, ma30: 101600, ma100: 101100, ma200: 94300 },
    { date: '2025-09-08', btcPrice: 99100, ma7: 97200, ma30: 100100, ma100: 100700, ma200: 95600 },
    { date: '2025-09-22', btcPrice: 102700, ma7: 100900, ma30: 100000, ma100: 100800, ma200: 96800 },
    { date: '2025-10-06', btcPrice: 107900, ma7: 105600, ma30: 101800, ma100: 101700, ma200: 98100 },
    { date: '2025-10-20', btcPrice: 111600, ma7: 109800, ma30: 104900, ma100: 103400, ma200: 99400 },
    { date: '2025-11-03', btcPrice: 116200, ma7: 114100, ma30: 108000, ma100: 105600, ma200: 100800 },
    { date: '2025-11-17', btcPrice: 119400, ma7: 117200, ma30: 111600, ma100: 108400, ma200: 102300 },
    { date: '2025-12-01', btcPrice: 114700, ma7: 117300, ma30: 113400, ma100: 110400, ma200: 103700 },
    { date: '2025-12-15', btcPrice: 106900, ma7: 111200, ma30: 112600, ma100: 110900, ma200: 104900 },
    { date: '2025-12-29', btcPrice: 98200, ma7: 102700, ma30: 109100, ma100: 110000, ma200: 105600 },
    { date: '2026-01-12', btcPrice: 94100, ma7: 96600, ma30: 104700, ma100: 108700, ma200: 106100 },
    { date: '2026-01-19', btcPrice: 92836.98, ma7: 94800, ma30: 101900, ma100: 107900, ma200: 106000 },
  ];

  const simulation = useMemo(() => {
    let totalBtc = 0;
    let totalInvested = 0;
    let retainedPeriods = 0;
    let runningAvg = null;

    const buyMap = new Map();
    const triggerCounts = {
      '7d MA': 0,
      '30d MA': 0,
      '100d MA': 0,
      '200d MA': 0,
    };

    const buyEvents = [];

    for (const point of marketSeries) {
      retainedPeriods += 1;

      const below7 = point.btcPrice < point.ma7;
      const below30 = point.btcPrice < point.ma30;
      const below100 = point.btcPrice < point.ma100;
      const below200 = point.btcPrice < point.ma200;

      if (!below7) {
        buyMap.set(point.date, runningAvg);
        continue;
      }

      let multiplier = MULTIPLIERS.ma7;
      let trigger = '7d MA';

      if (below200) {
        multiplier = MULTIPLIERS.ma200;
        trigger = '200d MA';
      } else if (below100) {
        multiplier = MULTIPLIERS.ma100;
        trigger = '100d MA';
      } else if (below30) {
        multiplier = MULTIPLIERS.ma30;
        trigger = '30d MA';
      }

      const retainedWeeksIncluded = retainedPeriods;
      const usdtSpent = BASE_UNIT * multiplier * retainedWeeksIncluded;
      const btcBought = usdtSpent / point.btcPrice;

      totalInvested += usdtSpent;
      totalBtc += btcBought;
      runningAvg = totalInvested / totalBtc;
      triggerCounts[trigger] += 1;

      buyEvents.push({
        time: `${point.date} 09:00`,
        date: point.date,
        price: point.btcPrice,
        usdtSpent,
        btcBought,
        trigger,
        retainedWeeksIncluded,
        baseUnit: BASE_UNIT,
        multiplier,
        formulaText: `${retainedWeeksIncluded} × $${BASE_UNIT} × ${multiplier}`,
      });

      retainedPeriods = 0;
      buyMap.set(point.date, runningAvg);
    }

    const chartData = marketSeries.map((point) => ({
      ...point,
      avgBuyPrice: buyMap.get(point.date) ?? null,
    }));

    const latestBuy = buyEvents[buyEvents.length - 1];
    const currentPrice = marketSeries[marketSeries.length - 1].btcPrice;
    const avgBuyPrice = totalInvested / totalBtc;
    const positionValue = totalBtc * currentPrice;
    const pnl = positionValue - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

    const skippedPeriods = marketSeries.length - buyEvents.length;
    const totalWeeksRolledForward = buyEvents.reduce((sum, buy) => sum + (buy.retainedWeeksIncluded - 1), 0);
    const pendingRetentionUsd = retainedPeriods * BASE_UNIT;

    return {
      buyEvents,
      triggerCounts,
      chartData,
      latestBuy,
      currentPrice,
      totalBtc,
      totalInvested,
      avgBuyPrice,
      positionValue,
      pnl,
      pnlPct,
      skippedPeriods,
      totalWeeksRolledForward,
      pendingRetentionUsd,
      pendingRetentionWeeks: retainedPeriods,
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
                : 'Mock simulation of your BTC bot with a 25 USD base unit, buy gating below the 7d MA, dynamic sizing by moving average depth, and retained weeks rolled into the next executed order.'}
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
                  <CardTitle className="text-lg">BTC Price vs Your Average Buy Price</CardTitle>
                  <p className="text-sm text-slate-500">
                    Orange is BTC. The blue stepped line only changes on executed buys, so you can see how retained weeks and deeper MA triggers pulled your average entry over time.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveData?.chartData || simulation.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(value) => value.slice(2)} />
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
                      <div className="flex items-center justify-between"><span>Skipped Periods</span><span className="font-medium">{simulation.skippedPeriods}</span></div>
                      <div className="flex items-center justify-between"><span>Rolled Forward Weeks</span><span className="font-medium">{simulation.totalWeeksRolledForward}</span></div>
                      <div className="flex items-center justify-between"><span>Pending Retention</span><span className="font-medium">{formatUsd(simulation.pendingRetentionUsd)}</span></div>
                      <div className="flex items-center justify-between"><span>Base Unit</span><span className="font-medium">{formatUsd(BASE_UNIT)}</span></div>
                    </>)}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-lg shadow-black/5 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">BTC Price with 7d, 30d, 100d, and 200d Moving Averages</CardTitle>
                  <p className="text-sm text-slate-500">
                    The bot only buys when BTC is below the 7d MA. Position sizing then scales with deeper discounts: 1x below 7d, 2x below 30d, 3x below 100d, and 4.5x below 200d.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveData?.chartData || simulation.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(value) => value.slice(2)} />
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
                  <CardTitle className="text-lg">How the Mock Logic Was Simulated</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" /><span>Each period adds one retained week to the counter.</span></div>
                  <div className="flex items-start gap-2"><Repeat className="mt-0.5 h-4 w-4 text-slate-500" /><span>If BTC is not below the 7d MA, no buy happens and the week rolls forward.</span></div>
                  <div className="flex items-start gap-2"><Layers className="mt-0.5 h-4 w-4 text-slate-500" /><span>When a buy executes, the multiplier is applied to all retained weeks plus the current week.</span></div>
                  <div className="flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 text-slate-500" /><span>Executed amount = retained weeks included × 25 USD × active multiplier.</span></div>
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
