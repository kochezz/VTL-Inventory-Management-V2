'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  User, Lock, Briefcase, Phone, CheckCircle, AlertCircle, Eye, EyeOff, Save, 
  CalendarDays, Send, Clock, CheckCircle2, XCircle
} from 'lucide-react';

export default function MyProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [personalInfo, setPersonalInfo] = useState({
    preferred_name: '', personal_email: '', phone_number: '', home_address: ''
  });

  // Holiday States
  const [holidayData, setHolidayData] = useState({ allowance: 15, used: 0, pending: 0, remaining: 15, history: [] });
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveDays, setLeaveDays] = useState(0);
  const [requestingLeave, setRequestingLeave] = useState(false);

  useEffect(() => {
    fetchProfileAndHolidays();
  }, []);

  // Calculate working days automatically when dates change
  useEffect(() => {
    if (leaveStart && leaveEnd) {
      const start = new Date(leaveStart);
      const end = new Date(leaveEnd);
      if (start <= end) {
        let count = 0;
        let cur = new Date(start);
        while (cur <= end) {
          const dayOfWeek = cur.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // Skip Sunday (0) and Saturday (6)
          cur.setDate(cur.getDate() + 1);
        }
        setLeaveDays(count);
      } else {
        setLeaveDays(0);
      }
    }
  }, [leaveStart, leaveEnd]);

  const fetchProfileAndHolidays = async () => {
    try {
      setLoading(true);
      const [profileRes, holidayRes] = await Promise.all([
        api.get('/users/me/profile'),
        api.get('/users/me/holidays')
      ]);
      
      setProfile(profileRes.data);
      setPersonalInfo({
        preferred_name: profileRes.data.preferred_name || '',
        personal_email: profileRes.data.personal_email || '',
        phone_number: profileRes.data.phone_number || '',
        home_address: profileRes.data.home_address || '',
      });
      setHolidayData(holidayRes.data);
    } catch (err) {
      setError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');

    if (password && password !== confirmPassword) {
      setSaving(false);
      return setError('Passwords do not match.');
    }

    if (profile.requires_password_change && !password) {
      setSaving(false);
      return setError('You must set a new password to continue.');
    }

    try {
      const payload: any = { ...personalInfo };
      if (password) payload.password = password;

      const res = await api.put('/users/me/profile', payload);
      setProfile(res.data);
      setPassword(''); setConfirmPassword('');
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leaveDays <= 0) return setError('Invalid date range. Must be at least 1 working day.');
    if (leaveDays > holidayData.remaining) return setError('You do not have enough remaining holiday allowance.');

    try {
      setRequestingLeave(true);
      setError(''); setSuccess('');
      await api.post('/users/me/holidays', {
        start_date: leaveStart,
        end_date: leaveEnd,
        days_requested: leaveDays
      });
      
      setSuccess(`Holiday request for ${leaveDays} days sent to your manager!`);
      setLeaveStart(''); setLeaveEnd(''); setLeaveDays(0);
      await fetchProfileAndHolidays(); // Refresh balances
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit holiday request.');
    } finally {
      setRequestingLeave(false);
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center mt-20"><div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-gray-400 mt-1">Manage your security credentials, personal info, and HR requests</p>
        </div>

        {profile?.requires_password_change && (
          <div className="bg-orange-500/10 border border-orange-500 text-orange-400 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-lg">Action Required: Update Your Password</h3>
              <p className="text-sm opacity-90">Your administrator has requested that you change your temporary password before you can fully access the system.</p>
            </div>
          </div>
        )}

        {success && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><CheckCircle className="w-5 h-5" />{success}</div>}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Read-Only HR Data */}
          <div className="space-y-6">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center">
              <div className="w-24 h-24 bg-dark-600 rounded-full mx-auto flex items-center justify-center text-4xl font-bold text-primary-400 mb-4 shadow-inner">
                {profile.full_name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
              <p className="text-gray-400 text-sm mb-4">{profile.email}</p>
              <span className="px-3 py-1 bg-primary-500/10 text-primary-400 border border-primary-500/30 rounded-full text-xs font-bold uppercase tracking-wide">
                {profile.role.replace('_', ' ')}
              </span>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-dark-700 pb-2"><Briefcase className="w-4 h-4 text-primary-400"/> Employment Details</h3>
              <div className="space-y-3 text-sm">
                <div><p className="text-gray-500 text-xs">Employee ID</p><p className="text-white font-mono">{profile.employee_number || 'N/A'}</p></div>
                <div><p className="text-gray-500 text-xs">Job Title</p><p className="text-white font-medium">{profile.job_title || 'N/A'}</p></div>
                <div><p className="text-gray-500 text-xs">Department</p><p className="text-white">{profile.department || 'N/A'}</p></div>
                <div><p className="text-gray-500 text-xs">Reports To (Manager)</p><p className="text-white font-bold text-primary-400">{profile.reports_to || 'Unassigned'}</p></div>
                <div><p className="text-gray-500 text-xs">Hire Date</p><p className="text-white">{profile.employment_date ? new Date(profile.employment_date).toLocaleDateString() : 'N/A'}</p></div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Editable Forms & Leave */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* User Profile Form */}
            <form onSubmit={handleSaveProfile} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-dark-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-primary-400"/> Security & Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">New Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required={profile.requires_password_change} placeholder="••••••••" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white pr-10 focus:border-primary-500 outline-none" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-500 hover:text-white"><Eye className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required={!!password} placeholder="••••••••" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-primary-400"/> Personal & Contact Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-1">Preferred Name</label><input type="text" value={personalInfo.preferred_name} onChange={e => setPersonalInfo({...personalInfo, preferred_name: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Personal Phone</label><input type="tel" value={personalInfo.phone_number} onChange={e => setPersonalInfo({...personalInfo, phone_number: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Personal Email</label><input type="email" value={personalInfo.personal_email} onChange={e => setPersonalInfo({...personalInfo, personal_email: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Home Address</label><input type="text" value={personalInfo.home_address} onChange={e => setPersonalInfo({...personalInfo, home_address: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none" /></div>
                </div>
              </div>

              <div className="p-6 bg-dark-900 border-t border-dark-700 flex justify-end">
                <button type="submit" disabled={saving} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-primary-500/20 disabled:opacity-50">
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="w-5 h-5"/>} Save Profile
                </button>
              </div>
            </form>

            {/* LEAVE MANAGEMENT SECTION */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl mt-8">
              <div className="p-6 border-b border-dark-700 bg-dark-900/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><CalendarDays className="w-6 h-6 text-primary-500"/> Leave & Holiday Requests</h3>
                <p className="text-sm text-gray-400 mt-1">Request annual leave and view your balance</p>
              </div>
              
              <div className="p-6">
                {/* Balances */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-dark-950 border border-dark-700 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Allowance</p>
                    <p className="text-2xl font-bold text-white">{holidayData.allowance}</p>
                  </div>
                  <div className="bg-dark-950 border border-dark-700 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Approved</p>
                    <p className="text-2xl font-bold text-green-400">{holidayData.used}</p>
                  </div>
                  <div className="bg-dark-950 border border-dark-700 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-400">{holidayData.pending}</p>
                  </div>
                  <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 text-center">
                    <p className="text-primary-400 text-xs uppercase font-bold tracking-wider mb-1">Remaining</p>
                    <p className="text-2xl font-bold text-primary-400">{holidayData.remaining}</p>
                  </div>
                </div>

                {/* Request Form */}
                <form onSubmit={handleRequestLeave} className="bg-dark-900 border border-dark-700 p-5 rounded-xl mb-8">
                  <h4 className="text-white font-bold mb-4">Request New Leave</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                      <input type="date" required min={new Date().toISOString().split('T')[0]} value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">End Date</label>
                      <input type="date" required min={leaveStart || new Date().toISOString().split('T')[0]} value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <button type="submit" disabled={requestingLeave || !profile.reports_to || leaveDays <= 0} className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg flex justify-center items-center gap-2 transition-transform disabled:opacity-50">
                        {requestingLeave ? 'Sending...' : <><Send className="w-4 h-4"/> Request {leaveDays > 0 ? `${leaveDays} Days` : ''}</>}
                      </button>
                    </div>
                  </div>
                  {leaveStart && leaveEnd && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3"/> Auto-calculated as <strong>{leaveDays} working days</strong> (excludes weekends). 
                      {!profile.reports_to && <span className="text-red-400 ml-2">You must have a Manager assigned in HR to submit a request.</span>}
                    </p>
                  )}
                </form>

                {/* History Table */}
                <h4 className="text-white font-bold mb-3">Request History</h4>
                {holidayData.history.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-4 bg-dark-950 rounded-lg border border-dark-700 text-center">No holiday requests found for this year.</p>
                ) : (
                  <div className="overflow-hidden border border-dark-700 rounded-lg">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
                        <tr>
                          <th className="p-3">Requested On</th>
                          <th className="p-3">Dates</th>
                          <th className="p-3">Working Days</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700 bg-dark-950">
                        {holidayData.history.map((req: any) => (
                          <tr key={req.request_id} className="hover:bg-dark-900 transition-colors">
                            <td className="p-3 text-gray-400">{new Date(req.created_at).toLocaleDateString()}</td>
                            <td className="p-3 text-white font-medium">
                              {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-gray-300 font-mono">{req.days_requested}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-max ${
                                req.status === 'Approved' ? 'bg-green-500/10 text-green-400' :
                                req.status === 'Declined' ? 'bg-red-500/10 text-red-400' :
                                'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3"/>}
                                {req.status === 'Declined' && <XCircle className="w-3 h-3"/>}
                                {req.status === 'Pending' && <Clock className="w-3 h-3"/>}
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}