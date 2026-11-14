import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportSummaryDialog } from './ExportSummaryDialog';
import { MarkExitDialog } from './MarkExitDialog';

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
});
