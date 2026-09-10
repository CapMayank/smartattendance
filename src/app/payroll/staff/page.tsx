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
    s.payrollInfo?.uan?.includes(search)
  )

  const estGross = Math.round((editForm.monthlyCtc || 0) / 1.12);
  const empPf = Math.round(estGross * 0.12);
  const estNet = estGross - empPf;

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/5 shadow-lg shadow-blue-500/10">
            <Wallet className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Staff Payroll Master
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Configure fixed CTC and statutory banking details</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-14rem)] shadow-2xl relative">
        {/* Decorative ambient light */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="p-5 border-b border-white/10 relative z-10 flex items-center justify-between">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or UAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
            />
          </div>
          <div className="hidden md:flex text-sm text-slate-500 gap-6 px-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Active
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"></span>
              Excluded
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative z-10">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 sticky top-0 backdrop-blur-md border-b border-white/5 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Staff Name</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Monthly CTC (₹)</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Bank Details</th>
                <th className="px-6 py-4 font-semibold tracking-wider">UAN</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Loading personnel data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-12 h-12 text-slate-600" />
                      <p className="text-slate-400 font-medium">No matching staff found in directory.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id} className="group hover:bg-white/[0.03] transition-colors duration-300">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-slate-300 font-bold shadow-inner">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">{s.name}</div>
                          <div className="text-xs text-slate-500 font-medium">{s.department?.name || 'No Dept'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-200">
                        ₹{s.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Annual: ₹{((s.payrollInfo?.monthlyCtc || 0) * 12).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-medium font-mono">
                        {s.payrollInfo?.bankAccount || 'Not Set'}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <span className="text-xs text-slate-500 font-semibold">{s.payrollInfo?.ifsc || 'No IFSC'}</span>
                        {s.payrollInfo?.nameAsPerBank && (
                          <span className="text-[10px] text-blue-400 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded w-fit">
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
                        <div className="text-[10px] text-purple-400 uppercase tracking-widest bg-purple-500/10 px-1.5 py-0.5 rounded w-fit mt-1">
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
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
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
      </div>

      {/* Modern Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !saving && setEditingStaff(null)}></div>
          
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/5 bg-slate-900/50 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                  Edit Configuration
                </h3>
                <p className="text-sm text-slate-400 mt-1 ml-4">Updating details for <span className="text-slate-200 font-semibold">{editingStaff.name}</span></p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              
              {/* Financial Section */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
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
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium group-focus-within:text-blue-400 transition-colors">₹</span>
                        <input
                          type="number"
                          value={editForm.monthlyCtc}
                          onChange={(e) => setEditForm({...editForm, monthlyCtc: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-lg font-medium text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setEditForm({...editForm, isActiveForPayroll: !editForm.isActiveForPayroll})}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${editForm.isActiveForPayroll ? 'bg-blue-500 text-white' : 'bg-slate-800 border border-white/20'}`}>
                        {editForm.isActiveForPayroll && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">Active for Payroll</p>
                        <p className="text-xs text-slate-500">Include this staff in monthly generation</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Preview Receipt */}
                  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
                    
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" />
                      31-Day Estimate
                    </p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Gross Wage</span>
                        <span className="font-medium">₹{estGross.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Employee PF <span className="text-[10px] text-slate-500 uppercase">(12%)</span></span>
                        <span className="text-rose-400 font-medium">-₹{empPf.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Employer Share <span className="text-[10px] text-slate-500 uppercase">(12%)</span></span>
                        <span className="text-slate-500 font-medium">₹{empPf.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-white/10 border-dashed flex justify-between items-end">
                      <span className="text-sm font-medium text-slate-400">Net Payment</span>
                      <span className="text-2xl font-bold text-emerald-400 tracking-tight">₹{estNet.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bank & Statutory Section */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                  <span>Bank & Statutory</span>
                  <div className="h-px bg-white/5 flex-1"></div>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">Bank Account</label>
                    <input
                      type="text"
                      value={editForm.bankAccount}
                      onChange={(e) => setEditForm({...editForm, bankAccount: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">IFSC Code</label>
                    <input
                      type="text"
                      value={editForm.ifsc}
                      onChange={(e) => setEditForm({...editForm, ifsc: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">Name as per Bank</label>
                    <input
                      type="text"
                      value={editForm.nameAsPerBank}
                      onChange={(e) => setEditForm({...editForm, nameAsPerBank: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">UAN (EPFO)</label>
                    <input
                      type="text"
                      value={editForm.uan}
                      onChange={(e) => setEditForm({...editForm, uan: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">Name on UAN</label>
                    <input
                      type="text"
                      value={editForm.nameOnUan}
                      onChange={(e) => setEditForm({...editForm, nameOnUan: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">PAN Number</label>
                    <input
                      type="text"
                      value={editForm.pan}
                      onChange={(e) => setEditForm({...editForm, pan: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">Aadhaar</label>
                    <input
                      type="text"
                      value={editForm.aadhaar}
                      onChange={(e) => setEditForm({...editForm, aadhaar: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/5 bg-slate-900/80 backdrop-blur-md flex justify-end gap-3 items-center">
              {saveSuccess && (
                <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5 mr-auto animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved Successfully
                </span>
              )}
              <button
                onClick={() => setEditingStaff(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${
                  saveSuccess 
                    ? 'bg-emerald-500 shadow-emerald-500/20' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5'
                } disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-lg`}
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
