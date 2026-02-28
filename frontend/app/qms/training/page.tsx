'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  GraduationCap, CheckCircle2, XCircle, Clock, 
  Search, ShieldCheck, Key, Save, AlertTriangle, FileText, X
} from 'lucide-react';

interface MatrixData {
  users: { user_id: string; full_name: string; role: string }[];
  documents: { doc_id: string; doc_code: string; doc_name: string; current_version_id: string }[];
  records: { user_id: string; doc_id: string; version_id: string; acknowledged_at: string }[];
}

export default function TrainingMatrixPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Acknowledge Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isAuthenticated) fetchMatrix();
  }, [isAuthenticated]);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await api.get('/qms/training');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAcknowledge = (doc: any) => {
    setSelectedDoc(doc);
    setSignature('');
    setError('');
    setShowModal(true);
  };

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) return setError('Digital Signature is required.');
    
    setSaving(true);
    setError('');

    try {
      await api.post('/qms/training/acknowledge', {
        doc_id: selectedDoc.doc_id,
        signature_password: signature
      });
      setSuccess('Training successfully acknowledged.');
      await fetchMatrix();
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge document.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  // Helper to check if a user is trained on a specific document version
  const checkTrainingStatus = (userId: string, docId: string, currentVerId: string) => {
    if (!data) return null;
    const record = data.records.find(r => r.user_id === userId && r.doc_id === docId);
    
    if (!record) return { status: 'MISSING', date: null };
    if (record.version_id !== currentVerId) return { status: 'OUTDATED', date: record.acknowledged_at };
    return { status: 'TRAINED', date: record.acknowledged_at };
  };

  const filteredDocs = data?.documents.filter(d => 
    d.doc_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.doc_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-blue-500" />
              SOP Training Matrix
            </h1>
            <p className="text-gray-400 mt-1">Ensure all personnel are trained on current governing documents</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
        ) : !data ? (
          <div className="text-center text-red-400">Failed to load training matrix.</div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-700">
                  <th className="px-4 py-4 text-xs font-bold uppercase text-gray-400 min-w-[200px] sticky left-0 z-10 bg-dark-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    Employee
                  </th>
                  {filteredDocs.map(doc => (
                    <th key={doc.doc_id} className="px-4 py-4 min-w-[160px] border-l border-dark-700 align-top group">
                      <p className="text-xs font-mono font-bold text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">{doc.doc_code}</p>
                      <p className="text-xs text-gray-300 line-clamp-2" title={doc.doc_name}>{doc.doc_name}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {data.users.map(u => (
                  <tr key={u.user_id} className="hover:bg-dark-700/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 z-10 bg-dark-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-r border-dark-700">
                      <p className="text-sm font-bold text-white">{u.full_name}</p>
                      <p className="text-xs text-gray-500 uppercase">{u.role}</p>
                    </td>
                    {filteredDocs.map(doc => {
                      const tr = checkTrainingStatus(u.user_id, doc.doc_id, doc.current_version_id);
                      const isMe = u.user_id === user?.user_id;

                      return (
                        <td key={doc.doc_id} className="px-4 py-3 border-l border-dark-700 text-center">
                          {tr?.status === 'TRAINED' && (
                            <div className="flex flex-col items-center justify-center text-green-400 bg-green-500/10 rounded py-1 px-2 border border-green-500/20">
                              <CheckCircle2 className="w-4 h-4 mb-0.5" />
                              <span className="text-[10px] font-bold">ACKNOWLEDGED</span>
                              <span className="text-[9px] text-gray-400">{new Date(tr.date!).toLocaleDateString()}</span>
                            </div>
                          )}
                          
                          {tr?.status === 'OUTDATED' && (
                            <div className="flex flex-col items-center justify-center text-yellow-400 bg-yellow-500/10 rounded py-1 px-2 border border-yellow-500/20">
                              <Clock className="w-4 h-4 mb-0.5" />
                              <span className="text-[10px] font-bold">NEW VER RELEASED</span>
                              {isMe && (
                                <button onClick={() => handleOpenAcknowledge(doc)} className="mt-1 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded transition-colors">Read & Sign</button>
                              )}
                            </div>
                          )}

                          {tr?.status === 'MISSING' && (
                            <div className="flex flex-col items-center justify-center text-red-400 bg-red-500/10 rounded py-1 px-2 border border-red-500/20">
                              <XCircle className="w-4 h-4 mb-0.5" />
                              <span className="text-[10px] font-bold">PENDING TRAINING</span>
                              {isMe && (
                                <button onClick={() => handleOpenAcknowledge(doc)} className="mt-1 text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-300 px-2 py-0.5 rounded transition-colors">Read & Sign</button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACKNOWLEDGE MODAL */}
      {showModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-xl shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center rounded-t-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-blue-500"/> Document Acknowledgment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleAcknowledgeSubmit} className="p-6 space-y-6">
              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
              {success && <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{success}</div>}

              <div className="bg-dark-900 border border-dark-700 rounded-lg p-5 text-center">
                <FileText className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <p className="text-sm font-mono text-gray-400 mb-1">{selectedDoc.doc_code}</p>
                <h3 className="text-lg font-bold text-white">{selectedDoc.doc_name}</h3>
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={() => window.open(`/qms/documents/${selectedDoc.doc_id}`, '_blank')} className="text-sm text-blue-400 hover:text-blue-300 underline font-medium">Click here to read the document in a new tab</button>
                </div>
              </div>

              <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-blue-400" /> Electronic Signature Required</h3>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  By entering your password below, you legally verify that you have read, understood, and agree to adhere to the procedures outlined in this officially released QMS document in compliance with 21 CFR Part 11.
                </p>
                <input type="password" value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder="Enter your login password" className="w-full px-4 py-3 bg-dark-950 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono tracking-widest" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 hover:text-white transition-colors bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !signature} className={`px-8 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 bg-blue-600 hover:bg-blue-700 shadow-blue-500/20`}>
                  {saving ? 'Verifying...' : <><Save className="w-4 h-4"/> Sign & Acknowledge</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}