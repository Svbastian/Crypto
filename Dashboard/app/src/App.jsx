import { useState } from 'react'
import BtcDcaDashboard from './BtcDcaDashboard'
import BtcCrashDashboard from './BtcCrashDashboard'
import BtcSummaryDashboard from './BtcSummaryDashboard'
import { useLiveData } from './hooks/useLiveData'

export default function App() {
  const [active, setActive]   = useState('summary')
  const [isLive, setIsLive]   = useState(false)
  const { data, loading, error, lastUpdated, refresh } = useLiveData()

  const tabs = [
    { id: 'summary', label: 'Summary'   },
    { id: 'dca',     label: 'DCA Bot'   },
    { id: 'crash',   label: 'Crash Bot' },
  ]

  const liveData = isLive ? data : null

  return (
    <>
      <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        {/* Tab buttons */}
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Live status */}
        {isLive && (
          <div className="flex items-center gap-2 text-sm">
            {loading && <span className="text-slate-400">Updating…</span>}
            {error   && <span className="text-amber-500 text-xs">⚠ API offline</span>}
            {!error && data && <span className="flex items-center gap-1.5 text-emerald-600"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Live</span>}
            {lastUpdated && <span className="text-slate-400 text-xs">{lastUpdated.toLocaleTimeString()}</span>}
            <button onClick={refresh} className="rounded-lg bg-slate-100 p-1.5 hover:bg-slate-200 transition text-slate-600 text-xs">↻</button>
          </div>
        )}

        {/* Demo / Live toggle */}
        <button
          onClick={() => setIsLive(v => !v)}
          className={`rounded-xl px-4 py-2 text-sm font-medium border transition ${isLive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          {isLive ? '● Live' : '○ Demo'}
        </button>
      </div>

      {active === 'summary' && <BtcSummaryDashboard liveData={liveData} />}
      {active === 'dca'     && <BtcDcaDashboard     liveData={liveData} />}
      {active === 'crash'   && <BtcCrashDashboard   liveData={liveData} />}
    </>
  )
}
