'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, Tabs, Card } from '@/components/ui';
import { StaffProfileModal } from '@/components/staff/StaffProfileModal';
import { EpfoOverviewTab } from './EpfoOverviewTab';
import { EpfoRegistrationTab } from './EpfoRegistrationTab';
import { EpfoKycTab } from './EpfoKycTab';
import { EpfoExitTab } from './EpfoExitTab';
import { EpfoEcrHistoryTab } from './EpfoEcrHistoryTab';
import { EpfoAllMembersTab } from './EpfoAllMembersTab';
import { EpfoFeedback } from './epfo-shared';
import { parseTab, tabCounts, type EpfoPageTab } from './epfo-tabs';
import { useEpfoMembers } from './use-epfo-members';

export function EpfoPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  const [refreshKey, setRefreshKey] = useState(0);
  const epfo = useEpfoMembers({ refreshTrigger: refreshKey });
  const [ecrMonths, setEcrMonths] = useState(0);

  // Profile "Fix details" modal needs the full staff record and lookup lists.
  const [fullStaff, setFullStaff] = useState<any[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [desigs, setDesigs] = useState<{ id: string; name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([]);
  const [fixStaff, setFixStaff] = useState<any | null>(null);
  const [fixTab, setFixTab] = useState<'statutory' | 'kyc'>('statutory');
  const [fixFields, setFixFields] = useState<string[]>([]);

  const loadMeta = async () => {
    try {
      const [d, des, sh, st, ecr] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/designations'),
        fetch('/api/shifts'),
        fetch('/api/staff'),
        fetch('/api/payroll/epfo/ecr'),
      ]);
      if (d.ok) setDepts(await d.json());
      if (des.ok) setDesigs(await des.json());
      if (sh.ok) setShifts(await sh.json());
      if (st.ok) setFullStaff(await st.json());
      if (ecr.ok) setEcrMonths(((await ecr.json()).months || []).length);
    } catch {
      // lookups are best-effort; the modal still opens from the member row
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const counts = tabCounts(epfo.counts, ecrMonths);

  const setTab = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'overview') params.delete('tab');
    else params.set('tab', id);
    const q = params.toString();
    router.replace(`${pathname}${q ? `?${q}` : ''}`);
  };

  const onFixMember = (staffId: string, initialTab: 'statutory' | 'kyc', fields: string[]) => {
    const row = epfo.members.find((m) => m.id === staffId);
    const target =
      fullStaff.find((s) => s.id === staffId) ||
      (row ? { ...row, payrollInfo: row.payrollInfo || {}, employmentPeriods: row.employmentPeriods || [] } : null);
    if (!target) return;
    setFixStaff(target);
    setFixTab(initialTab);
    setFixFields(fields);
  };

  const afterProfileChange = () => {
    setRefreshKey((k) => k + 1);
    loadMeta();
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'registration', label: 'New joinee registration', count: counts.registration },
    { id: 'kyc', label: 'KYC', count: counts.kyc },
    { id: 'exit', label: 'Exit (bulk)', count: counts.exit },
    { id: 'ecr', label: 'ECR history', count: counts.ecr },
    { id: 'all', label: 'All members', count: counts.all },
  ];

  const tabProps = { epfo, onFixMember };

  return (
    <div className="space-y-4">
      <PageHeader
        title="EPFO compliance"
        subtitle="Register new joinees, mark exits and seed KYC on the EPFO portal, and review every ECR filed."
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <EpfoFeedback epfo={epfo} />

      {tab === 'overview' && (
        <EpfoOverviewTab
          refreshTrigger={refreshKey + epfo.members.length}
          onOpenTab={(t: EpfoPageTab) => setTab(t)}
          onFixMember={onFixMember}
        />
      )}
      {tab === 'registration' && <Card className="overflow-hidden !p-0"><EpfoRegistrationTab {...tabProps} /></Card>}
      {tab === 'kyc' && <Card className="overflow-hidden !p-0"><EpfoKycTab {...tabProps} /></Card>}
      {tab === 'exit' && <Card className="overflow-hidden !p-0"><EpfoExitTab {...tabProps} /></Card>}
      {tab === 'ecr' && <Card className="overflow-hidden !p-0"><EpfoEcrHistoryTab /></Card>}
      {tab === 'all' && <Card className="overflow-hidden !p-0"><EpfoAllMembersTab {...tabProps} /></Card>}

      <p className="text-xs text-subtle">
        Bank and EPFO identifiers are edited in the{' '}
        <Link href="/staff" className="text-acc-1 hover:underline">Staff directory</Link>.
      </p>

      {fixStaff && (
        <StaffProfileModal
          staff={fixStaff}
          open
          onClose={() => setFixStaff(null)}
          onSaved={afterProfileChange}
          onDeleted={() => {
            setFixStaff(null);
            afterProfileChange();
          }}
          depts={depts}
          desigs={desigs}
          shifts={shifts}
          initialTab={fixTab}
          highlightedFields={fixFields}
        />
      )}
    </div>
  );
}
