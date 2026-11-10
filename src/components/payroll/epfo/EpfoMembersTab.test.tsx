import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportSummaryDialog } from './ExportSummaryDialog';
import { MarkExitDialog } from './MarkExitDialog';
import { EpfoMembersTab } from './EpfoMembersTab';

describe('EPFO Members UI Components', () => {
  describe('ExportSummaryDialog', () => {
    it('renders ready members count, skipped members with reasons, and EPFO verification notice', () => {
      const html = renderToStaticMarkup(
        <ExportSummaryDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          exportType="reg"
          readyMembers={[{ id: 's1', name: 'Ramesh Kumar', uan: '100234567890' }]}
          skippedMembers={[
            {
              id: 's2',
              name: 'Priya Sharma',
              reasons: ['Date of birth is required', 'Aadhaar must be a 12-digit number'],
            },
          ]}
        />
      );

      expect(html).toContain('Export New Member Registration');
      expect(html).toContain('1 ready for export');
      expect(html).toContain('1 skipped');
      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Date of birth is required');
      expect(html).toContain('EPFO Portal Verification Notice');
    });
  });

  describe('MarkExitDialog', () => {
    it('renders read-only Last Working Day, reason selector, and non-blocking payroll unlock warning', () => {
      const html = renderToStaticMarkup(
        <MarkExitDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          members={[
            {
              id: 's3',
              name: 'Sunil Gupta',
              uan: '100234567890',
              lastWorkingDay: '2026-10-31',
              defaultExitCode: 'C',
              exitMonthPayrollLocked: false,
            },
          ]}
        />
      );

      expect(html).toContain('Mark Exit for EPF Leavers');
      expect(html).toContain('Sunil Gupta');
      expect(html).toContain('31/10/2026');
      expect(html).toContain('Last working day cannot be edited here');
      expect(html).toContain('Warning: Payroll for exit month (10/2026) is not yet locked');
      expect(html).toContain('Cessation (Short service)');
    });
  });

  describe('EpfoMembersTab', () => {
    const mockInitialData = {
      members: [
        {
          id: 's-reg',
          machineId: '101',
          employeeCode: 'SAR-2026-001',
          name: 'Priya Sharma',
          joiningDate: '2026-09-01',
          nextAction: 'NEEDS_REGISTRATION' as const,
          readiness: {
            ready: false,
            errors: [
              { field: 'dob', message: 'Date of birth is required' },
              { field: 'aadhaar', message: 'Aadhaar must be a 12-digit number' },
            ],
          },
          payrollInfo: { payGroup: 'BANK_EPF', uan: null },
          employmentPeriods: [{ id: 'p1', startDate: '2026-09-01', endDate: null }],
          defaultExitCode: null,
          exitMonthPayrollLocked: false,
        },
        {
          id: 's-uan',
          machineId: '102',
          employeeCode: 'SAR-2026-002',
          name: 'Anil Verma',
          joiningDate: '2026-09-01',
          nextAction: 'AWAITING_UAN' as const,
          readiness: { ready: false, errors: [{ field: 'uan', message: 'UAN is awaiting entry' }] },
          payrollInfo: { payGroup: 'BANK_EPF', uan: '' },
          employmentPeriods: [{ id: 'p2', startDate: '2026-09-01', endDate: null, epfoJoinExportedAt: '2026-09-10' }],
          defaultExitCode: null,
          exitMonthPayrollLocked: false,
        },
        {
          id: 's-exit',
          machineId: '103',
          employeeCode: 'SAR-2026-003',
          name: 'Sunil Gupta',
          joiningDate: '2026-01-01',
          nextAction: 'NEEDS_EXIT' as const,
          readiness: { ready: true, errors: [] },
          payrollInfo: { payGroup: 'BANK_EPF', uan: '100234567890' },
          employmentPeriods: [
            {
              id: 'p3',
              startDate: '2026-01-01',
              endDate: '2026-10-31',
              exitReason: 'RESIGNATION',
              epfoJoinExportedAt: '2026-01-15',
              epfoExitExportedAt: null,
              epfoExitCode: null,
            },
          ],
          defaultExitCode: 'C' as const,
          exitMonthPayrollLocked: false,
        },
      ],
      counts: {
        NEEDS_REGISTRATION: 1,
        AWAITING_UAN: 1,
        NEEDS_EXIT: 1,
        NEEDS_KYC: 0,
        UP_TO_DATE: 0,
        HIDDEN: 0,
      },
    };

    it('renders queue chips, member rows, and missing readiness badges', () => {
      const html = renderToStaticMarkup(
        <EpfoMembersTab
          initialData={mockInitialData}
          onFixMember={vi.fn()}
        />
      );

      expect(html).toContain('Needs registration');
      expect(html).toContain('Awaiting UAN');
      expect(html).toContain('Needs exit');
      expect(html).toContain('KYC pending');
      expect(html).toContain('Up to date');
      expect(html).toContain('All EPF');

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('SAR-2026-001');
      expect(html).toContain('2 missing');
      expect(html).toContain('Fix');

      expect(html).toContain('Mark as already filed');
    });

    it('renders inline UAN input when viewing Awaiting UAN members', () => {
      const html = renderToStaticMarkup(
        <EpfoMembersTab
          initialData={mockInitialData}
          initialQueue="AWAITING_UAN"
          onFixMember={vi.fn()}
        />
      );

      expect(html).toContain('Anil Verma');
      expect(html).toContain('placeholder="Enter 12-digit UAN"');
      expect(html).toContain('Save UAN');
    });

    it('renders undo banner when activeUndo is set', () => {
      const html = renderToStaticMarkup(
        <EpfoMembersTab
          initialData={mockInitialData}
          initialUndo={{
            type: 'EXIT',
            staffIds: ['s-exit'],
            count: 1,
          }}
          onFixMember={vi.fn()}
        />
      );

      expect(html).toContain('Exported 1 exit records');
      expect(html).toContain('Undo');
    });
  });
});
