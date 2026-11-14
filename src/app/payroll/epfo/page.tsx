import { Suspense } from 'react'
import { EpfoPageClient } from '@/components/payroll/epfo/EpfoPageClient'

export default function EpfoCompliancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-subtle">Loading EPFO compliance...</div>}>
      <EpfoPageClient />
    </Suspense>
  )
}
