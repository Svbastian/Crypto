import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { dcaBuyEvents, crashBuyEvents, btcPriceSeries, CURRENT_BTC_PRICE } from './data/botData';
import { weeklyBacktest4yr } from './data/backtest4yr';

// ATH-DCA algorithm constants (must match ath_dca.py)
const MIN_DIP_ATH = 0.15;
const BASE_ATH    = 25;
const MAX_ATH     = 500;
const LOG_K_ATH   = 10;

function computeAthBuySize(price, ath) {
  const dip = (ath - price) / ath;
  if (dip < MIN_DIP_ATH) return null;
  const ratio    = Math.min((dip - MIN_DIP_ATH) / (1.0 - MIN_DIP_ATH), 1.0);
  const logRatio = Math.log1p(ratio * LOG_K_ATH) / Math.log1p(LOG_K_ATH);
  return Math.round(BASE_ATH + logRatio * (MAX_ATH - BASE_ATH));
}

export default function BtcSummaryDashboard({ liveData = null, isLive = false }) {
  const [range, setRange] = useState('all');

  // True when user has toggled Live AND API responded
  const showLive = isLive && !!liveData;

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

  // Normalize live DCA log entries to match botData shape
  const normalizeDca = (e) => ({
    date:       (e.timestamp || '').slice(0, 10),
    price:      e.price,
    usdtSpent:  e.usdt_spent,
    trigger:    e.trigger || (e.units_requested ? `${e.units_requested}× buy` : 'buy'),
    multiplier: e.units_requested || 1,
  });

  const normalizeCrash = (e) => ({
    date:      (e.timestamp || '').slice(0, 10),
    price:     e.price,
    usdtSpent: e.usdt_spent,
    dipPct:    e.dip_pct || 0,
    tier:      e.tier || 'Crash buy',
    units:     e.units_requested || 1,
  });

  // In live mode always use real data — never fall back to mock
  const activeDca    = showLive ? (liveData.dcaBuys?.map(normalizeDca)     || []) : dcaBuyEvents;
  const activeCrash  = showLive ? (liveData.crashBuys?.map(normalizeCrash) || []) : crashBuyEvents;
  const currentPrice = showLive ? (liveData.btcPrice || 0) : CURRENT_BTC_PRICE;
  const priceSeries  = showLive ? (liveData.chartData || []) : btcPriceSeries;

  // ATH-DCA: simulate from 4yr backtest in demo mode; no live data yet
  const activeAth = useMemo(() => {
    if (showLive) return [];
    return weeklyBacktest4yr.reduce((acc, w) => {
      const size = computeAthBuySize(w.btcPrice, w.ath5yr);
      if (size !== null) {
        acc.push({ date: w.date, price: w.btcPrice, usdtSpent: size, btcBought: size / w.btcPrice, bot: 'ATH', dip: ((w.ath5yr - w.btcPrice) / w.ath5yr * 100).toFixed(1) });
      }
      return acc;
    }, []);
  }, [showLive]);

  const stats = useMemo(() => {
    const dcaEnriched   = activeDca.map(e   => ({ ...e, btcBought: e.usdtSpent / e.price, bot: 'DCA'   }));
    const crashEnriched = activeCrash.map(e => ({ ...e, btcBought: e.usdtSpent / e.price, bot: 'Crash' }));
    const athEnriched   = activeAth;  // already has btcBought
    const all = [...dcaEnriched, ...crashEnriched, ...athEnriched].sort((a, b) => a.date.localeCompare(b.date));

    const dcaInvested   = dcaEnriched.reduce((s, e)  => s + e.usdtSpent, 0);
    const crashInvested = crashEnriched.reduce((s, e) => s + e.usdtSpent, 0);
    const athInvested   = athEnriched.reduce((s, e)   => s + e.usdtSpent, 0);
    const totalInvested = dcaInvested + crashInvested + athInvested;

    const dcaBtc   = dcaEnriched.reduce((s, e)  => s + e.btcBought, 0);
    const crashBtc = crashEnriched.reduce((s, e) => s + e.btcBought, 0);
    const athBtc   = athEnriched.reduce((s, e)   => s + e.btcBought, 0);
    const totalBtc = dcaBtc + crashBtc + athBtc;

    const avgBuyPrice   = totalInvested / totalBtc;
    const positionValue = totalBtc * currentPrice;
    const pnl           = positionValue - totalInvested;
    const pnlPct        = (pnl / totalInvested) * 100;

    // Build chart: merge BTC price series with running avg buy price
    let runBtc = 0, runInvested = 0;
    const buyByDate = {};
    all.forEach(e => {
      runBtc      += e.btcBought;
      runInvested += e.usdtSpent;
      buyByDate[e.date] = { avgBuyPrice: runInvested / runBtc, bot: e.bot };
    });

    // Walk price series, carry forward latest avgBuyPrice
    let lastAvg = null;
    const avgLine = priceSeries.map(p => {
      const isBuyDate = !!buyByDate[p.date];
      if (isBuyDate) lastAvg = buyByDate[p.date];
      return {
        date:        p.date,
        btcPrice:    p.btcPrice,
        avgBuyPrice: lastAvg ? lastAvg.avgBuyPrice : null,
        bot:         isBuyDate ? lastAvg.bot : null,
      };
    });

    // Monthly spend breakdown for bar chart
    const monthMap = {};
    all.forEach(e => {
      const month = e.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { month, DCA: 0, Crash: 0, ATH: 0 };
      monthMap[month][e.bot] += e.usdtSpent;
    });
    const monthlyChart = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Contribution bars
    const contribution = [
      { name: 'DCA Bot',   invested: dcaInvested,   btc: dcaBtc,   avg: dcaBtc   > 0 ? dcaInvested / dcaBtc     : 0, buys: dcaEnriched.length,   color: '#6366f1' },
      { name: 'Crash Bot', invested: crashInvested, btc: crashBtc, avg: crashBtc > 0 ? crashInvested / crashBtc : 0, buys: crashEnriched.length, color: '#ef4444' },
      { name: 'ATH-DCA',   invested: athInvested,   btc: athBtc,   avg: athBtc   > 0 ? athInvested / athBtc     : 0, buys: athEnriched.length,   color: '#7c3aed' },
    ];

    return { totalInvested, totalBtc, avgBuyPrice, positionValue, pnl, pnlPct, avgLine, monthlyChart, contribution, all };
  }, [activeDca, activeCrash, activeAth, currentPrice, priceSeries]);

  const formatUsd = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
  const formatBtc = v => `${v.toFixed(6)} BTC`;

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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Combined Summary</h1>
          <p className="mt-1 text-slate-600">
            Overall performance across all three bots — {stats.all.length} total buys.
          </p>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total BTC Accumulated" value={formatBtc(stats.totalBtc)}      subtitle={formatUsd(stats.totalInvested) + ' total invested'}          icon={Bitcoin} />
          <StatCard title="Overall Avg Buy Price"  value={formatUsd(stats.avgBuyPrice)}   subtitle="weighted across all buys from both bots"                      icon={Target} />
          <StatCard title="Position Value"          value={formatUsd(stats.positionValue)} subtitle={`at current price of ${formatUsd(currentPrice)}`}         icon={Wallet} />
          <StatCard
            title="Total Profit / Loss"
            value={formatUsd(stats.pnl)}
            valueClassName={stats.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}
            subtitle={`${stats.pnlPct >= 0 ? '+' : ''}${stats.pnlPct.toFixed(2)}% return on invested capital`}
            icon={stats.pnl >= 0 ? TrendingUp : TrendingDown}
          />
        </div>

        {/* Bot comparison + avg buy price chart */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Avg buy price over time */}
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5 xl:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">BTC Price vs Running Average Buy Price</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Orange = BTC price. Blue = combined average buy price stepping up with each purchase. Dots mark individual buys.</p>
                </div>
                <RangeToggle />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filterByRange(stats.avgLine)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={xFmt} interval={xInterval} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} domain={['dataMin - 3000', 'dataMax + 3000']} />
                    <Tooltip formatter={(v, name) => [formatUsd(Number(v)), name === 'btcPrice' ? 'BTC Price' : 'Avg Buy Price']} labelFormatter={l => `Date: ${l}`} />
                    <Line type="monotone" dataKey="btcPrice"     name="BTC Price"    stroke="#f97316" strokeWidth={3} dot={false} />
                    <Line type="stepAfter" dataKey="avgBuyPrice" name="Avg Buy Price" stroke="#2563eb" strokeWidth={2} connectNulls dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.bot) return null;
                      const color = payload.bot === 'DCA' ? '#6366f1' : payload.bot === 'ATH' ? '#7c3aed' : '#ef4444';
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 rounded-full bg-orange-400" /> BTC Price</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 rounded-full bg-blue-600" /> Avg Buy Price</div>
                <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" /> DCA buy</div>
                <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Crash buy</div>
                <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-700" /> ATH-DCA buy</div>
              </div>
            </CardContent>
          </Card>

          {/* Bot comparison */}
          <div className="space-y-4">
            {stats.contribution.map(bot => {
              const color = bot.color;
              const pct = stats.totalInvested > 0 ? (bot.invested / stats.totalInvested) * 100 : 0;
              return (
                <Card key={bot.name} className="rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      {bot.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between"><span>Invested</span>    <span className="font-medium">{formatUsd(bot.invested)}</span></div>
                    <div className="flex justify-between"><span>BTC Bought</span>  <span className="font-medium">{formatBtc(bot.btc)}</span></div>
                    <div className="flex justify-between"><span>Avg Price</span>   <span className="font-medium">{formatUsd(bot.avg)}</span></div>
                    <div className="flex justify-between"><span>Buys</span>        <span className="font-medium">{bot.buys}</span></div>
                    <div className="w-full rounded-full bg-slate-100 h-2 mt-1">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <p className="text-xs text-slate-400">{pct.toFixed(0)}% of total capital deployed</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Monthly spend bar chart */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Spend — DCA vs Crash Bot vs ATH-DCA</CardTitle>
            <p className="text-sm text-slate-500">USDT deployed each month, split by bot.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyChart} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2)} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v, name) => [formatUsd(v), name]} />
                  <Legend />
                  <Bar dataKey="DCA"   name="DCA Bot"   fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Crash" name="Crash Bot" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ATH"   name="ATH-DCA"   fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Combined buy log */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">All Buys — Combined Timeline</CardTitle>
            <p className="text-sm text-slate-500">Every purchase from both bots in chronological order.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Bot</th>
                    <th className="px-4 py-3 font-medium">Trigger / Tier</th>
                    <th className="px-4 py-3 font-medium">BTC Price</th>
                    <th className="px-4 py-3 font-medium">USDT Spent</th>
                    <th className="px-4 py-3 font-medium">BTC Bought</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.all.map((e, i) => {
                    const isDca  = e.bot === 'DCA';
                    const isAth  = e.bot === 'ATH';
                    const label  = isDca ? e.trigger : isAth ? `-${e.dip}% from ATH` : e.tier;
                    const color  = isDca ? '#6366f1' : isAth ? '#7c3aed' : '#ef4444';
                    const bgColor = isDca ? '#6366f120' : isAth ? '#7c3aed20' : '#ef444420';
                    return (
                      <tr key={e.date + i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 text-slate-700">{e.date}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: bgColor, color }}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                            {e.bot}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{label}</td>
                        <td className="px-4 py-3 text-slate-700">{formatUsd(e.price)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatUsd(e.usdtSpent)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatBtc(e.btcBought)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
