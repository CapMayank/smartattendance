'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, ShieldCheck, Info } from 'lucide-react'
import { Button, Card, CardHeader, Field, IconButton, Input, Modal, PageHeader, Select } from '@/components/ui'
import { formatINR } from '@/lib/format'
import { DEFAULT_STATUTORY_RULES, StatutoryRule } from '@/lib/statutory-config'

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
  const [punchRequestMaxDays, setPunchRequestMaxDays] = useState<string>("0")
  const [statutoryRules, setStatutoryRules] = useState<StatutoryRule[]>(DEFAULT_STATUTORY_RULES)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRuleForm, setNewRuleForm] = useState({
    effectiveFromMonth: '',
    epsWageCeiling: 25000,
    edliWageCeiling: 25000,
    pohwThreshold: 25000,
    label: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setPolicy(data))

    fetch('/api/settings?key=PUNCH_REQUEST_MAX_DAYS')
      .then(res => res.json())
      .then(data => {
        if (data?.value !== null && data?.value !== undefined) {
          setPunchRequestMaxDays(String(data.value))
        }
      })
      .catch(() => {})

    fetch('/api/settings?key=STATUTORY_RULES')
      .then(res => res.json())
      .then(data => {
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setStatutoryRules(parsed)
            }
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  const handleChange = (field: keyof Policy, value: string | number) => {
    if (policy) {
      setPolicy({ ...policy, [field]: value })
    }
  }

  const handleAddRule = () => {
    const trimmedMonth = newRuleForm.effectiveFromMonth.trim()
    if (!trimmedMonth || !/^\d{4}-\d{2}$/.test(trimmedMonth)) {
      alert('Please enter a valid effective month in YYYY-MM format (e.g. 2027-04)')
      return
    }

    const epsCeil = Number(newRuleForm.epsWageCeiling) || 25000
    const edliCeil = Number(newRuleForm.edliWageCeiling) || epsCeil
    const pohwThresh = Number(newRuleForm.pohwThreshold) || epsCeil

    const updated = [
      ...statutoryRules.filter(r => r.effectiveFromMonth !== trimmedMonth),
      {
        id: `statutory-${trimmedMonth}`,
        effectiveFromMonth: trimmedMonth,
        epsWageCeiling: epsCeil,
        edliWageCeiling: edliCeil,
        pohwThreshold: pohwThresh,
        pohwSurchargeRate: 0.0116,
        label: newRuleForm.label.trim() || `Statutory Ceiling ${formatINR(epsCeil, { exact: true })} from ${trimmedMonth}`,
      }
    ].sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))

    setStatutoryRules(updated)
    setShowAddRuleModal(false)
    setNewRuleForm({
      effectiveFromMonth: '',
      epsWageCeiling: 25000,
      edliWageCeiling: 25000,
      pohwThreshold: 25000,
      label: '',
    })
  }

  const handleRemoveRule = (id: string) => {
    if (statutoryRules.length <= 1) {
      alert('At least one statutory rule must remain.')
      return
    }
    setStatutoryRules(statutoryRules.filter(r => r.id !== id))
  }

  const handleSave = async () => {
    if (!policy) return
    setSaving(true)
    setMessage('')
    try {
      const [policyRes, maxDaysRes, statutoryRes] = await Promise.all([
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policy)
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'PUNCH_REQUEST_MAX_DAYS',
            value: punchRequestMaxDays,
          }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'STATUTORY_RULES',
            value: JSON.stringify(statutoryRules),
          }),
        }),
      ])

      if (policyRes.ok && maxDaysRes.ok && statutoryRes.ok) {
        setMessage('Settings saved successfully!')
      } else {
        setMessage('Failed to save settings.')
      }
    } catch {
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
        subtitle="Configure attendance rules, tolerances, and statutory payroll parameters."
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

      {/* Provident Fund Statutory Ceilings Card */}
      <Card>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardHeader
            title="Provident Fund (EPF / EPS) Statutory Ceilings"
            caption="Date-versioned wage limits for EPFO statutory contributions"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() => setShowAddRuleModal(true)}
          >
            Add Future Statutory Slab
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-line-soft bg-canvas p-3.5 text-xs text-subtle">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="font-medium text-text">Versioned Statutory Slabs</p>
              <p className="mt-0.5">
                Statutory limits apply based on the payroll month being calculated. Modifying or adding a future slab (e.g. from <code className="rounded bg-card-hi px-1 py-0.5 text-text">2027-04</code>) takes effect strictly for payroll runs from that month onwards, completely preserving the historical calculations of earlier months without code changes.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-canvas text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Effective From Month</th>
                <th className="px-4 py-3 font-medium">EPS Wage Ceiling</th>
                <th className="px-4 py-3 font-medium">EDLI Wage Ceiling</th>
                <th className="px-4 py-3 font-medium">Description / Legal Reference</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {statutoryRules.map((rule) => {
                const isCurrentActive = rule.effectiveFromMonth === '2026-09'
                return (
                  <tr key={rule.id} className="hover:bg-canvas/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="num font-semibold text-text">{rule.effectiveFromMonth}</span>
                        {isCurrentActive && (
                          <span className="tint-badge tone-present inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium">
                            Current Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="num font-medium text-text">
                        {formatINR(rule.epsWageCeiling, { exact: true })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="num font-medium text-text">
                        {formatINR(rule.edliWageCeiling, { exact: true })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {rule.label}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rule.effectiveFromMonth !== '2014-09' && (
                        <IconButton
                          icon={Trash2}
                          label="Delete Rule"
                          onClick={() => handleRemoveRule(rule.id)}
                          className="size-7 text-subtle hover:text-absent"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
        <CardHeader title="Punch request configuration" caption="Staff missed punch regularization window" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Submission cutoff window"
            htmlFor="punchRequestMaxDays"
            helper="Maximum number of days in the past employees can submit missed punch requests for. Select Unlimited to disable strict cutoff."
          >
            <Select
              id="punchRequestMaxDays"
              value={punchRequestMaxDays}
              onChange={(e) => setPunchRequestMaxDays(e.target.value)}
            >
              <option value="0">Unlimited (No cutoff)</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </Select>
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

      {/* Add Future Statutory Slab Modal */}
      <Modal
        open={showAddRuleModal}
        onClose={() => setShowAddRuleModal(false)}
        title="Add Statutory Wage Slab"
        footer={
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" onClick={() => setShowAddRuleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddRule}>
              Add Slab to Timeline
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-subtle">
            Define a new statutory wage ceiling. It will take effect strictly for payroll runs from this effective month onwards, without affecting previous months.
          </p>

          <Field label="Effective From Month (YYYY-MM)" htmlFor="rule-effective-month">
            <Input
              id="rule-effective-month"
              type="text"
              className="num"
              placeholder="e.g. 2027-04"
              value={newRuleForm.effectiveFromMonth}
              onChange={(e) => setNewRuleForm({ ...newRuleForm, effectiveFromMonth: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="EPS Wage Ceiling (₹)" htmlFor="rule-eps-ceiling">
              <Input
                id="rule-eps-ceiling"
                type="number"
                className="num"
                value={newRuleForm.epsWageCeiling}
                onChange={(e) => setNewRuleForm({ ...newRuleForm, epsWageCeiling: Number(e.target.value) })}
              />
            </Field>

            <Field label="EDLI Wage Ceiling (₹)" htmlFor="rule-edli-ceiling">
              <Input
                id="rule-edli-ceiling"
                type="number"
                className="num"
                value={newRuleForm.edliWageCeiling}
                onChange={(e) => setNewRuleForm({ ...newRuleForm, edliWageCeiling: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Description / Gazette Notification" htmlFor="rule-label">
            <Input
              id="rule-label"
              type="text"
              placeholder="e.g. Gazette Notification S.O. 1234(E)"
              value={newRuleForm.label}
              onChange={(e) => setNewRuleForm({ ...newRuleForm, label: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
