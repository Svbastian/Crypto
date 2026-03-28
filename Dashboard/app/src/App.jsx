import { useState } from 'react'
import BtcDcaDashboard from './BtcDcaDashboard'
import BtcCrashDashboard from './BtcCrashDashboard'

export default function App() {
  const [active, setActive] = useState('dca')

  return (
    <>
      <div className="sticky top-0 z-50 flex gap-2 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <button
          onClick={() => setActive('dca')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active === 'dca' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          DCA Bot
        </button>
        <button
          onClick={() => setActive('crash')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active === 'crash' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Crash Bot
        </button>
      </div>

      {active === 'dca'   && <BtcDcaDashboard />}
      {active === 'crash' && <BtcCrashDashboard />}
    </>
  )
}
