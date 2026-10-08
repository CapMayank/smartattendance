'use client'

import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

type Policy = {
  id: string
  name: string
  earlyArrivalAllow: string
  maxOtAllow: string
  otHalfCOffFrom: string
  otHalfCOffTo: string
  otFullCOffFrom: string
  otFullCOffTo: string
  lateArrivalAllow: string
  earlyDepartureAllow: string
  earlyArrivalIgnore: string
  lateDepartureIgnore: string
  overTimeIgnore: string
  noOfLate: number
  halfDayIfLateHrsGreaterThan: string
  halfDayIfWorkHrsLessThan: string
  absentIfLateHrsGreaterThan: string
  absentIfWorkHrsLessThan: string
  shiftHrsForOtCalculation: string
  overtimePaymentMultiplier: number
  allInOut: string
  weekOffDays: string
}

export default function SettingsPage() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setPolicy(data))
  }, [])

  const handleChange = (field: keyof Policy, value: string | number) => {
    if (policy) {
      setPolicy({ ...policy, [field]: value })
    }
  }

  const handleSave = async () => {
    if (!policy) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      })
      if (res.ok) {
        setMessage('Settings saved successfully!')
      } else {
        setMessage('Failed to save settings.')
      }
    } catch (e) {
      setMessage('Error saving settings.')
    }
    setSaving(false)
  }

  if (!policy) {
    return <div className="text-white text-center py-10">Loading settings...</div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/[0.05] rounded-2xl border border-white/[0.06]">
            <Save className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-100">
              Global Policy Settings
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Configure attendance rules, rules, and tolerances.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center justify-center animate-in slide-in-from-top-2 backdrop-blur-xl ${message.includes('successfully') ? 'bg-emerald-500/[0.1] text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/[0.1] text-rose-400 border border-rose-500/20'}`}>
          {message}
        </div>
      )}

      <div className="bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.3)] space-y-12">
        
        {/* Punch Processing Logic */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-100">Device Punch Logic</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Punch Interpretation</label>
              <select value={policy.allInOut} onChange={e => handleChange('allInOut', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15 transition-all appearance-none cursor-pointer">
                <option value="First IN Last OUT">First IN Last OUT (Default)</option>
                <option value="All IN Last OUT">All IN Last OUT</option>
              </select>
              <p className="text-xs text-slate-600 ml-1 mt-2 font-medium">
                Determines how raw biometric punches are calculated. 
                <br/>• <span className="text-slate-500">First IN Last OUT</span>: The very first punch of the day is IN, the absolute latest is OUT.
                <br/>• <span className="text-slate-500">All IN Last OUT</span>: Every punch except the last one is recorded as an IN.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Weekly Off Days</label>
              <input type="text" placeholder="e.g. 0 for Sunday, 0,6 for Sun & Sat" value={policy.weekOffDays || ''} onChange={e => handleChange('weekOffDays', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15 transition-all" />
              <p className="text-xs text-slate-600 ml-1 mt-2 font-medium">
                Comma separated day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
                <br/>These days will be marked as <span className="text-emerald-400/80">WEEKOFF</span> instead of <span className="text-rose-400/80">ABSENT</span> if no punch is found.
              </p>
            </div>
          </div>
        </section>

        {/* General Allowances */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-100">Allowances &amp; Grace Periods</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Early Arrival Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyArrivalAllow} onChange={e => handleChange('earlyArrivalAllow', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 transition-all font-mono text-center tracking-widest text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Time before shift start.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Late Arrival Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.lateArrivalAllow} onChange={e => handleChange('lateArrivalAllow', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 transition-all font-mono text-center tracking-widest text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Grace period for late entry.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Early Departure Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyDepartureAllow} onChange={e => handleChange('earlyDepartureAllow', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 transition-all font-mono text-center tracking-widest text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Grace period for leaving early.</p>
            </div>
          </div>
        </section>

        {/* Overtime Policies */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-100">Overtime Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Max OT Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.maxOtAllow} onChange={e => handleChange('maxOtAllow', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 transition-all font-mono text-center tracking-widest text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Cap on daily OT.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">OT Threshold Hrs</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.shiftHrsForOtCalculation} onChange={e => handleChange('shiftHrsForOtCalculation', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 transition-all font-mono text-center tracking-widest text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Base shift length before OT begins.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">OT Multiplier</label>
              <input type="number" step="0.1" value={policy.overtimePaymentMultiplier} onChange={e => handleChange('overtimePaymentMultiplier', parseFloat(e.target.value))} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-slate-200 font-medium focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 transition-all text-center text-lg" />
              <p className="text-xs text-slate-600 ml-1 font-medium text-center">Wage multiplier for OT hours.</p>
            </div>
          </div>
        </section>

        {/* Penalties */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-rose-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-100">Penalties &amp; Deductions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1 text-center block">Half Day if Late &gt;</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfLateHrsGreaterThan} onChange={e => handleChange('halfDayIfLateHrsGreaterThan', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-rose-300 font-medium focus:outline-none focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/15 transition-all font-mono text-center tracking-widest" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1 text-center block">Half Day if Work &lt;</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfWorkHrsLessThan} onChange={e => handleChange('halfDayIfWorkHrsLessThan', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-rose-300 font-medium focus:outline-none focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/15 transition-all font-mono text-center tracking-widest" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1 text-center block">Absent if Late &gt;</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfLateHrsGreaterThan} onChange={e => handleChange('absentIfLateHrsGreaterThan', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-rose-400 font-medium focus:outline-none focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/15 transition-all font-mono text-center tracking-widest" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1 text-center block">Absent if Work &lt;</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfWorkHrsLessThan} onChange={e => handleChange('absentIfWorkHrsLessThan', e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-rose-400 font-medium focus:outline-none focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/15 transition-all font-mono text-center tracking-widest" />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
