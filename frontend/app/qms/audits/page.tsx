'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal';
import { 
  ClipboardCheck, CalendarDays, Plus, CheckCircle2, 
  AlertTriangle, Clock, X, Save, Search, User, Key, AlertOctagon,
  FileText, Users, Printer
} from 'lucide-react';

interface Audit {
  audit_id: string;
  audit_code: string;
  audit_type: string;
  audit_date: string;
  lead_auditor: string;
  auditor_name: string;
  scope: string;
  status: string;
  report_data: string;
  next_audit_date: string;
  invited_members: string[];
}

export default function AuditsDashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  const [audits, setAudits] = useState<Audit[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [showNCRModal, setShowNCRModal] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signature, setSignature] = useState('');

  const [formData, setFormData] = useState({
    audit_type: 'GMP',
    audit_date: '',
    lead_auditor: '',
    scope: '',
    status: 'PLANNED',
    report_data: '',
    next_audit_date: '',
    invited_members: [] as string[]
  });

  useEffect(() => {
    if (isAuthenticated) { fetchData(); }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [auditRes, userRes] = await Promise.all([
        api.get('/qms/audits'),
        api.get('/users')
      ]);
      setAudits(auditRes.data);
      setUsers(userRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filteredAudits = audits.filter(a => 
    a.audit_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.audit_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (audit: Audit | null = null) => {
    setError(''); setSuccess(''); setSignature(''); setSelectedAudit(audit);
    if (audit) {
      setFormData({
        audit_type: audit.audit_type,
        audit_date: new Date(audit.audit_date).toISOString().slice(0, 16),
        lead_auditor: audit.lead_auditor || '',
        scope: audit.scope,
        status: audit.status,
        report_data: audit.report_data || '',
        next_audit_date: audit.next_audit_date ? new Date(audit.next_audit_date).toISOString().slice(0, 10) : '',
        invited_members: audit.invited_members || []
      });
    } else {
      setFormData({
        audit_type: 'GMP', audit_date: new Date().toISOString().slice(0, 16),
        lead_auditor: '', scope: '', status: 'PLANNED', report_data: '', next_audit_date: '', invited_members: []
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.status === 'COMPLETED' && !signature) return setError('Digital Signature required to officially close an audit.');
    setSaving(true); setError('');

    try {
      const payload = { ...formData, signature_password: signature };
      if (selectedAudit) {
        await api.put(`/qms/audits/${selectedAudit.audit_id}`, payload);
        setSuccess('Audit updated successfully.');
      } else {
        await api.post('/qms/audits', payload);
        setSuccess('Audit scheduled and invites sent successfully.');
      }
      
      await fetchData();
      setTimeout(() => { setShowModal(false); setSuccess(''); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save audit.');
    } finally {
      setSaving(false); setSignature('');
    }
  };

  const handleParticipantToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      invited_members: prev.invited_members.includes(userId)
        ? prev.invited_members.filter(id => id !== userId)
        : [...prev.invited_members, userId]
    }));
  };

  const getParticipantNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return 'None';
    return ids.map(id => users.find(u => u.user_id === id)?.full_name || 'Unknown User').join(', ');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-green-500/20 w-max"><CheckCircle2 className="w-3 h-3"/> Completed</span>;
      case 'IN_PROGRESS': return <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-500/20 w-max"><Search className="w-3 h-3"/> In Progress</span>;
      default: return <span className="flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-500/20 w-max"><CalendarDays className="w-3 h-3"/> Planned</span>;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <div className="print:hidden">
        <DashboardLayout>
          <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <ClipboardCheck className="w-8 h-8 text-teal-500" />
                  Internal Audits Register
                </h1>
                <p className="text-gray-400 mt-1">Schedule, execute, and track GMP and ISO compliance audits</p>
              </div>
              <button onClick={() => handleOpenModal()} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20">
                <Plus className="w-5 h-5" /> Schedule New Audit
              </button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-gray-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Planned Audits</p><p className="text-3xl font-black text-white">{audits.filter(a => a.status === 'PLANNED').length}</p></div>
              <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-blue-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">In Progress</p><p className="text-3xl font-black text-blue-400">{audits.filter(a => a.status === 'IN_PROGRESS').length}</p></div>
              <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-green-500"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Completed</p><p className="text-3xl font-black text-green-400">{audits.filter(a => a.status === 'COMPLETED').length}</p></div>
            </div>

            {/* List & Table */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-dark-700 bg-dark-900/50">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Search by Audit Code or Type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-4 font-medium">Audit Code</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Lead Auditor</th>
                      <th className="px-6 py-4 font-medium">Scope</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {loading ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400"><div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-3"></div>Loading Audits...</td></tr>
                    ) : filteredAudits.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No Audits found.</td></tr>
                    ) : (
                      filteredAudits.map((audit) => (
                        <tr key={audit.audit_id} onClick={() => handleOpenModal(audit)} className="hover:bg-dark-700/50 transition-colors cursor-pointer group">
                          <td className="px-6 py-4 whitespace-nowrap"><span className="font-mono text-sm font-bold text-gray-200 group-hover:text-teal-400">{audit.audit_code}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-bold text-white bg-dark-900 px-2 py-1 rounded border border-dark-600">{audit.audit_type}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(audit.audit_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-2"><User className="w-4 h-4 text-gray-500"/> {audit.auditor_name || 'Unassigned'}</td>
                          <td className="px-6 py-4"><p className="text-sm text-gray-300 line-clamp-1">{audit.scope}</p></td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(audit.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* AUDIT MODAL */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-start pt-10 overflow-y-auto p-4 print:hidden">
              <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-3xl shadow-2xl mb-10">
                <div className="px-6 py-4 border-b border-dark-700 bg-dark-900 sticky top-0 z-10 flex justify-between items-center rounded-t-xl">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-teal-500"/>{selectedAudit ? `${selectedAudit.audit_code} Overview` : 'Schedule Internal Audit'}</h2>
                  <div className="flex gap-2">
                    {/* LOG FINDING / NCR INTEGRATION BUTTON */}
                    {selectedAudit && selectedAudit.status === 'IN_PROGRESS' && (
                      <button type="button" onClick={() => setShowNCRModal(true)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded flex items-center gap-2 text-sm font-bold">
                        <AlertOctagon className="w-4 h-4"/> Log Finding (NCR)
                      </button>
                    )}
                    {/* NEW: PRINT AUDIT REPORT BUTTON */}
                    {selectedAudit && (
                      <button type="button" onClick={() => window.print()} className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white rounded flex items-center gap-2 text-sm font-bold">
                        <Printer className="w-4 h-4"/> Print Report
                      </button>
                    )}
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white px-3 py-1 bg-dark-800 rounded border border-dark-600">Close</button>
                  </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
                  {success && <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{success}</div>}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Audit Type *</label>
                      <select disabled={!!selectedAudit} value={formData.audit_type} onChange={e => setFormData({...formData, audit_type: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500 disabled:opacity-50">
                        <option value="GMP">GMP / Hygiene Walkthrough</option>
                        <option value="ISO 9001">ISO 9001:2015 QMS Audit</option>
                        <option value="HACCP">HACCP & Food Safety</option>
                        <option value="Internal QA">Internal QA Spot Check</option>
                        <option value="External">External Regulatory Audit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Audit Date & Time *</label>
                      <input type="datetime-local" required value={formData.audit_date} onChange={e => setFormData({...formData, audit_date: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-300 mb-1">Lead Auditor *</label>
                      <select required value={formData.lead_auditor} onChange={e => setFormData({...formData, lead_auditor: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500">
                        <option value="">-- Select Lead Auditor --</option>
                        {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-300 mb-1">Audit Scope / Areas Covered *</label>
                      <textarea required value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value})} rows={2} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500" placeholder="e.g., Water Treatment Room, Filling Line 1, Warehouse..." />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm text-gray-300 mb-1 flex items-center gap-2"><Users className="w-4 h-4"/> Invite Participants (Audit Team)</label>
                      <div className="bg-dark-950 border border-dark-600 rounded-lg p-4 max-h-48 overflow-y-auto grid grid-cols-2 gap-3">
                        {users.map(u => (
                          <label key={u.user_id} className="flex items-center gap-3 p-2 hover:bg-dark-800 rounded cursor-pointer transition-colors border border-transparent hover:border-dark-600">
                            <input
                              type="checkbox"
                              checked={formData.invited_members.includes(u.user_id)}
                              onChange={() => handleParticipantToggle(u.user_id)}
                              className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-teal-500 focus:ring-teal-500"
                            />
                            <div>
                              <p className="text-sm text-white font-medium">{u.full_name}</p>
                              <p className="text-xs text-gray-500 uppercase">{u.role}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedAudit && (
                    <div className="space-y-4 pt-4 border-t border-dark-700">
                      <div className="bg-dark-900 p-4 rounded-lg border border-dark-600">
                        <label className="block text-sm font-bold text-white mb-2">Execution Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-dark-950 border border-dark-500 rounded-lg text-white font-bold tracking-wider focus:border-teal-500">
                          <option value="PLANNED">PLANNED - Scheduled</option>
                          <option value="IN_PROGRESS">IN PROGRESS - Currently Executing</option>
                          <option value="COMPLETED">COMPLETED - Report Finalized</option>
                        </select>
                      </div>

                      {formData.status !== 'PLANNED' && (
                        <div>
                          <label className="block text-sm text-gray-300 mb-1 flex items-center gap-2"><FileText className="w-4 h-4"/> Executive Summary / Audit Report</label>
                          <textarea value={formData.report_data} onChange={e => setFormData({...formData, report_data: e.target.value})} rows={5} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500" placeholder="Summarize overall findings, commendations, and note any NCRs raised..." />
                        </div>
                      )}

                      {formData.status === 'COMPLETED' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-300 mb-1">Next Scheduled Audit</label>
                            <input type="date" value={formData.next_audit_date} onChange={e => setFormData({...formData, next_audit_date: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-teal-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.status === 'COMPLETED' && (
                    <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner mt-6">
                      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-teal-400" /> Lead Auditor Signature Required</h3>
                      <p className="text-xs text-gray-400 mb-3">By entering your password, you verify that this audit was conducted according to VILAGIO QMS standards.</p>
                      <input type="password" value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder="Enter your login password" className="w-full px-4 py-3 bg-dark-950 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-teal-500 font-mono tracking-widest" />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 hover:text-white transition-colors bg-dark-900 rounded-lg">Cancel</button>
                    <button type="submit" disabled={saving || (formData.status === 'COMPLETED' && !signature)} className={`px-8 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 ${selectedAudit ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'}`}>
                      {saving ? 'Saving...' : <><Save className="w-4 h-4"/> {selectedAudit ? 'Save Audit Data' : 'Schedule Audit'}</>}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* Embedded NCR Integration */}
          {selectedAudit && (
            <RaiseNCRModal 
              isOpen={showNCRModal}
              onClose={() => setShowNCRModal(false)}
              sourceModule="Audit"
              sourceId={selectedAudit.audit_code}
              onSuccess={() => alert('Audit Finding (NCR) successfully logged into the QMS.')}
            />
          )}
          
        </DashboardLayout>
      </div>

      {/* ========================================================= */}
      {/* PRINT ONLY VIEW - FORMAL AUDIT REPORT (ISO/GMP Format)    */}
      {/* ========================================================= */}
      {selectedAudit && (
        <div className="hidden print:block bg-white text-black font-sans w-full max-w-5xl mx-auto p-8">
          
          {/* Official Header */}
          <div className="border-b-2 border-black pb-4 mb-8">
            <div className="flex items-center gap-6 mb-4">
              <img 
                src="/logo.png" 
                alt="Vilagio Logo" 
                className="h-16 w-auto object-contain"
                onError={(e) => { e.currentTarget.src = "/logo-dark.png"; }}
              />
              <div>
                <h1 className="text-2xl font-black uppercase tracking-widest text-black mb-1">VILAGIO TRADING LIMITED</h1>
                <p className="text-xs text-gray-800">Plot No. 28441, Gymkhana | 50/50 Kitwe Road | CHINGOLA</p>
                <p className="text-xs text-gray-800">Email: quality@vilag.io | Quality System ISO 9001 & GMP Compliant</p>
              </div>
            </div>
            
            <div className="text-center bg-gray-100 py-2 border-y-2 border-black my-4">
              <h2 className="text-xl font-black uppercase tracking-widest">OFFICIAL INTERNAL AUDIT REPORT</h2>
            </div>

            {/* Document Metadata Table */}
            <table className="w-full text-sm border border-black mt-6">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold w-1/4 border-r border-black uppercase bg-gray-50">Audit Code</td>
                  <td className="p-2 font-bold text-base w-1/4 border-r border-black">{selectedAudit.audit_code}</td>
                  <td className="p-2 font-bold w-1/4 border-r border-black uppercase bg-gray-50">Audit Status</td>
                  <td className="p-2 font-bold text-base w-1/4">{selectedAudit.status}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Audit Type</td>
                  <td className="p-2 border-r border-black">{selectedAudit.audit_type}</td>
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Execution Date</td>
                  <td className="p-2">{new Date(selectedAudit.audit_date).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Lead Auditor</td>
                  <td className="p-2 border-r border-black font-medium">{selectedAudit.auditor_name || formData.lead_auditor}</td>
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Next Audit Due</td>
                  <td className="p-2">{selectedAudit.next_audit_date ? new Date(selectedAudit.next_audit_date).toLocaleDateString() : 'TBD'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Audit Body Content */}
          <div className="space-y-8 text-sm">
            {/* Audit Scope */}
            <div>
              <h3 className="font-bold text-base border-b-2 border-black mb-3 pb-1 uppercase tracking-wide">
                1. Audit Scope & Areas Inspected
              </h3>
              <div className="whitespace-pre-wrap leading-relaxed text-justify px-2 p-3 bg-gray-50 border border-gray-300">
                {selectedAudit.scope || formData.scope}
              </div>
            </div>

            {/* Audit Team */}
            <div>
              <h3 className="font-bold text-base border-b-2 border-black mb-3 pb-1 uppercase tracking-wide">
                2. Participating Audit Team
              </h3>
              <div className="whitespace-pre-wrap leading-relaxed text-justify px-2">
                {getParticipantNames(selectedAudit.invited_members || formData.invited_members)}
              </div>
            </div>

            {/* Findings & Summary */}
            <div>
              <h3 className="font-bold text-base border-b-2 border-black mb-3 pb-1 uppercase tracking-wide">
                3. Executive Summary & Findings
              </h3>
              <div className="whitespace-pre-wrap leading-relaxed text-justify px-2">
                {selectedAudit.report_data || formData.report_data || <span className="text-gray-500 italic">No final report data logged yet.</span>}
              </div>
            </div>
          </div>

          {/* Print Footer / Signatures */}
          <div className="mt-16 pt-6 border-t-2 border-black text-xs">
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <p className="font-bold mb-2 uppercase text-gray-600">Lead Auditor Signature</p>
                <p className={`text-base font-bold pb-1 ${selectedAudit.status === 'COMPLETED' ? 'italic text-blue-800' : 'text-gray-400'}`}>
                  {selectedAudit.status === 'COMPLETED' ? `Electronically Signed by ${selectedAudit.auditor_name}` : 'Pending Completion'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold mb-2 uppercase text-gray-600">Approval Date</p>
                <p className="text-base font-medium">
                  {selectedAudit.status === 'COMPLETED' ? new Date().toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="text-center font-bold text-[10px] uppercase tracking-widest border-t border-gray-300 pt-4 text-red-700">
              Printed copies are uncontrolled - Verify against Vilagio QMS before use
            </div>
          </div>

        </div>
      )}
    </>
  );
}