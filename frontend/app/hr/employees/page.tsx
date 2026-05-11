'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import { Search, Loader2, AlertTriangle, Circle, ChevronRight, UserPlus } from 'lucide-react';
import axios from 'axios';

// HR routes are at /hr (not /api/hr)
const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const HR_STATUS_BADGE: Record<string, string> = {
  pre_start:     'bg-gray-500/10 text-gray-400 border-gray-500/20',
  onboarding:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  probation:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  confirmed:     'bg-green-500/10 text-green-400 border-green-500/20',
  pip_active:    'bg-red-500/10 text-red-400 border-red-500/20',
  notice_period: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  exited:        'bg-gray-500/10 text-gray-500 border-gray-700',
};

const HR_STATUS_LABEL: Record<string, string> = {
  pre_start:     'Pre-Start',
  onboarding:    'Onboarding',
  probation:     'Probation',
  confirmed:     'Confirmed',
  pip_active:    'PIP Active',
  notice_period: 'Notice Period',
  exited:        'Exited',
};

function probationClass(days: number | null) {
  if (days === null || days === undefined) return 'text-gray-500';
  if (days < 14) return 'text-red-400 font-semibold';
  if (days < 30) return 'text-yellow-400';
  return 'text-gray-400';
}

export default function HREmployeesPage() {
  const router = useRouter();
  const { token, user: currentUser } = useAuth();

  const [employees, setEmployees]     = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allUsers, setAllUsers]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter]   = useState('all');

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [empRes, deptRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/employees`, { headers }),
        axios.get(`${HR_BASE}/hr/departments`, { headers }),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);

      // Fetch raw users for the empty-state fallback (admin only)
      if (currentUser?.role === 'admin' || currentUser?.role === 'hr_admin') {
        try {
          const usersRes = await axios.get(`${API_URL}/users`, { headers });
          setAllUsers(usersRes.data);
        } catch { /* non-critical */ }
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError('You do not have access to this section');
      } else {
        setError(err?.response?.data?.message || 'Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering
  const filtered = employees.filter(emp => {
    const dept = emp.department_structured ?? emp.department_name ?? emp.department ?? '';
    const matchSearch =
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || emp.hr_status === statusFilter;
    const matchDept   = deptFilter   === 'all' || dept === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  // Users without an HR record (for empty-state secondary table)
  const hrUserIds = new Set(employees.map(e => e.user_id));
  const usersWithoutHr = allUsers.filter(u => u.is_active && !hrUserIds.has(u.user_id));

  if (loading) {
    return (
      <HRLayout title="Employees" subtitle="HR status and lifecycle tracking">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title="Employees" subtitle="HR status and lifecycle tracking">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto pb-12">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-56 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, employee #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="onboarding">Onboarding</option>
            <option value="probation">Probation</option>
            <option value="confirmed">Confirmed</option>
            <option value="pip_active">PIP Active</option>
            <option value="notice_period">Notice Period</option>
            <option value="exited">Exited</option>
          </select>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-500 self-center">
            {filtered.length} of {employees.length} employees
          </span>
        </div>

        {/* Main employee table */}
        {filtered.length > 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Employee</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Department</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Job Title</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">HR Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Onboarding</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Probation</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">PIP</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map(emp => {
                  const dept   = emp.department_structured ?? emp.department_name ?? emp.department ?? '—';
                  const pct    = typeof emp.onboarding_pct === 'number' ? Math.round(emp.onboarding_pct) : null;
                  const days   = emp.days_to_probation_end ?? null;
                  const badge  = HR_STATUS_BADGE[emp.hr_status] || HR_STATUS_BADGE.pre_start;
                  const label  = HR_STATUS_LABEL[emp.hr_status]  || (emp.hr_status ?? '—');

                  return (
                    <tr key={emp.user_id} className="hover:bg-dark-700/40 transition-colors">
                      {/* Employee */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
                            {emp.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white leading-tight">{emp.full_name}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {emp.employee_number ? `#${emp.employee_number}` : emp.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Department */}
                      <td className="px-5 py-4 text-sm text-gray-300">{dept}</td>
                      {/* Job Title */}
                      <td className="px-5 py-4 text-sm text-gray-300">{emp.job_title ?? '—'}</td>
                      {/* HR Status */}
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge}`}>
                          {label}
                        </span>
                      </td>
                      {/* Onboarding */}
                      <td className="px-5 py-4">
                        {pct !== null ? (
                          <div className="w-28">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>{pct}% complete</span>
                            </div>
                            <div className="w-full bg-dark-950 rounded-full h-1.5 border border-dark-600">
                              <div
                                className="h-full rounded-full bg-primary-500 transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      {/* Probation */}
                      <td className="px-5 py-4">
                        {days !== null ? (
                          <span className={`text-sm ${probationClass(days)}`}>
                            {days} days
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      {/* PIP */}
                      <td className="px-5 py-4">
                        {emp.has_active_pip ? (
                          <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => router.push(`/hr/employees/${emp.user_id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          View Profile <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center">
            <p className="text-white font-semibold mb-1">No HR records found.</p>
            <p className="text-gray-400 text-sm">
              {search || statusFilter !== 'all' || deptFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Active users without HR records are listed below.'}
            </p>
          </div>
        )}

        {/* Fallback: users without HR records (admin/hr_admin only) */}
        {employees.length === 0 && usersWithoutHr.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-dark-900 border-b border-dark-700">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-yellow-400" />
                Active users without an HR record ({usersWithoutHr.length})
              </h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-dark-900/50 border-b border-dark-700">
                <tr>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Email</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Role</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {usersWithoutHr.map(u => (
                  <tr key={u.user_id} className="hover:bg-dark-700/40 transition-colors">
                    <td className="px-5 py-3 text-sm text-white">{u.full_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{u.email}</td>
                    <td className="px-5 py-3 text-sm text-gray-400 capitalize">{u.role?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => router.push(`/hr/employees/${u.user_id}?create=true`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-400 text-xs font-medium rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3 h-3" /> Create HR Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </HRLayout>
  );
}
