import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComplianceApprovalsPage from './page';

// This project had no frontend test framework before Bug 1 (Approvals page
// crashing on `cat.recurrence_type.replace(...)` when recurrence_type is
// null -- true for every category created since the flexible-cadence
// migration, since createComplianceCategory never sets it). This is the
// regression test the fix asked for: render the approvals list with rows
// where deprecated/nullable fields are null and confirm it doesn't crash.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// DashboardLayout pulls in the whole sidebar (more hooks, more nav state)
// that has nothing to do with what this test is checking -- swapped for a
// plain passthrough so the test exercises only the approvals page's own
// rendering logic.
vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockGet = vi.fn();

// A stable object reference, defined once outside the mock factory --
// the real useAuth is a zustand store, which always returns the same
// object reference across renders until the state actually changes. A
// mock that returns a *new* { user: {...} } literal on every call breaks
// that assumption: the page's `useEffect(() => {...}, [user])` sees a
// "changed" dependency on every render and re-fetches forever, which is
// exactly what happened the first time this test was written this way
// (an infinite act()-warning loop, not a real app bug -- caught by
// running the test, not by inspection).
const mockUser = { user_id: 'admin-1', email: 'admin@vilag.io', full_name: 'Admin User', role: 'admin', is_active: true };

vi.mock('@/hooks/useAuth', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
  useAuth: () => ({ user: mockUser }),
}));

describe('Compliance Approvals page', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('renders a pending category with recurrence_type null (post-flexible-cadence shape) without crashing', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/compliance/items')) return Promise.resolve({ data: [] });
      if (url.startsWith('/compliance/categories')) {
        return Promise.resolve({
          data: [
            {
              category_id: 'cat-null-recurrence',
              name: 'NAPSA',
              regulator: null,
              // recurrence_type is deliberately absent -- exactly what
              // GET /categories returns for any category created since
              // the flexible-cadence migration. Before formatCadence()
              // replaced the direct cat.recurrence_type.replace(...)
              // read, this shape threw "Cannot read properties of null
              // (reading 'replace')" and crashed the whole page.
              cadence_type: 'RECURRING',
              interval_months: 3,
              reminder_ladder_days: [14, 7, 3],
              created_by: 'jr-1',
              status: 'PENDING_APPROVAL',
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    render(<ComplianceApprovalsPage />);

    expect(await screen.findByText('NAPSA')).toBeInTheDocument();
    expect(await screen.findByText('Every 3 months')).toBeInTheDocument();
  });

  it('contains a genuinely broken row to just that row via RowErrorBoundary, not the whole page', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/compliance/items')) return Promise.resolve({ data: [] });
      return Promise.resolve({
        data: [
          {
            category_id: 'cat-bad-row',
            name: 'Bad Row',
            regulator: null,
            cadence_type: 'ONE_OFF',
            interval_months: null,
            // Malformed on purpose (.map on null throws) -- simulates a
            // row this test wasn't specifically written to defend against,
            // proving the error boundary (not a null-check) is what keeps
            // the rest of the page up.
            reminder_ladder_days: null as unknown as number[],
            created_by: 'jr-1',
            status: 'PENDING_APPROVAL',
          },
          {
            category_id: 'cat-good-row',
            name: 'Good Row',
            regulator: null,
            cadence_type: 'ONE_OFF',
            interval_months: null,
            reminder_ladder_days: [30, 15, 10],
            created_by: 'jr-1',
            status: 'PENDING_APPROVAL',
          },
        ],
      });
    });

    render(<ComplianceApprovalsPage />);

    expect(await screen.findByText('Good Row')).toBeInTheDocument();
    expect(await screen.findByText(/failed to render/i)).toBeInTheDocument();
  });
});
