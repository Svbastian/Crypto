import { useState } from 'react'
import BtcDcaDashboard from './BtcDcaDashboard'
import BtcCrashDashboard from './BtcCrashDashboard'
import BtcSummaryDashboard from './BtcSummaryDashboard'

export default function App() {
  const [active, setActive] = useState('summary')

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'dca',     label: 'DCA Bot' },
    { id: 'crash',   label: 'Crash Bot' },
  ]

  return (
    <>
      <div className="sticky top-0 z-50 flex gap-2 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
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

      {active === 'summary' && <BtcSummaryDashboard />}
      {active === 'dca'     && <BtcDcaDashboard />}
      {active === 'crash'   && <BtcCrashDashboard />}
    </>
  )
}
