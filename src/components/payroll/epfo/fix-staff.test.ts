import { describe, expect, it, vi } from 'vitest';
import { resolveFixStaff } from './fix-staff';

describe('resolveFixStaff', () => {
  it('returns the cached full record without fetching', async () => {
    const fetchAll = vi.fn();
    const res = await resolveFixStaff('a', [{ id: 'a', user: { role: 'APPROVER' } }], fetchAll);
    expect(res.staff?.user.role).toBe('APPROVER');
    expect(fetchAll).not.toHaveBeenCalled();
  });
  it('fetches the full list on a cache miss', async () => {
    const fetchAll = vi.fn().mockResolvedValue([{ id: 'a', user: { role: 'APPROVER' } }]);
    const res = await resolveFixStaff('a', [], fetchAll);
    expect(fetchAll).toHaveBeenCalledOnce();
    expect(res.staff?.id).toBe('a');
    expect(res.list).toHaveLength(1);
  });
  it('never falls back to a partial record when the fetch fails', async () => {
    const res = await resolveFixStaff('a', [], vi.fn().mockRejectedValue(new Error('down')));
    expect(res.staff).toBeNull();
  });
});
