'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { User, Lock, Briefcase, Phone, CheckCircle, AlertCircle, Eye, EyeOff, Save } from 'lucide-react';

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

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/me/profile');
      setProfile(res.data);
      setPersonalInfo({
        preferred_name: res.data.preferred_name || '',
        personal_email: res.data.personal_email || '',
        phone_number: res.data.phone_number || '',
        home_address: res.data.home_address || '',
      });
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
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

  if (loading) return <DashboardLayout><div className="flex justify-center mt-20"><div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-gray-400 mt-1">Manage your security credentials and personal information</p>
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
                <div><p className="text-gray-500 text-xs">Reports To</p><p className="text-white">{profile.reports_to || 'N/A'}</p></div>
                <div><p className="text-gray-500 text-xs">Hire Date</p><p className="text-white">{profile.employment_date ? new Date(profile.employment_date).toLocaleDateString() : 'N/A'}</p></div>
                <div className="pt-3 mt-3 border-t border-dark-700">
                  <p className="text-xs text-gray-500 italic">To update employment or legal details, please contact HR or your System Administrator.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Editable Forms */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
              
              {/* Security Section */}
              <div className="p-6 border-b border-dark-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-primary-400"/> Security & Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">New Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required={profile.requires_password_change} placeholder="••••••••" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-500 hover:text-white"><Eye className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required={!!password} placeholder="••••••••" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" />
                  </div>
                </div>
              </div>

              {/* Personal Info Section */}
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-primary-400"/> Personal & Contact Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-1">Preferred Name</label><input type="text" value={personalInfo.preferred_name} onChange={e => setPersonalInfo({...personalInfo, preferred_name: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Personal Phone</label><input type="tel" value={personalInfo.phone_number} onChange={e => setPersonalInfo({...personalInfo, phone_number: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Personal Email</label><input type="email" value={personalInfo.personal_email} onChange={e => setPersonalInfo({...personalInfo, personal_email: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Home Address</label><input type="text" value={personalInfo.home_address} onChange={e => setPersonalInfo({...personalInfo, home_address: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" /></div>
                </div>
              </div>

              <div className="p-6 bg-dark-900 border-t border-dark-700 flex justify-end">
                <button type="submit" disabled={saving} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-primary-500/20 disabled:opacity-50">
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="w-5 h-5"/>} Save Profile
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}