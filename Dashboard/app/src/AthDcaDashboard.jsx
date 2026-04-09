import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Bitcoin, Target, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ScatterChart, Scatter } from 'recharts';

// === Algorithm constants (must match ath_dca.py) ===
const MIN_DIP   = 0.15;   // 15% below ATH = trigger
const BASE_USDT = 25;     // buy size at trigger
const MAX_USDT  = 1000;   // theoretical max (approached logarithmically)

function computeBuySize(price, ath) {
  const dip = (ath - price) / ath;
  if (dip < MIN_DIP) return null;
  const ratio    = Math.min((dip - MIN_DIP) / (1.0 - MIN_DIP), 1.0);
  const logRatio = Math.log1p(ratio) / Math.log1p(1);
  return Math.round(BASE_USDT + logRatio * (MAX_USDT - BASE_USDT));
}

// === Mock weekly price series (Jan 2025 → Apr 2026) ===
// Tracks real approximate BTC price history
const mockWeeklyPrices = [
  { date: '2025-01-06', price: 102000 },
  { date: '2025-01-13', price: 109000 },
  { date: '2025-01-20', price: 105000 },
  { date: '2025-01-27', price: 101000 },
  { date: '2025-02-03', price: 97000  },
  { date: '2025-02-10', price: 95000  },
  { date: '2025-02-17', price: 96000  },
  { date: '2025-02-24', price: 86000  },
  { date: '2025-03-03', price: 84000  },
  { date: '2025-03-10', price: 80000  },
  { date: '2025-03-17', price: 83000  },
  { date: '2025-03-24', price: 86000  },
  { date: '2025-03-31', price: 82000  },
  { date: '2025-04-07', price: 78000  },
  { date: '2025-04-14', price: 84000  },
  { date: '2025-04-21', price: 91000  },
  { date: '2025-04-28', price: 95000  },
  { date: '2025-05-05', price: 98000  },
  { date: '2025-05-12', price: 103000 },
  { date: '2025-05-19', price: 107000 },
  { date: '2025-05-26', price: 109000 },
  { date: '2025-06-02', price: 112000 },
  { date: '2025-06-09', price: 108000 },
  { date: '2025-06-16', price: 114000 },
  { date: '2025-06-23', price: 118000 },
  { date: '2025-06-30', price: 116000 },
  { date: '2025-07-07', price: 119000 },
  { date: '2025-07-14', price: 122000 },
  { date: '2025-07-21', price: 118000 },
  { date: '2025-07-28', price: 115000 },
  { date: '2025-08-04', price: 117000 },
  { date: '2025-08-11', price: 121000 },
  { date: '2025-08-18', price: 113000 },
  { date: '2025-08-25', price: 111000 },
  { date: '2025-09-01', price: 108000 },
  { date: '2025-09-08', price: 105000 },
  { date: '2025-09-15', price: 103000 },
  { date: '2025-09-22', price: 113000 },
  { date: '2025-09-29', price: 108000 },
  { date: '2025-10-06', price: 104000 },
  { date: '2025-10-13', price: 100000 },
  { date: '2025-10-20', price: 97000  },
  { date: '2025-10-27', price: 94000  },
  { date: '2025-11-03', price: 96000  },
  { date: '2025-11-10', price: 91000  },
  { date: '2025-11-17', price: 88000  },
  { date: '2025-11-24', price: 87000  },
  { date: '2025-12-01', price: 90000  },
  { date: '2025-12-08', price: 94000  },
  { date: '2025-12-15', price: 92000  },
  { date: '2025-12-22', price: 96000  },
  { date: '2025-12-29', price: 91000  },
  { date: '2026-01-05', price: 92000  },
  { date: '2026-01-12', price: 89000  },
  { date: '2026-01-19', price: 93000  },
  { date: '2026-01-26', price: 87000  },
  { date: '2026-02-02', price: 84000  },
  { date: '2026-02-09', price: 86000  },
  { date: '2026-02-16', price: 89000  },
  { date: '2026-02-23', price: 85000  },
  { date: '2026-03-02', price: 81000  },
  { date: '2026-03-09', price: 68000  },
  { date: '2026-03-16', price: 73000  },
  { date: '2026-03-23', price: 68000  },
  { date: '2026-03-30', price: 67000  },
  { date: '2026-04-06', price: 69000  },
];

export default function AthDcaDashboard({ liveData = null }) {
  const [range, setRange] = useState('all');
  const currentPrice = liveData?.btcPrice || 69000;

  const xFmt = v => { const [,m,d] = v.split('-'); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${mon[+m-1]} ${+d}`; };
  const xInterval = range === '7d' ? 1 : range === '30d' ? 3 : 8;

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

  // Compute rolling 5yr ATH and buy simulation
  const sim = useMemo(() => {
    let rollingAth = 0;
    const events = [];
    let totalInvested = 0;
    let totalBtc = 0;

    const enriched = mockWeeklyPrices.map(({ date, price }) => {
      rollingAth = Math.max(rollingAth, price);
      const triggerPrice = rollingAth * (1 - MIN_DIP);
      const dip = (rollingAth - price) / rollingAth;
      const buySize = computeBuySize(price, rollingAth);
      const bought = buySize !== null;

      if (bought) {
        const btc = buySize / price;
        totalInvested += buySize;
        totalBtc += btc;
        events.push({ date, price, ath: rollingAth, dip: dip * 100, buySize, btc });
      }

      return { date, price, ath: rollingAth, triggerPrice, dip: dip * 100, buySize: buySize || 0, bought };
    });

    const currentAth      = rollingAth;
    const currentDip      = (currentAth - currentPrice) / currentAth;
    const currentBuySize  = computeBuySize(currentPrice, currentAth);
    const positionValue   = totalBtc * currentPrice;
    const pnl             = positionValue - totalInvested;
    const pnlPct          = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const avgBuyPrice     = totalBtc > 0 ? totalInvested / totalBtc : 0;

    return { enriched, events, totalInvested, totalBtc, positionValue, pnl, pnlPct, avgBuyPrice, currentAth, currentDip, currentBuySize };
  }, [currentPrice]);

  // Buy curve data — dip % 0→90, shows the logarithmic shape
  const buyCurve = useMemo(() => {
    const points = [];
    for (let dipPct = 0; dipPct <= 90; dipPct += 1) {
      const dip = dipPct / 100;
      if (dip < MIN_DIP) {
        points.push({ dip: dipPct, buySize: null, zone: 'inactive' });
      } else {
        const ratio    = Math.min((dip - MIN_DIP) / (1.0 - MIN_DIP), 1.0);
        const logRatio = Math.log1p(ratio) / Math.log1p(1);
        const buySize  = Math.round(BASE_USDT + logRatio * (MAX_USDT - BASE_USDT));
        points.push({ dip: dipPct, buySize, zone: 'active' });
      }
    }
    return points;
  }, []);

  const filterByRange = arr => {
    if (range === 'all') return arr;
    const days = range === '30d' ? 30 : 7;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return arr.filter(item => (item.date || '') >= cutoffStr);
  };

  const formatUsd = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  const formatBtc = v => `${v.toFixed(6)} BTC`;

  const currentDipPct = sim.currentDip * 100;
  const inBuyZone     = currentDipPct >= MIN_DIP * 100;

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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">ATH-DCA Bot</h1>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Next Gen · Planning</span>
            </div>
            <p className="mt-1 text-slate-600">
              Logarithmic buy scaling based on distance from 5-year rolling ATH. Simulated history with real current price.
            </p>
          </div>
        </div>

        {/* Current status banner */}
        <Card className={`rounded-2xl border-0 shadow-lg shadow-black/5 ${inBuyZone ? 'bg-emerald-50' : 'bg-slate-100'}`}>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`rounded-xl p-3 ${inBuyZone ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                  <Zap className={`h-5 w-5 ${inBuyZone ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Current Status</p>
                  <p className={`text-lg font-bold ${inBuyZone ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {inBuyZone ? '✅ Buy zone — would trigger this week' : '⏭️ Above threshold — no buy this week'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div><p className="text-slate-500">Current Price</p><p className="font-bold text-slate-900">{formatUsd(currentPrice)}</p></div>
                <div><p className="text-slate-500">5yr Rolling ATH</p><p className="font-bold text-slate-900">{formatUsd(sim.currentAth)}</p></div>
                <div><p className="text-slate-500">Dip from ATH</p><p className={`font-bold ${inBuyZone ? 'text-emerald-600' : 'text-slate-500'}`}>{currentDipPct.toFixed(1)}%</p></div>
                <div><p className="text-slate-500">Would Buy</p><p className={`font-bold ${inBuyZone ? 'text-emerald-600' : 'text-slate-400'}`}>{sim.currentBuySize ? formatUsd(sim.currentBuySize) : '—'}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stat cards — simulated performance */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Simulated BTC Stack"  value={formatBtc(sim.totalBtc)}      subtitle={`${sim.events.length} buys over simulated period`} icon={Bitcoin} />
          <StatCard title="Avg Buy Price"         value={formatUsd(sim.avgBuyPrice)}   subtitle="weighted average across all simulated buys" icon={Target} />
          <StatCard title="Position Value"         value={formatUsd(sim.positionValue)} subtitle={`at current ${formatUsd(currentPrice)}`} icon={Wallet} />
          <StatCard
            title="Simulated P/L"
            value={formatUsd(sim.pnl)}
            valueClassName={sim.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}
            subtitle={`${sim.pnlPct >= 0 ? '+' : ''}${sim.pnlPct.toFixed(1)}% vs ${formatUsd(sim.totalInvested)} invested`}
            icon={sim.pnl >= 0 ? TrendingUp : TrendingDown}
          />
        </div>

        {/* Buy curve + price chart */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* Algorithm curve */}
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle className="text-lg">Buy Size vs Dip from ATH</CardTitle>
              <p className="text-sm text-slate-500">Logarithmic curve — scales fast in realistic crash range, flattens at extreme levels. Vertical line = current position.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={buyCurve}>
                    <defs>
                      <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dip" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} label={{ value: '% below ATH', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => v ? [`$${v}`, 'Buy size'] : ['No buy', '']} labelFormatter={l => `${l}% below ATH`} />
                    <ReferenceLine x={15} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Trigger', fontSize: 10, fill: '#94a3b8' }} />
                    {inBuyZone && <ReferenceLine x={Math.round(currentDipPct)} stroke="#10b981" strokeWidth={2} label={{ value: 'Now', fontSize: 10, fill: '#10b981' }} />}
                    <Area type="monotone" dataKey="buySize" stroke="#7c3aed" strokeWidth={2} fill="url(#buyGrad)" connectNulls={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-slate-500">
                {[[-15,25],[-30,null],[-50,null],[-70,null]].map(([dip]) => {
                  const d = Math.abs(dip) / 100;
                  const size = computeBuySize(sim.currentAth * (1 - d), sim.currentAth);
                  return (
                    <div key={dip} className="rounded-lg bg-slate-50 p-2">
                      <p className="font-medium text-slate-700">{dip}% ATH</p>
                      <p className="text-violet-600 font-bold">{size ? `$${size}` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Price vs ATH over time */}
          <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">BTC Price vs 5yr Rolling ATH</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Orange = BTC price. Grey = ATH. Green dashed = buy trigger (-15%). Dots = simulated buys.</p>
                </div>
                <RangeToggle />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filterByRange(sim.enriched)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={xFmt} interval={xInterval} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v/1000)}k`} domain={['dataMin - 5000', 'dataMax + 5000']} />
                    <Tooltip formatter={(v, name) => [formatUsd(v), name === 'price' ? 'BTC Price' : name === 'ath' ? 'Rolling ATH' : 'Trigger']} labelFormatter={l => `Date: ${l}`} />
                    <Line type="monotone" dataKey="ath"          name="Rolling ATH" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                    <Line type="monotone" dataKey="triggerPrice" name="Trigger -15%" stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="price"        name="BTC Price"   stroke="#f97316" strokeWidth={2.5} dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.bought) return null;
                      return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simulated buy log */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">Simulated Buy Log</CardTitle>
            <p className="text-sm text-slate-500">What the ATH-DCA bot would have bought — mock data, algorithm is real.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">BTC Price</th>
                    <th className="px-4 py-3 font-medium">Rolling ATH</th>
                    <th className="px-4 py-3 font-medium">Dip from ATH</th>
                    <th className="px-4 py-3 font-medium">USDT Spent</th>
                    <th className="px-4 py-3 font-medium">BTC Bought</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.events.map((e, i) => (
                    <tr key={e.date} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 text-slate-700">{e.date}</td>
                      <td className="px-4 py-3 text-slate-700">{formatUsd(e.price)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatUsd(e.ath)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          -{e.dip.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatUsd(e.buySize)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatBtc(e.btc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Algorithm config card */}
        <Card className="rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg">Algorithm Parameters</CardTitle>
            <p className="text-sm text-slate-500">Current configuration — edit in <code className="rounded bg-slate-100 px-1 text-xs">ATH-DCA-BOT/ath_dca.py</code></p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">ATH Window</p>
                <p className="mt-1 text-lg font-bold text-slate-900">5 years</p>
                <p className="text-xs text-slate-400">1,825 daily candles</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">Buy Trigger</p>
                <p className="mt-1 text-lg font-bold text-slate-900">-15% from ATH</p>
                <p className="text-xs text-slate-400">currently {formatUsd(sim.currentAth * 0.85)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">Min Buy (at trigger)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">$25</p>
                <p className="text-xs text-slate-400">at exactly -15%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">Max Buy (theoretical)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">$1,000</p>
                <p className="text-xs text-slate-400">approached logarithmically</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
