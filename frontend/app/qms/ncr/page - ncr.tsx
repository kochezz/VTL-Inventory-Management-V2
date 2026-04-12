'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  AlertOctagon, Search, Filter, Plus, FileText, 
  CheckCircle2, AlertTriangle, Clock, X, Save, ShieldAlert, Key
} from 'lucide-react';

interface NCR {
  ncr_id: string;
  ncr_code: string;
  source_module: string;
  source_id: string;
  description: string;
  severity: string;
  status: string;
  raised_by_name: string;
  assigned_to: string;
  assigned_to_name: string;
  root_cause: string;
  resolution: string;
  created_at: string;
}

export default function NCRDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedNcr, setSelectedNcr] = useState<NCR | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signature, setSignature] = useState('');

  const [formData, setFormData] = useState({
    source_module: 'Production',
    source_id: '',
    description: '',
    severity: 'Minor',
    assigned_to: '',
    status: 'OPEN',
    root_cause: '',
    resolution: ''
  });

  useEffect(() => {
    if (isAuthenticated) { fetchNCRs(); fetchUsers(); }
  }, [isAuthenticated]);

  const fetchNCRs = async () => {
    try { setLoading(true); const res = await api.get('/qms/ncrs'); setNcrs(res.data); } 
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // PATCH: switched from /users to /qms/users
  const fetchUsers = async () => {
    try {
      const res = await api.get('/qms/users');
      setUsers(res.data.filter((u: any) => ['qa', 'manager', 'admin'].includes(u.role)));
    } 
    catch (err) { console.error(err); }
  };

  const filteredNCRs = ncrs.filter(ncr => {
    const matchesSearch = ncr.ncr_code.toLowerCase().includes(searchQuery.toLowerCase()) || ncr.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ncr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = (ncr: NCR | null = null) => {
    setError(''); setSuccess(''); setSignature(''); setSelectedNcr(ncr);
    if (ncr) {
      setFormData({
        source_module: ncr.source_module, source_id: ncr.source_id || '', description: ncr.description,
        severity: ncr.severity, assigned_to: ncr.assigned_to || '', status: ncr.status,
        root_cause: ncr.root_cause || '', resolution: ncr.resolution || ''
      });
    } else {
      setFormData({
        source_module: 'Production', source_id: '', description: '', severity: 'Minor',
        assigned_to: '', status: 'OPEN', root_cause: '', resolution: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) return setError('Digital Signature is required to save records.');
    setSaving(true); setError('');

    try {
      const payload = { ...formData, signature_password: signature };
      if (selectedNcr) {
        await api.put(`/qms/ncrs/${selectedNcr.ncr_id}`, payload);
        setSuccess('NCR updated successfully.');
      } else {
        await api.post('/qms/ncrs', payload);
        setSuccess('NCR raised and assigned successfully.');
      }
      await fetchNCRs();
      setTimeout(() => { setShowModal(false); setSuccess(''); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save NCR.');
    } finally {
      setSaving(false); setSignature('');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">Critical</span>;
      case 'MAJOR': return <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">Major</span>;
      default: return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Minor</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CLOSED': return <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-4 h-4"/> Closed</span>;
      case 'CAPA_REQUIRED': return <span className="flex items-center gap-1 text-purple-400"><ShieldAlert className="w-4 h-4"/> CAPA Required</span>;
      case 'INVESTIGATING': return <span className="flex items-center gap-1 text-blue-400"><Search className="w-4 h-4"/> Investigating</span>;
      default: return <span className="flex items-center gap-1 text-red-400"><AlertOctagon className="w-4 h-4"/> Open</span>;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><AlertOctagon className="w-8 h-8 text-red-500" />Non-Conformance Reports (NCR)</h1>
            <p className="text-gray-400 mt-1">Track, investigate, and resolve quality deviations</p>
          </div>
          <button onClick={() => handleOpenModal()} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20">
            <Plus className="w-5 h-5" /> Raise New NCR
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Total NCRs</p><p className="text-3xl font-black text-white">{ncrs.length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-red-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Open Action Required</p><p className="text-3xl font-black text-red-400">{ncrs.filter(n => n.status === 'OPEN').length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-blue-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Under Investigation</p><p className="text-3xl font-black text-blue-400">{ncrs.filter(n => n.status === 'INVESTIGATING').length}</p></div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-purple-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Escalated to CAPA</p><p className="text-3xl font-black text-purple-400">{ncrs.filter(n => n.status === 'CAPA_REQUIRED').length}</p></div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 bg-dark-900/50">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search NCRs or source IDs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500 transition-colors" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48 px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white">
              <option value="all">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="CAPA_REQUIRED">CAPA Required</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4 font-medium">NCR Code</th>
                  <th className="px-6 py-4 font-medium">Source / Reference</th>
                  <th className="px-6 py-4 font-medium">Issue Description</th>
                  <th className="px-6 py-4 font-medium">Severity</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Investigator</th>
                  {/* PATCH: new Actions column */}
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400"><div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-3"></div>Loading NCRs...</td></tr>
                ) : filteredNCRs.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No Non-Conformances found.</td></tr>
                ) : (
                  filteredNCRs.map((ncr) => (
                    <tr key={ncr.ncr_id} onClick={() => handleOpenModal(ncr)} className="hover:bg-dark-700/50 transition-colors cursor-pointer group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-gray-200 group-hover:text-red-400 transition-colors">{ncr.ncr_code}</span>
                        <p className="text-xs text-gray-500 mt-1">{new Date(ncr.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-white bg-dark-900 px-2 py-1 rounded border border-dark-600">{ncr.source_module}</span>
                        <p className="text-xs text-gray-400 font-mono mt-1">{ncr.source_id || 'No Ref'}</p>
                      </td>
                      <td className="px-6 py-4"><p className="text-sm text-gray-300 line-clamp-2 max-w-md">{ncr.description}</p></td>
                      <td className="px-6 py-4 whitespace-nowrap">{getSeverityBadge(ncr.severity)}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-sm">{getStatusBadge(ncr.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><p className="text-sm text-gray-300">{ncr.assigned_to_name || <span className="text-gray-600 italic">Unassigned</span>}</p></td>
                      {/* PATCH: CAPA shortcut button — stopPropagation prevents row click */}
                      <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {ncr.status !== 'CLOSED' && (
                          <button
                            onClick={() => router.push(`/qms/capa?ncr=${ncr.ncr_id}`)}
                            className="text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors font-medium"
                          >
                            + CAPA
                          </button>
                        )}
                      </td>
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
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertOctagon className={`w-6 h-6 ${selectedNcr ? 'text-blue-400' : 'text-red-500'}`}/>
                {selectedNcr ? `Update ${selectedNcr.ncr_code}` : 'Raise Non-Conformance (NCR)'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white px-3 py-1 bg-dark-800 rounded">Close</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
              {success && <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{success}</div>}

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-dark-700 pb-2">1. Incident Details</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Source Area *</label>
                    <select disabled={!!selectedNcr} value={formData.source_module} onChange={e => setFormData({...formData, source_module: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500 disabled:opacity-50">
                      <option value="Production">Production / Bottling</option>
                      <option value="Warehouse">Warehouse / Receiving</option>
                      <option value="Quality Control">Quality Control Lab</option>
                      <option value="Maintenance">Maintenance & Engineering</option>
                      <option value="Audit">Internal / External Audit</option>
                      <option value="Customer">Customer Complaint</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Reference ID (e.g. Batch No, PO No)</label>
                    <input disabled={!!selectedNcr} type="text" value={formData.source_id} onChange={e => setFormData({...formData, source_id: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500 disabled:opacity-50" placeholder="PROD-R500-..." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Detailed Description of Non-Conformance *</label>
                  <textarea disabled={!!selectedNcr} required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500 disabled:opacity-50" placeholder="Describe exactly what went wrong..." />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-dark-700 pb-2 mt-6">2. Investigation & Action</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Severity Level</label>
                    <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-blue-500">
                      <option value="Minor">Minor (Easily corrected)</option>
                      <option value="Major">Major (Product loss, moderate risk)</option>
                      <option value="Critical">Critical (Food safety risk, recall risk)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Assign Investigator</label>
                    <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-blue-500">
                      <option value="">-- Unassigned --</option>
                      {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>)}
                    </select>
                  </div>
                </div>
                {selectedNcr && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm text-gray-300 mb-1">Root Cause Analysis</label>
                      <textarea value={formData.root_cause} onChange={e => setFormData({...formData, root_cause: e.target.value})} rows={3} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-blue-500" placeholder="Why did this happen?..." />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm text-gray-300 mb-1">Immediate Correction / Resolution</label>
                      <textarea value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} rows={3} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-blue-500" placeholder="What was done immediately to fix the issue?..." />
                    </div>
                    <div className="bg-dark-900 p-4 rounded-lg border border-dark-600">
                      <label className="block text-sm font-bold text-white mb-2">Update NCR Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-dark-950 border border-dark-500 rounded-lg text-white font-bold tracking-wider focus:border-primary-500">
                        <option value="OPEN">OPEN - Needs Attention</option>
                        <option value="INVESTIGATING">INVESTIGATING - Root Cause Analysis in progress</option>
                        <option value="CAPA_REQUIRED">ESCALATE - CAPA Required for systemic fix</option>
                        <option value="CLOSED">CLOSED - Resolved & Verified</option>
                      </select>
                      {formData.status === 'CAPA_REQUIRED' && (
                        <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
                          <ShieldAlert className="w-4 h-4"/> Saving this will flag the NCR for the formal CAPA workflow.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner mt-6">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-primary-400" /> Digital Signature Required</h3>
                <p className="text-xs text-gray-400 mb-3">By entering your password, you electronically sign off on this QMS Record per 21 CFR Part 11 guidelines.</p>
                <input type="password" value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder="Enter your login password" className="w-full px-4 py-3 bg-dark-950 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 font-mono tracking-widest" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 hover:text-white transition-colors bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !signature} className={`px-8 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 ${selectedNcr ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}>
                  {saving ? 'Verifying...' : <><Save className="w-4 h-4"/> {selectedNcr ? 'Sign & Update Record' : 'Sign & Submit NCR'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}