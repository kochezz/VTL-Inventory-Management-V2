'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Target, Search, Plus, CheckCircle2, AlertTriangle, 
  ShieldCheck, Clock, ShieldAlert, Save, X, Activity, Key
} from 'lucide-react';

interface CAPA {
  capa_id: string;
  capa_code: string;
  ncr_id: string;
  ncr_code: string;
  action_description: string;
  action_owner: string;
  owner_name: string;
  due_date: string;
  status: string;
  verified_by_name: string;
  verified_at: string;
  effectiveness_review: string;
  created_at: string;
}

export default function CAPADashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [ncrs, setNcrs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState<CAPA | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // NEW: Digital Signature State
  const [signature, setSignature] = useState('');

  const [formData, setFormData] = useState({
    ncr_id: '', action_description: '', action_owner: '', due_date: '',
    status: 'OPEN', effectiveness_review: ''
  });

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [capaRes, ncrRes, userRes] = await Promise.all([
        api.get('/qms/capas'), api.get('/qms/ncrs'), api.get('/users')
      ]);
      setCapas(capaRes.data);
      setNcrs(ncrRes.data.filter((n: any) => n.status !== 'CLOSED'));
      setUsers(userRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filteredCAPAs = capas.filter(capa => {
    const matchesSearch = capa.capa_code.toLowerCase().includes(searchQuery.toLowerCase()) || capa.action_description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || capa.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = (capa: CAPA | null = null) => {
    setError(''); setSuccess(''); setSignature(''); setSelectedCapa(capa);
    if (capa) {
      setFormData({
        ncr_id: capa.ncr_id, action_description: capa.action_description, action_owner: capa.action_owner || '',
        due_date: capa.due_date ? new Date(capa.due_date).toISOString().split('T')[0] : '',
        status: capa.status, effectiveness_review: capa.effectiveness_review || ''
      });
    } else {
      setFormData({ ncr_id: '', action_description: '', action_owner: '', due_date: '', status: 'OPEN', effectiveness_review: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) return setError('Digital Signature is required to save records.');
    setSaving(true); setError('');

    try {
      const payload = { ...formData, signature_password: signature };
      if (selectedCapa) {
        await api.put(`/qms/capas/${selectedCapa.capa_id}`, payload);
        setSuccess('CAPA updated successfully.');
      } else {
        await api.post('/qms/capas', payload);
        setSuccess('CAPA created and assigned successfully.');
      }
      
      await fetchData();
      setTimeout(() => { setShowModal(false); setSuccess(''); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save CAPA.');
    } finally {
      setSaving(false); setSignature('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CLOSED': case 'VERIFIED': return <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-green-500/20 w-max"><ShieldCheck className="w-3 h-3"/> Verified & Closed</span>;
      case 'IMPLEMENTED': return <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-500/20 w-max"><Activity className="w-3 h-3"/> Pending Verification</span>;
      default: return <span className="flex items-center gap-1 text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-500/20 w-max"><Clock className="w-3 h-3"/> Action Required</span>;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'CLOSED' || status === 'VERIFIED') return false;
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Target className="w-8 h-8 text-purple-500" />CAPA Management</h1>
            <p className="text-gray-400 mt-1">Corrective & Preventive Actions for systemic improvements</p>
          </div>
          <button onClick={() => handleOpenModal()} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20">
            <Plus className="w-5 h-5" /> Issue New CAPA
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Total CAPAs</p><p className="text-3xl font-black text-white">{capas.length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-orange-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Open / In Progress</p><p className="text-3xl font-black text-orange-400">{capas.filter(c => c.status === 'OPEN').length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-blue-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Pending QA Verification</p><p className="text-3xl font-black text-blue-400">{capas.filter(c => c.status === 'IMPLEMENTED').length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-red-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Overdue Actions</p><p className="text-3xl font-black text-red-400">{capas.filter(c => isOverdue(c.due_date, c.status)).length}</p></div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 bg-dark-900/50">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search by CAPA code or NCR link..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-purple-500 transition-colors" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48 px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white">
              <option value="all">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IMPLEMENTED">Implemented (Pending)</option>
              <option value="CLOSED">Verified & Closed</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4 font-medium">CAPA Code</th>
                  <th className="px-6 py-4 font-medium">Linked NCR</th>
                  <th className="px-6 py-4 font-medium">Corrective Action</th>
                  <th className="px-6 py-4 font-medium">Owner</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400"><div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>Loading CAPAs...</td></tr>
                ) : filteredCAPAs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No CAPAs found.</td></tr>
                ) : (
                  filteredCAPAs.map((capa) => (
                    <tr key={capa.capa_id} onClick={() => handleOpenModal(capa)} className="hover:bg-dark-700/50 transition-colors cursor-pointer group">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="font-mono text-sm font-bold text-gray-200 group-hover:text-purple-400 transition-colors">{capa.capa_code}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-mono font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">{capa.ncr_code}</span></td>
                      <td className="px-6 py-4"><p className="text-sm text-gray-300 line-clamp-2 max-w-md">{capa.action_description}</p></td>
                      <td className="px-6 py-4 whitespace-nowrap"><p className="text-sm text-gray-300 font-medium">{capa.owner_name || <span className="text-gray-600 italic">Unassigned</span>}</p></td>
                      <td className="px-6 py-4 whitespace-nowrap">{capa.due_date ? <span className={`text-sm font-medium ${isOverdue(capa.due_date, capa.status) ? 'text-red-400 flex items-center gap-1' : 'text-gray-300'}`}>{isOverdue(capa.due_date, capa.status) && <AlertTriangle className="w-4 h-4"/>}{new Date(capa.due_date).toLocaleDateString()}</span> : <span className="text-sm text-gray-600">-</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(capa.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-10 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-3xl shadow-2xl mb-10">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Target className={`w-6 h-6 ${selectedCapa ? 'text-blue-400' : 'text-purple-500'}`}/>{selectedCapa ? `Update ${selectedCapa.capa_code}` : 'Issue New CAPA'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white px-3 py-1 bg-dark-800 rounded">Close</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
              {success && <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{success}</div>}

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-dark-700 pb-2">1. Root Cause & Action Plan</h3>
                <div className="mb-4">
                  <label className="block text-sm text-gray-300 mb-1">Link to Source Non-Conformance (NCR) *</label>
                  <select disabled={!!selectedCapa} required value={formData.ncr_id} onChange={e => setFormData({...formData, ncr_id: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono focus:border-purple-500 disabled:opacity-50">
                    <option value="">-- Select NCR --</option>
                    {ncrs.map(ncr => <option key={ncr.ncr_id} value={ncr.ncr_id}>{ncr.ncr_code} {ncr.status === 'CAPA_REQUIRED' ? '(⚠️ ESCALATED)' : ''} - {ncr.description.substring(0, 50)}...</option>)}
                  </select>
                </div>
                <div className="mb-4"><label className="block text-sm text-gray-300 mb-1">Corrective/Preventive Action Description *</label><textarea disabled={!!selectedCapa && !['admin', 'qa'].includes(user?.role || '')} required value={formData.action_description} onChange={e => setFormData({...formData, action_description: e.target.value})} rows={3} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-purple-500 disabled:opacity-50" placeholder="Detail specific steps..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-300 mb-1">Action Owner</label><select disabled={!!selectedCapa && !['admin', 'qa'].includes(user?.role || '')} value={formData.action_owner} onChange={e => setFormData({...formData, action_owner: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-purple-500 disabled:opacity-50"><option value="">-- Select Owner --</option>{users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>)}</select></div>
                  <div><label className="block text-sm text-gray-300 mb-1">Target Due Date</label><input disabled={!!selectedCapa && !['admin', 'qa'].includes(user?.role || '')} type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-purple-500 disabled:opacity-50" /></div>
                </div>
              </div>

              {selectedCapa && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-dark-700 pb-2 mt-6">2. Effectiveness & Closure</h3>
                  <div className="mb-4"><label className="block text-sm text-gray-300 mb-1">Effectiveness Review / Evidence</label><textarea value={formData.effectiveness_review} onChange={e => setFormData({...formData, effectiveness_review: e.target.value})} rows={3} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-blue-500" placeholder="How was the action verified?..." /></div>
                  <div className="bg-dark-900 p-4 rounded-lg border border-dark-600">
                    <label className="block text-sm font-bold text-white mb-2">Update CAPA Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-dark-950 border border-dark-500 rounded-lg text-white font-bold tracking-wider focus:border-primary-500">
                      <option value="OPEN">OPEN - Awaiting Implementation</option>
                      <option value="IMPLEMENTED">IMPLEMENTED - Pending QA Verification</option>
                      {['admin', 'qa', 'manager'].includes(user?.role || '') && <option value="CLOSED">VERIFIED & CLOSED - Effectiveness Confirmed</option>}
                    </select>
                  </div>
                </div>
              )}

              {/* NEW: 21 CFR Part 11 Signature Block */}
              <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner mt-6">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-primary-400" /> Digital Signature Required</h3>
                <p className="text-xs text-gray-400 mb-3">By entering your password, you electronically sign off on this QMS Record per 21 CFR Part 11 guidelines.</p>
                <input type="password" value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder="Enter your login password" className="w-full px-4 py-3 bg-dark-950 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 font-mono tracking-widest" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 hover:text-white transition-colors bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !signature} className={`px-8 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 ${selectedCapa ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}>
                  {saving ? 'Verifying...' : <><Save className="w-4 h-4"/> {selectedCapa ? 'Sign & Update CAPA' : 'Sign & Issue CAPA'}</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}