'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Users as UsersIcon, Plus, Search, Edit2, Trash2, Lock,
  UserCheck, UserX, Shield, AlertCircle, CheckCircle, Loader2,
  Eye, EyeOff, Briefcase, User
} from 'lucide-react';
import axios from 'axios';

// ── Standardized Departments List (matches hr_departments seed data) ─────────
const DEPARTMENTS = [
  'Quality Assurance',
  'Production',
  'Engineering',
  'Inventory',
  'Human Resources',
  'Finance',
  'Sales',
  'Management',
  'IT'
];

// ── Unified Role List ─────────────────────────────────────────────────────────
// Canonical source of truth — must match:
//   · users_role_check constraint in PostgreSQL
//   · VALID_ROLES in users-service.js
// Groups: Executive | Management | Operations | Quality | Commercial | Access
const ROLES = [
  // ── Executive
  { value: 'admin',              label: 'Administrator (Full Access)',   group: 'Executive' },
  { value: 'ceo',                label: 'CEO (Executive Access)',        group: 'Executive' },
  { value: 'cfo',                label: 'CFO (Financial Access)',        group: 'Executive' },
  // ── Management
  { value: 'manager',            label: 'Manager',                       group: 'Management' },
  { value: 'production_manager', label: 'Production Manager',            group: 'Management' },
  { value: 'warehouse_manager',  label: 'Warehouse Manager',             group: 'Management' },
  { value: 'hr_admin',           label: 'HR Admin',                      group: 'Management' },
  { value: 'hr_manager',         label: 'HR Manager',                    group: 'Management' },
  // ── Operations
  { value: 'engineering',        label: 'Engineering',                   group: 'Operations' },
  { value: 'warehouse_staff',    label: 'Warehouse Staff',               group: 'Operations' },
  { value: 'operator',           label: 'Operator (Line Staff)',          group: 'Operations' },
  { value: 'staff',              label: 'Staff',                         group: 'Operations' },
  // ── Quality
  { value: 'qa',                 label: 'Quality Assurance',             group: 'Quality' },
  // ── Commercial
  { value: 'sales',              label: 'Sales & Marketing',             group: 'Commercial' },
  // ── Access
  { value: 'super_viewer',       label: 'Super Viewer',                  group: 'Access' },
  { value: 'viewer',             label: 'Viewer',                        group: 'Access' },
] as const;

type RoleValue = typeof ROLES[number]['value'];

// Role badge colours — covers all 16 roles
const ROLE_BADGE: Record<string, string> = {
  admin:              'bg-red-500/10 text-red-400 border-red-500/20',
  ceo:                'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cfo:                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  manager:            'bg-blue-500/10 text-blue-400 border-blue-500/20',
  production_manager: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  warehouse_manager:  'bg-teal-500/10 text-teal-400 border-teal-500/20',
  hr_admin:           'bg-violet-500/10 text-violet-400 border-violet-500/20',
  hr_manager:         'bg-purple-500/10 text-purple-400 border-purple-500/20',
  engineering:        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  warehouse_staff:    'bg-lime-500/10 text-lime-400 border-lime-500/20',
  operator:           'bg-orange-500/10 text-orange-400 border-orange-500/20',
  staff:              'bg-green-500/10 text-green-400 border-green-500/20',
  qa:                 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  sales:              'bg-pink-500/10 text-pink-400 border-pink-500/20',
  super_viewer:       'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  viewer:             'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

// Group unique roles for the filter dropdown
const ROLE_GROUPS = Array.from(new Set(ROLES.map(r => r.group)));

// ── Form default ──────────────────────────────────────────────────────────────
const FORM_DEFAULT = {
  email: '', full_name: '', preferred_name: '', password: '', role: 'viewer' as RoleValue,
  date_of_birth: '', gender: '', nationality: '', national_id: '',
  home_address: '', personal_email: '', phone_number: '',
  emergency_contacts: [] as { name: string; relationship: string; phone: string }[],
  employee_number: '', job_title: '', department: '', reports_to: '',
  employment_date: '', employment_status: 'Full-time', employment_type: 'Salaried',
  requires_password_change: true, is_active: true, is_verified: true
};

// ─────────────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated, token } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<any>({ ...FORM_DEFAULT });
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
    else if (currentUser?.role !== 'admin') router.push('/dashboard');
  }, [isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (currentUser?.role === 'admin') fetchUsers();
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(response.data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employee_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole   = roleFilter   === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active'   &&  u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const potentialManagers = users
    .filter(u => u.is_active)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Emergency contacts helpers
  const addEmergencyContact = () =>
    setFormData((f: any) => ({
      ...f,
      emergency_contacts: [...(f.emergency_contacts || []), { name: '', relationship: '', phone: '' }]
    }));

  const updateEmergencyContact = (idx: number, field: string, value: string) => {
    const updated = [...formData.emergency_contacts];
    updated[idx][field] = value;
    setFormData((f: any) => ({ ...f, emergency_contacts: updated }));
  };

  const removeEmergencyContact = (idx: number) =>
    setFormData((f: any) => ({
      ...f,
      emergency_contacts: f.emergency_contacts.filter((_: any, i: number) => i !== idx)
    }));

  // CRUD handlers
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError(''); setSuccess('');
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => [response.data, ...prev]);
      setSuccess('Employee profile created successfully!');
      setShowAddModal(false);
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormLoading(true); setError(''); setSuccess('');
    try {
      const payload = { ...formData };
      if (!payload.password) delete payload.password;
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${selectedUser.user_id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u.user_id === selectedUser.user_id ? response.data : u));
      setSuccess('Profile updated successfully!');
      setShowEditModal(false);
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setFormData({
      ...user,
      password: '',
      preferred_name:    user.preferred_name    || '',
      gender:            user.gender            || '',
      nationality:       user.nationality       || '',
      national_id:       user.national_id       || '',
      home_address:      user.home_address      || '',
      personal_email:    user.personal_email    || '',
      phone_number:      user.phone_number      || '',
      employee_number:   user.employee_number   || '',
      job_title:         user.job_title         || '',
      department:        user.department        || '',
      reports_to:        user.reports_to        || '',
      employment_status: user.employment_status || 'Full-time',
      employment_type:   user.employment_type   || 'Salaried',
      date_of_birth:     user.date_of_birth
        ? new Date(user.date_of_birth).toISOString().split('T')[0] : '',
      employment_date:   user.employment_date
        ? new Date(user.employment_date).toISOString().split('T')[0] : '',
      emergency_contacts: user.emergency_contacts || []
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ ...FORM_DEFAULT });
    setSelectedUser(null);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    resetForm();
  };

  const getRoleBadge = (role: string) =>
    ROLE_BADGE[role] || ROLE_BADGE.viewer;

  const getRoleLabel = (roleValue: string) =>
    ROLES.find(r => r.value === roleValue)?.label || roleValue.replace(/_/g, ' ');

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto" />
      </div>
    </DashboardLayout>
  );

  // ── Shared role select (used in form + filter) ──────────────────────────────
  const RoleSelect = ({
    value,
    onChange,
    className,
    includeAll = false
  }: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    includeAll?: boolean;
  }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className || 'w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white font-medium'}
    >
      {includeAll && <option value="all">All Roles</option>}
      {ROLE_GROUPS.map(group => (
        <optgroup key={group} label={`── ${group}`}>
          {ROLES.filter(r => r.group === group).map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  // ── Page ───────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">HR &amp; User Management</h1>
            <p className="text-gray-400 mt-1">Manage system access and detailed employment profiles</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Employee
          </button>
        </div>

        {/* Alerts */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />{success}
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or employee #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white"
            />
          </div>

          {/* Role filter — uses the same grouped RoleSelect component */}
          <RoleSelect
            value={roleFilter}
            onChange={setRoleFilter}
            includeAll
            className="w-52 px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-40 px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* User Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-dark-900 border-b border-dark-700">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase">Employee</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase">Department / Role</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase">System Access</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No users match your filters.
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
                <tr key={user.user_id} className="hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center text-primary-400 font-bold text-lg flex-shrink-0">
                        {user.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-white leading-tight">{user.full_name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {user.employee_number ? `EMP: ${user.employee_number}` : 'No employee #'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-300 font-semibold">{user.job_title || 'N/A'}</p>
                    <p className="text-xs text-gray-500">{user.department || 'No Dept'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-300 mb-1.5">{user.email}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(user.role)}`}>
                      {getRoleLabel(user.role).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-sm flex items-center gap-1.5 ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                        {user.is_active ? 'Active' : 'Revoked'}
                      </span>
                      {user.requires_password_change && (
                        <span className="text-[10px] text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded w-max border border-orange-500/20">
                          Pending Password Setup
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-gray-400 hover:text-primary-400 transition-colors bg-dark-900 rounded-lg mr-2 border border-dark-600"
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.user_id)}
                      disabled={user.user_id === currentUser?.user_id}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-dark-900 rounded-lg border border-dark-600 disabled:opacity-30"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-start pt-10 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-4xl shadow-2xl mb-10">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-primary-400" />
                {showAddModal ? 'Onboard New Employee' : 'Edit Employee Profile'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white px-3 py-1 bg-dark-800 rounded border border-dark-600 text-sm">
                Close
              </button>
            </div>

            <form onSubmit={showAddModal ? handleAddUser : handleEditUser} className="p-6 space-y-8">

              {/* ── SECTION 1: ACCOUNT & ACCESS ──────────────────────────────── */}
              <div>
                <h3 className="text-sm font-bold text-primary-400 border-b border-dark-700 pb-2 mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Account &amp; Access
                </h3>
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Company Login Email *</label>
                    <input
                      type="email" required
                      value={formData.email}
                      onChange={e => setFormData((f: any) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white"
                    />
                  </div>

                  {/* ── Role select — all 16 roles, grouped ─────────────────── */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">System Role *</label>
                    <RoleSelect
                      value={formData.role}
                      onChange={v => setFormData((f: any) => ({ ...f, role: v }))}
                    />
                    {/* Role description hint */}
                    {formData.role && (
                      <p className="text-[10px] text-gray-500 mt-1 pl-1">
                        {formData.role === 'admin'              && 'Full system access including user management.'}
                        {formData.role === 'ceo'                && 'Executive read access across all modules.'}
                        {formData.role === 'cfo'                && 'Full finance module access; read-only elsewhere.'}
                        {formData.role === 'manager'            && 'Department management, approvals, and reporting.'}
                        {formData.role === 'production_manager' && 'Production orders, BOM management, production reporting.'}
                        {formData.role === 'warehouse_manager'  && 'Approve transactions, full reporting, user oversight.'}
                        {formData.role === 'hr_admin'           && 'Full HR module access including salary data.'}
                        {formData.role === 'hr_manager'         && 'Onboarding updates for direct reports; view-only salary.'}
                        {formData.role === 'engineering'        && 'Engineering and maintenance module access.'}
                        {formData.role === 'warehouse_staff'    && 'Receive, issue, transfer, count — operational transactions.'}
                        {formData.role === 'operator'           && 'Production line operation and batch recording.'}
                        {formData.role === 'staff'              && 'Standard operational access.'}
                        {formData.role === 'qa'                 && 'Quality management, NCRs, HACCP, lab records.'}
                        {formData.role === 'sales'              && 'Sales, customer orders, and distribution.'}
                        {formData.role === 'super_viewer'       && 'Read-only access across all modules.'}
                        {formData.role === 'viewer'             && 'Read-only access to dashboards and reports.'}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="col-span-2 bg-dark-900 p-4 border border-dark-600 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-white">Temporary Password</label>
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.requires_password_change}
                          onChange={e => setFormData((f: any) => ({ ...f, requires_password_change: e.target.checked }))}
                          className="rounded text-primary-500 bg-dark-800 border-dark-600"
                        />
                        Force user to set new password on next login
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData((f: any) => ({ ...f, password: e.target.value }))}
                        required={showAddModal}
                        placeholder={showAddModal ? 'Enter temporary password...' : 'Leave blank to keep current password'}
                        className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-2 text-gray-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION 2: PERSONAL INFORMATION ─────────────────────────── */}
              <div>
                <h3 className="text-sm font-bold text-primary-400 border-b border-dark-700 pb-2 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Full Legal Name *</label>
                    <input type="text" required value={formData.full_name}
                      onChange={e => setFormData((f: any) => ({ ...f, full_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Preferred Name</label>
                    <input type="text" value={formData.preferred_name}
                      onChange={e => setFormData((f: any) => ({ ...f, preferred_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date of Birth</label>
                    <input type="date" value={formData.date_of_birth}
                      onChange={e => setFormData((f: any) => ({ ...f, date_of_birth: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Gender / Pronouns</label>
                    <input type="text" value={formData.gender}
                      onChange={e => setFormData((f: any) => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nationality</label>
                    <input type="text" value={formData.nationality}
                      onChange={e => setFormData((f: any) => ({ ...f, nationality: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">National ID / NRC</label>
                    <input type="text" value={formData.national_id}
                      onChange={e => setFormData((f: any) => ({ ...f, national_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Personal Phone</label>
                    <input type="tel" value={formData.phone_number}
                      onChange={e => setFormData((f: any) => ({ ...f, phone_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Personal Email</label>
                    <input type="email" value={formData.personal_email}
                      onChange={e => setFormData((f: any) => ({ ...f, personal_email: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs text-gray-400 mb-1">Home Address</label>
                    <input type="text" value={formData.home_address}
                      onChange={e => setFormData((f: any) => ({ ...f, home_address: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>
                </div>

                {/* Emergency contacts */}
                <div className="bg-dark-900 border border-dark-600 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-gray-300">Emergency Contacts</label>
                    <button type="button" onClick={addEmergencyContact}
                      className="text-xs px-2 py-1 bg-dark-800 text-primary-400 hover:text-primary-300 rounded border border-dark-600">
                      + Add Contact
                    </button>
                  </div>
                  {formData.emergency_contacts?.map((ec: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input type="text" placeholder="Name" value={ec.name}
                        onChange={e => updateEmergencyContact(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white text-sm" />
                      <input type="text" placeholder="Relationship" value={ec.relationship}
                        onChange={e => updateEmergencyContact(idx, 'relationship', e.target.value)}
                        className="w-1/4 px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white text-sm" />
                      <input type="tel" placeholder="Phone" value={ec.phone}
                        onChange={e => updateEmergencyContact(idx, 'phone', e.target.value)}
                        className="w-1/4 px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white text-sm" />
                      <button type="button" onClick={() => removeEmergencyContact(idx)}
                        className="px-2 text-red-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!formData.emergency_contacts || formData.emergency_contacts.length === 0) && (
                    <p className="text-xs text-gray-500 italic">No emergency contacts added.</p>
                  )}
                </div>
              </div>

              {/* ── SECTION 3: EMPLOYMENT DETAILS ────────────────────────────── */}
              <div>
                <h3 className="text-sm font-bold text-primary-400 border-b border-dark-700 pb-2 mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Employment Details
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Employee ID Number</label>
                    <input type="text" value={formData.employee_number}
                      onChange={e => setFormData((f: any) => ({ ...f, employee_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white font-mono" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Job Title</label>
                    <input type="text" value={formData.job_title}
                      onChange={e => setFormData((f: any) => ({ ...f, job_title: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Department / Division</label>
                    <select value={formData.department}
                      onChange={e => setFormData((f: any) => ({ ...f, department: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white">
                      <option value="">Unassigned</option>
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Reports to (Manager)</label>
                    <select value={formData.reports_to}
                      onChange={e => setFormData((f: any) => ({ ...f, reports_to: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white">
                      <option value="">Unassigned</option>
                      {potentialManagers.map(m => (
                        <option key={m.user_id} value={m.full_name}>
                          {m.full_name} ({getRoleLabel(m.role)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Hire Date</label>
                    <input type="date" value={formData.employment_date}
                      onChange={e => setFormData((f: any) => ({ ...f, employment_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Employment Status</label>
                    <select value={formData.employment_status}
                      onChange={e => setFormData((f: any) => ({ ...f, employment_status: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white">
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Temporary">Temporary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Employment Type</label>
                    <select value={formData.employment_type}
                      onChange={e => setFormData((f: any) => ({ ...f, employment_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded text-white">
                      <option value="Salaried">Salaried (Exempt)</option>
                      <option value="Hourly">Hourly (Non-exempt)</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer border border-dark-600 bg-dark-900 px-3 py-2 rounded w-full justify-center">
                      <input type="checkbox" checked={formData.is_active}
                        onChange={e => setFormData((f: any) => ({ ...f, is_active: e.target.checked }))}
                        className="rounded text-green-500 bg-dark-800 border-dark-600" />
                      <span className="text-sm text-gray-300 font-bold">
                        {formData.is_active ? 'Status: Active Employee' : 'Status: Deactivated'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Form footer ───────────────────────────────────────────────── */}
              <div className="sticky bottom-0 bg-dark-800 pt-4 border-t border-dark-700 flex justify-end gap-3 pb-2">
                <button type="button" onClick={closeModal}
                  className="px-5 py-2 text-gray-400 hover:text-white transition-colors bg-dark-900 rounded-lg border border-dark-600">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg disabled:opacity-60 flex items-center gap-2">
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formLoading ? 'Saving...' : showAddModal ? 'Save Employee Profile' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}