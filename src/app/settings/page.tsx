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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Global Policy Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Configure attendance rules and tolerances.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.includes('successfully') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
          {message}
        </div>
      )}

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-8">
        
        {/* Punch Processing Logic */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Device Punch Logic</h2>
          <div className="grid grid-cols-1 gap-6">
            <div className="md:w-1/2">
              <label className="block text-sm font-medium text-slate-200 mb-1">Punch In/Out Interpretation</label>
              <select value={policy.allInOut} onChange={e => handleChange('allInOut', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1">
                <option value="First IN Last OUT">First IN Last OUT (Default)</option>
                <option value="All IN Last OUT">All IN Last OUT</option>
              </select>
              <p className="text-xs text-slate-500">
                Determines how raw biometric punches are calculated. 
                <br/>• <b>First IN Last OUT</b>: The very first punch of the day is IN, the absolute latest is OUT.
                <br/>• <b>All IN Last OUT</b>: Every punch except the last one is recorded as an IN.
              </p>
            </div>
            
            <div className="md:w-1/2">
              <label className="block text-sm font-medium text-slate-200 mb-1">Weekly Off Days</label>
              <input type="text" placeholder="e.g. 0 for Sunday, 0,6 for Sun & Sat" value={policy.weekOffDays || ''} onChange={e => handleChange('weekOffDays', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">
                Comma separated day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
                <br/>These days will be marked as WEEKOFF instead of ABSENT if no punch is found.
              </p>
            </div>
          </div>
        </section>

        {/* General Allowances */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Allowances & Grace Periods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Early Arrival Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyArrivalAllow} onChange={e => handleChange('earlyArrivalAllow', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Allowed time before shift start. E.g. 02:00 allows arriving 2 hours early without penalty.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Late Arrival Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.lateArrivalAllow} onChange={e => handleChange('lateArrivalAllow', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Grace period for arriving late. E.g. 00:15 gives a 15-minute grace period.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Early Departure Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyDepartureAllow} onChange={e => handleChange('earlyDepartureAllow', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Grace period for leaving early. E.g. 00:10 allows leaving 10 minutes early.</p>
            </div>
          </div>
        </section>

        {/* Overtime Policies */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Overtime Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Max OT Allow</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.maxOtAllow} onChange={e => handleChange('maxOtAllow', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Cap on daily overtime. E.g. 08:00 caps OT at 8 hours maximum.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Shift Hrs For OT Calculation</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.shiftHrsForOtCalculation} onChange={e => handleChange('shiftHrsForOtCalculation', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Base shift length before OT begins. E.g. 08:00 means anything over 8 hours is OT.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Overtime Payment Multiplier</label>
              <input type="number" step="0.1" value={policy.overtimePaymentMultiplier} onChange={e => handleChange('overtimePaymentMultiplier', parseFloat(e.target.value))} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Wage multiplier for OT hours. E.g. 1.5 means time-and-a-half.</p>
            </div>
          </div>
        </section>

        {/* Penalties */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Penalties & Deductions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Half Day If Late Hrs Greater Than</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfLateHrsGreaterThan} onChange={e => handleChange('halfDayIfLateHrsGreaterThan', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Late threshold for half-day mark. E.g. 03:00 means 3hrs late = half-day.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Half Day If Work Hrs Less Than</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfWorkHrsLessThan} onChange={e => handleChange('halfDayIfWorkHrsLessThan', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Minimum hours for full-day. E.g. 06:00 means &lt;6 hours worked = half-day.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Absent If Late Hrs Greater Than</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfLateHrsGreaterThan} onChange={e => handleChange('absentIfLateHrsGreaterThan', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Late threshold for full absence. E.g. 05:00 means 5hrs late = absent.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Absent If Work Hrs Less Than</label>
              <input type="text" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfWorkHrsLessThan} onChange={e => handleChange('absentIfWorkHrsLessThan', e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-white mb-1" />
              <p className="text-xs text-slate-500">Minimum hours to avoid absence. E.g. 04:00 means &lt;4 hours worked = absent.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
