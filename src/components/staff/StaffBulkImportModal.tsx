'use client'

import { useState, useRef } from 'react'
import { Modal, Button } from '@/components/ui'
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { type IssuedCredential } from './StaffOnboardModal'

type StaffBulkImportModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: (credentials: IssuedCredential[]) => void
}

export function StaffBulkImportModal({ open, onClose, onSuccess }: StaffBulkImportModalProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Machine ID,Joining Date,Department,Designation,Shift,Pay Group\nJohn Doe,1001,2026-04-01,Teaching,Senior Teacher,General Shift,BANK_EPF\nJane Smith,1002,2026-04-01,Administration,Coordinator,General Shift,CASH'
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'staff_onboarding_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/staff/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data }),
          })
          const data = await res.json().catch(() => null)
          if (res.ok && data) {
            toast.success(`Successfully imported ${data.processedCount} staff members!`)
            const creds = Array.isArray(data.generatedCredentials) ? data.generatedCredentials : []
            onSuccess(creds)
            onClose()
          } else {
            const firstErr =
              Array.isArray(data?.errors) && data.errors.length > 0
                ? `Row ${data.errors[0].row} (Machine #${data.errors[0].machineId}): ${data.errors[0].error}`
                : data?.error || 'Failed to import data. Please check CSV format.'
            toast.error(firstErr)
          }
        } catch {
          toast.error('An error occurred during import.')
        } finally {
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setUploading(false)
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk CSV Onboarding"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card-hi p-3.5">
          <span className="grid size-11 flex-none place-items-center rounded-xl border border-line bg-card text-muted">
            <FileSpreadsheet size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-[14px] font-medium text-text">Batch Import Members</h3>
            <p className="text-xs text-subtle">
              Upload a spreadsheet with joining dates to auto-assign SAR-YYYY-NNN IDs and generate one-time credentials.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-soft bg-canvas p-3.5 text-xs text-muted">
          <p className="font-medium text-text">Instructions &amp; Supported Columns</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-subtle">
            <li>
              Required columns: <b className="text-text">Name</b>, <b className="text-text">Machine ID</b>, and{' '}
              <b className="text-text">Joining Date</b> (YYYY-MM-DD).
            </li>
            <li>
              Optional columns: <span className="text-text">Department</span>, <span className="text-text">Designation</span>,{' '}
              <span className="text-text">Shift</span>, <span className="text-text">Pay Group</span> (BANK_EPF or CASH).
            </li>
            <li>Members with valid joining dates automatically receive their employee codes and temporary passwords.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" icon={Download} onClick={downloadTemplate} className="w-full">
            Download CSV Template
          </Button>

          <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line bg-card px-4 text-[13.5px] font-medium text-muted transition-colors duration-150 hover:border-subtle hover:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-acc-2 has-disabled:cursor-not-allowed has-disabled:opacity-50">
            <Upload size={16} aria-hidden="true" />
            <span>{uploading ? 'Processing CSV...' : 'Select CSV File'}</span>
            <input
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={uploading}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}
