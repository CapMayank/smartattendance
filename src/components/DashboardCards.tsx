"use client"

import { useState } from 'react'
import { Users, Fingerprint, UserMinus, Clock, Server, X } from 'lucide-react'

type StaffStatus = {
  id: string
  name: string
  machineId: string
  department?: { name: string } | null
  designation?: { name: string } | null
}

type DashboardCardsProps = {
  staffCount: number
  currentlyIn: number
  absentCount: number
  logsCount: number
  onlineDevices: number
  devicesCount: number
  allStaff: StaffStatus[]
  presentStaff: StaffStatus[]
  absentStaff: StaffStatus[]
}

export default function DashboardCards({
  staffCount,
  currentlyIn,
  absentCount,
  logsCount,
  onlineDevices,
  devicesCount,
  allStaff,
  presentStaff,
  absentStaff
}: DashboardCardsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalData, setModalData] = useState<StaffStatus[]>([])

  const openModal = (title: string, data: StaffStatus[]) => {
    setModalTitle(title)
    setModalData(data)
    setModalOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Staff */}
        <div 
          onClick={() => openModal('Total Staff', allStaff)}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 backdrop-blur-xl hover:border-blue-500/50 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Staff</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{staffCount}</h3>
            </div>
          </div>
        </div>

        {/* Currently In */}
        <div 
          onClick={() => openModal('Currently In', presentStaff)}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 backdrop-blur-xl hover:border-emerald-500/50 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Fingerprint className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Currently In</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{currentlyIn}</h3>
            </div>
          </div>
        </div>

        {/* Absent Today */}
        <div 
          onClick={() => openModal('Absent Today', absentStaff)}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 backdrop-blur-xl hover:border-rose-500/50 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <UserMinus className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Absent Today</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{absentCount}</h3>
            </div>
          </div>
        </div>

        {/* Logs Today */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 backdrop-blur-xl hover:border-amber-500/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Logs Today</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{logsCount}</h3>
            </div>
          </div>
        </div>

        {/* Devices Online */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 backdrop-blur-xl hover:border-indigo-500/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl group-hover:scale-110 transition-transform relative">
              <Server className="w-5 h-5 text-indigo-400" />
              {onlineDevices > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse border border-slate-900"></span>}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Devices Online</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{onlineDevices} <span className="text-xs font-normal text-slate-500">/ {devicesCount}</span></h3>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">{modalTitle}</h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
              {modalData.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {modalData.map(staff => (
                    <div key={staff.id} className="p-3 hover:bg-white/5 rounded-lg flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 text-xs font-bold text-white shrink-0">
                          {staff.name.substring(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <span className="font-medium text-slate-200 truncate">{staff.name}</span>
                          <span className="text-xs text-slate-400 truncate">Machine ID: {staff.machineId}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        {staff.department && (
                          <span className="text-xs px-2 py-0.5 bg-white/5 rounded text-slate-300 truncate max-w-[120px]">
                            {staff.department.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>No staff found for this category.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-slate-900/50">
              <p className="text-sm text-slate-400 text-center">Total count: {modalData.length}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
