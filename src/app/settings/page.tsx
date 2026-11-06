'use client'

import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui'

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
    return <div className="py-10 text-center text-muted">Loading settings...</div>
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Policy settings"
        subtitle="Configure attendance rules and tolerances."
        actions={<Button icon={Save} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>}
      />

      {message && (
        <div
          role="status"
          className={`flex items-center justify-center rounded-xl border px-4 py-3 text-sm ${message.includes('successfully') ? 'border-present/30 bg-present/10 text-present' : 'border-absent/30 bg-absent/10 text-absent'}`}
        >
          {message}
        </div>
      )}

      <Card>
        <CardHeader title="Device punch logic" caption="How raw biometric punches are read" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Punch interpretation"
            htmlFor="allInOut"
            helper={
              <>
                Determines how raw biometric punches are calculated.
                <br />First IN Last OUT: the very first punch of the day is IN, the absolute latest is OUT.
                <br />All IN Last OUT: every punch except the last one is recorded as an IN.
              </>
            }
          >
            <Select id="allInOut" value={policy.allInOut} onChange={e => handleChange('allInOut', e.target.value)}>
              <option value="First IN Last OUT">First IN Last OUT (Default)</option>
              <option value="All IN Last OUT">All IN Last OUT</option>
            </Select>
          </Field>

          <Field
            label="Weekly off days"
            htmlFor="weekOffDays"
            helper={<>Comma separated day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday). These days are marked <b className="font-medium text-text">WEEKOFF</b> instead of <b className="font-medium text-text">ABSENT</b> if no punch is found.</>}
          >
            <Input id="weekOffDays" type="text" className="num" placeholder="e.g. 0 for Sunday, 0,6 for Sun & Sat" value={policy.weekOffDays || ''} onChange={e => handleChange('weekOffDays', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Allowances & grace periods" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field label="Early arrival allow" htmlFor="earlyArrivalAllow" helper="Time before shift start.">
            <Input id="earlyArrivalAllow" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyArrivalAllow} onChange={e => handleChange('earlyArrivalAllow', e.target.value)} />
          </Field>
          <Field label="Late arrival allow" htmlFor="lateArrivalAllow" helper="Grace period for late entry.">
            <Input id="lateArrivalAllow" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.lateArrivalAllow} onChange={e => handleChange('lateArrivalAllow', e.target.value)} />
          </Field>
          <Field label="Early departure allow" htmlFor="earlyDepartureAllow" helper="Grace period for leaving early.">
            <Input id="earlyDepartureAllow" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.earlyDepartureAllow} onChange={e => handleChange('earlyDepartureAllow', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Overtime settings" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field label="Max OT allow" htmlFor="maxOtAllow" helper="Cap on daily OT.">
            <Input id="maxOtAllow" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.maxOtAllow} onChange={e => handleChange('maxOtAllow', e.target.value)} />
          </Field>
          <Field label="OT threshold hrs" htmlFor="shiftHrsForOtCalculation" helper="Base shift length before OT begins.">
            <Input id="shiftHrsForOtCalculation" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.shiftHrsForOtCalculation} onChange={e => handleChange('shiftHrsForOtCalculation', e.target.value)} />
          </Field>
          <Field label="OT multiplier" htmlFor="overtimePaymentMultiplier" helper="Wage multiplier for OT hours.">
            <Input id="overtimePaymentMultiplier" type="number" className="num" step="0.1" value={policy.overtimePaymentMultiplier} onChange={e => handleChange('overtimePaymentMultiplier', parseFloat(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Penalties & deductions" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Half day if late >" htmlFor="halfDayIfLateHrsGreaterThan" helper="Late by more than this.">
            <Input id="halfDayIfLateHrsGreaterThan" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfLateHrsGreaterThan} onChange={e => handleChange('halfDayIfLateHrsGreaterThan', e.target.value)} />
          </Field>
          <Field label="Half day if work <" htmlFor="halfDayIfWorkHrsLessThan" helper="Worked less than this.">
            <Input id="halfDayIfWorkHrsLessThan" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.halfDayIfWorkHrsLessThan} onChange={e => handleChange('halfDayIfWorkHrsLessThan', e.target.value)} />
          </Field>
          <Field label="Absent if late >" htmlFor="absentIfLateHrsGreaterThan" helper="Late by more than this.">
            <Input id="absentIfLateHrsGreaterThan" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfLateHrsGreaterThan} onChange={e => handleChange('absentIfLateHrsGreaterThan', e.target.value)} />
          </Field>
          <Field label="Absent if work <" htmlFor="absentIfWorkHrsLessThan" helper="Worked less than this.">
            <Input id="absentIfWorkHrsLessThan" type="text" className="num" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={policy.absentIfWorkHrsLessThan} onChange={e => handleChange('absentIfWorkHrsLessThan', e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  )
}
