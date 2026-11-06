'use client'

import { useState, useEffect } from 'react'
import { Wallet, Search, Edit2, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function StaffPayrollPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingStaff, setEditingStaff] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/payroll/staff')
      const data = await res.json()
      setStaff(data)
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (s: any) => {
    setSaveSuccess(false)
    setEditingStaff(s)
    setEditForm({
      monthlyCtc: s.payrollInfo?.monthlyCtc || 0,
      bankAccount: s.payrollInfo?.bankAccount || '',
      ifsc: s.payrollInfo?.ifsc || '',
      uan: s.payrollInfo?.uan || '',
      nameOnUan: s.payrollInfo?.nameOnUan || '',
      pan: s.payrollInfo?.pan || '',
      aadhaar: s.payrollInfo?.aadhaar || '',
      nameAsPerBank: s.payrollInfo?.nameAsPerBank || '',
      isActiveForPayroll: s.payrollInfo?.isActiveForPayroll !== false
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/payroll/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: editingStaff.id,
          payrollInfo: editForm
        })
      })
      await fetchStaff()
      setSaveSuccess(true)
      setTimeout(() => {
        setEditingStaff(null)
      }, 800)
    } catch (error) {
      console.error('Failed to save payroll info:', error)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.machineId?.toLowerCase().includes(search.toLowerCase()) ||
    s.payrollInfo?.uan?.includes(search)
  )

  const estGross = Math.round((editForm.monthlyCtc || 0) / 1.12);
  const empPf = Math.round(estGross * 0.12);
  const estNet = estGross - empPf;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg border border-white/[0.04]">
            <Wallet className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Staff Payroll Master
            </h1>
            <p className="text-muted mt-1 font-medium">Configure fixed CTC and statutory banking details</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-black/30 border border-white/[0.08] rounded-lg overflow-hidden flex flex-col min-h-[500px] relative">
        {/* Decorative ambient light */}

        <div className="p-5 border-b border-white/[0.08] relative z-10 flex items-center justify-between">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or UAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-lg pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="hidden md:flex text-sm text-subtle gap-6 px-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Active
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              Excluded
            </div>
          </div>
        </div>

        <div className="hidden md:block flex-1 overflow-auto relative z-10 px-4 pb-3">
          <table className="data-table text-sm text-left">
            <thead>
              <tr>
                <th className="px-6 py-3.5 font-semibold tracking-wider">Staff Name</th>
                <th className="px-6 py-3.5 font-semibold tracking-wider text-right">Monthly CTC (₹)</th>
                <th className="px-6 py-3.5 font-semibold tracking-wider">Bank Details</th>
                <th className="px-6 py-3.5 font-semibold tracking-wider">UAN</th>
                <th className="px-6 py-3.5 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-3.5 font-semibold tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-muted font-medium animate-pulse">Loading personnel data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-12 h-12 text-subtle" />
                      <p className="text-muted font-medium">No matching staff found in directory.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id} className="group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-accent border border-white/[0.08] flex items-center justify-center text-sm text-white font-bold shrink-0">
                          {s.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">{s.name}</div>
                          <div className="text-xs text-subtle font-medium">{s.department?.name || 'No Dept'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-block font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md">
                        ₹{s.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}
                      </div>
                      <div className="text-[10px] text-subtle uppercase tracking-wider mt-1">Annual: ₹{((s.payrollInfo?.monthlyCtc || 0) * 12).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-medium font-mono">
                        {s.payrollInfo?.bankAccount || 'Not Set'}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <span className="text-xs text-subtle font-semibold">{s.payrollInfo?.ifsc || 'No IFSC'}</span>
                        {s.payrollInfo?.nameAsPerBank && (
                          <span className="text-[10px] text-blue-400 uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded w-fit">
                            {s.payrollInfo.nameAsPerBank}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-mono tracking-wider">
                        {s.payrollInfo?.uan || 'Not Set'}
                      </div>
                      {s.payrollInfo?.nameOnUan && (
                        <div className="text-[10px] text-blue-400 uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded w-fit mt-1">
                          {s.payrollInfo.nameOnUan}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.payrollInfo?.isActiveForPayroll !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          Excluded
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleEdit(s)}
                        className="inline-flex items-center justify-center w-10 h-10 text-muted hover:text-blue-400 hover:bg-accent-hover/10 bg-black/40 border border-white/[0.08] rounded-md transition-all duration-300 active:scale-95"
                        title="Edit Payroll Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden flex flex-col p-4 gap-4">
          {loading ? (
            <div className="p-12 text-center bg-black/40 rounded-lg border border-white/[0.08]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-muted font-medium animate-pulse">Loading directory...</p>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center bg-black/40 rounded-lg border border-white/[0.08]">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-12 h-12 text-subtle mb-2" />
                <p className="text-slate-300 font-bold text-lg">No Staff Found</p>
                <p className="text-subtle text-sm">No matching staff found in directory.</p>
              </div>
            </div>
          ) : (
            filteredStaff.map((s) => (
              <div key={s.id} className="bg-black/40 border border-white/[0.08] rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden group">
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-lg font-bold text-white border border-white/[0.08] shrink-0">
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-lg leading-tight">{s.name}</span>
                      <span className="text-sm font-medium text-muted">{s.department?.name || 'No Dept'}</span>
                    </div>
                  </div>
                  {s.payrollInfo?.isActiveForPayroll !== false ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      Excluded
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
                  <div className="bg-black/50 p-3 rounded-lg border border-white/[0.04]">
                    <span className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">Monthly CTC</span>
                    <span className="font-bold text-slate-300">₹{s.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}</span>
                    <span className="text-[10px] text-subtle uppercase tracking-wider block mt-0.5">Annual: ₹{((s.payrollInfo?.monthlyCtc || 0) * 12).toLocaleString()}</span>
                  </div>
                  <div className="bg-black/50 p-3 rounded-lg border border-white/[0.04]">
                    <span className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">Bank</span>
                    <span className="font-bold text-slate-300 font-mono text-sm block truncate">{s.payrollInfo?.bankAccount || 'Not Set'}</span>
                    <span className="text-[10px] text-subtle font-semibold block">{s.payrollInfo?.ifsc || 'No IFSC'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.08] relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-subtle uppercase tracking-wider mb-1">UAN</span>
                    <span className="text-slate-300 font-mono text-sm">{s.payrollInfo?.uan || 'Not Set'}</span>
                  </div>
                  <button onClick={() => handleEdit(s)} className="p-2.5 text-muted hover:text-blue-400 hover:bg-accent-hover/10 bg-black/60 border border-white/[0.08] rounded-md transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modern Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-300" onClick={() => !saving && setEditingStaff(null)}></div>
          
          <div className="bg-black/40 border border-white/[0.08] rounded-lg w-full max-w-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/[0.04] bg-black/20 flex items-center justify-between sticky top-0 z-20">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-6 bg-accent rounded-full"></div>
                  Edit Configuration
                </h3>
                <p className="text-sm text-muted mt-1 ml-4">Updating details for <span className="text-slate-200 font-semibold">{editingStaff.name}</span></p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              
              {/* Financial Section */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-subtle mb-4 flex items-center gap-2">
                  <span>Financial Basics</span>
                  <div className="h-px bg-white/5 flex-1"></div>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                        Fixed Monthly CTC (₹)
                      </label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-medium group-focus-within:text-blue-400 transition-colors">₹</span>
                        <input
                          type="number"
                          value={editForm.monthlyCtc === 0 ? '' : editForm.monthlyCtc}
                          onChange={(e) => setEditForm({...editForm, monthlyCtc: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})}
                          className="w-full bg-black/40 border border-white/[0.08] rounded-lg pl-9 pr-4 py-3 text-lg font-medium text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setEditForm({...editForm, isActiveForPayroll: !editForm.isActiveForPayroll})}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${editForm.isActiveForPayroll ? 'bg-accent text-white' : 'bg-black/40 border border-white/20'}`}>
                        {editForm.isActiveForPayroll && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">Active for Payroll</p>
                        <p className="text-xs text-subtle">Include this staff in monthly generation</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Preview Receipt */}
                  <div className="bg-slate-800/80 border border-white/[0.08] rounded-lg p-5 relative overflow-hidden">
                    
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" />
                      31-Day Estimate
                    </p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Gross Wage</span>
                        <span className="font-medium">₹{estGross.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Employee PF <span className="text-[10px] text-subtle uppercase">(12%)</span></span>
                        <span className="text-rose-400 font-medium">-₹{empPf.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Employer Share <span className="text-[10px] text-subtle uppercase">(12%)</span></span>
                        <span className="text-subtle font-medium">₹{empPf.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-white/[0.08] border-dashed flex justify-between items-end">
                      <span className="text-sm font-medium text-muted">Net Payment</span>
                      <span className="text-2xl font-bold text-emerald-400 tracking-tight">₹{estNet.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bank & Statutory Section */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-subtle mb-4 flex items-center gap-2">
                  <span>Bank & Statutory</span>
                  <div className="h-px bg-white/5 flex-1"></div>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">Bank Account</label>
                    <input
                      type="text"
                      value={editForm.bankAccount}
                      onChange={(e) => setEditForm({...editForm, bankAccount: e.target.value})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">IFSC Code</label>
                    <input
                      type="text"
                      value={editForm.ifsc}
                      onChange={(e) => setEditForm({...editForm, ifsc: e.target.value.toUpperCase()})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">Name as per Bank</label>
                    <input
                      type="text"
                      value={editForm.nameAsPerBank}
                      onChange={(e) => setEditForm({...editForm, nameAsPerBank: e.target.value})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">UAN (EPFO)</label>
                    <input
                      type="text"
                      value={editForm.uan}
                      onChange={(e) => setEditForm({...editForm, uan: e.target.value})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm font-mono tracking-wider text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">Name on UAN</label>
                    <input
                      type="text"
                      value={editForm.nameOnUan}
                      onChange={(e) => setEditForm({...editForm, nameOnUan: e.target.value})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">PAN Number</label>
                    <input
                      type="text"
                      value={editForm.pan}
                      onChange={(e) => setEditForm({...editForm, pan: e.target.value.toUpperCase()})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 ml-1 uppercase tracking-wider">Aadhaar</label>
                    <input
                      type="text"
                      value={editForm.aadhaar}
                      onChange={(e) => setEditForm({...editForm, aadhaar: e.target.value})}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-md px-4 py-2.5 text-sm font-mono tracking-wider text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/[0.04] bg-black/40/80 flex justify-end gap-3 items-center">
              {saveSuccess && (
                <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5 mr-auto animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved Successfully
                </span>
              )}
              <button
                onClick={() => setEditingStaff(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-md transition-all  ${
                  saveSuccess 
                    ? 'bg-emerald-500 ' 
                    : 'bg-accent'
                } disabled:opacity-50 disabled: `}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : saveSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
