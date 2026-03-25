'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Search, Filter, Eye, FileText, 
  CheckCircle2, Clock, AlertCircle, FileEdit,
  FolderTree, BookOpen, Link, Plus, X, Save, RefreshCw
} from 'lucide-react';

interface QMSDocument {
  doc_id: string;
  doc_code: string;
  doc_name: string;
  doc_type: string;
  status: string;
  erp_link_module: string;
  section_id: string;     // <-- Added this to fix the TypeScript error
  section_code: string;
  section_name: string;
  color_code: string;
  version_number: string;
  effective_date: string;
  author_name: string;
}

interface QMSSection {
  section_id: string;
  section_code: string;
  section_name: string;
}

function MasterDocumentRegisterContent() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  
  const [documents, setDocuments] = useState<QMSDocument[]>([]);
  const [sections, setSections] = useState<QMSSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const [newDoc, setNewDoc] = useState({
    doc_code: '',
    doc_name: '',
    doc_type: 'SOP',
    section_id: '',
    erp_link_module: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  // NEW AUTO-SEQUENCING EFFECT
  useEffect(() => {
    if (showCreateModal && newDoc.section_id && newDoc.doc_type) {
      const fetchNextCode = async () => {
        setIsGeneratingCode(true);
        try {
          const res = await api.get(`/qms/documents/next-code?section_id=${newDoc.section_id}&doc_type=${newDoc.doc_type}`);
          if (res.data && res.data.next_code) {
            setNewDoc(prev => ({ ...prev, doc_code: res.data.next_code }));
          }
        } catch (e) {
          console.error("Failed to fetch next doc code", e);
        } finally {
          setIsGeneratingCode(false);
        }
      };
      fetchNextCode();
    }
  }, [newDoc.section_id, newDoc.doc_type, showCreateModal]);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [docsRes, sectionsRes] = await Promise.all([
        api.get('/qms/documents'),
        api.get('/qms/sections')
      ]);
      
      setDocuments(docsRes.data);
      setSections(sectionsRes.data);
      
      if (docsRes.data.length > 0 && !newDoc.section_id) {
         setNewDoc(prev => ({ ...prev, section_id: sectionsRes.data[0]?.section_id || '' }));
      }

    } catch (err: any) {
      setError('Failed to load QMS registry. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      setCreateError('');
      
      const response = await api.post('/qms/documents', newDoc);
      
      setShowCreateModal(false);
      router.push(`/qms/documents/${response.data.doc_id}`);
      
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create document record.');
      setCreateLoading(false);
    }
  };

  // Derived filtered documents
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.doc_code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      doc.doc_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter ? doc.status === statusFilter : true;
    const matchesSection = sectionFilter ? doc.section_id === sectionFilter : true;
    
    return matchesSearch && matchesStatus && matchesSection;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'REVIEW': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DRAFT': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'PLANNED': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'SUPERSEDED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'SOP': return <FileText className="w-5 h-5 text-blue-400" />;
      case 'POL': return <BookOpen className="w-5 h-5 text-purple-400" />;
      case 'FRM': return <FileEdit className="w-5 h-5 text-green-400" />;
      case 'CHK': return <CheckCircle2 className="w-5 h-5 text-yellow-400" />;
      case 'MAN': return <FolderTree className="w-5 h-5 text-indigo-400" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FolderTree className="w-8 h-8 text-primary-500" />
              Master Document Register
            </h1>
            <p className="text-gray-400 mt-1">Central repository for all controlled QMS documents and records.</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-bold shadow-lg shadow-primary-500/20"
          >
            <Plus className="w-5 h-5" />
            Plan New Document
          </button>
        </div>

        {/* Filters Row */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search document code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
            />
          </div>
          
          <div className="w-full lg:w-48 relative">
            <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 appearance-none outline-none"
            >
              <option value="">All Sections</option>
              {sections.map(s => (
                <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
              ))}
            </select>
          </div>

          <div className="w-full lg:w-48 relative">
            <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 appearance-none outline-none"
            >
              <option value="">All Statuses</option>
              <option value="RELEASED">Released (Active)</option>
              <option value="REVIEW">Under QA Review</option>
              <option value="DRAFT">In Draft</option>
              <option value="PLANNED">Planned</option>
              <option value="SUPERSEDED">Superseded (Archived)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Documents Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900/80 border-b border-dark-700">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Code & Info</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Title</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Section & Links</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Version</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
                      <p className="text-gray-400">Loading QMS repository...</p>
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <FolderTree className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-lg font-medium text-white mb-1">No documents found</p>
                      <p className="text-gray-500 text-sm">Adjust your filters or plan a new document.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr 
                      key={doc.doc_id} 
                      className="hover:bg-dark-700/50 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-dark-900 border border-dark-700 rounded-lg shadow-inner">
                            {getDocTypeIcon(doc.doc_type)}
                          </div>
                          <div>
                            <p className="font-mono font-bold text-primary-400 text-sm">{doc.doc_code}</p>
                            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider">{doc.doc_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-white text-[15px]">{doc.doc_name}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {doc.author_name ? `Authored by ${doc.author_name}` : 'Author Unassigned'} 
                          {doc.effective_date && ` • Effective: ${new Date(doc.effective_date).toLocaleDateString()}`}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-dark-900 border border-dark-700 rounded text-xs font-bold text-gray-300" style={{borderLeftColor: doc.color_code, borderLeftWidth: '3px'}}>
                            {doc.section_code}
                          </span>
                          {doc.erp_link_module && (
                            <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-xs font-medium flex items-center gap-1">
                              <Link className="w-3 h-3"/> {doc.erp_link_module}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-mono font-bold text-gray-300 bg-dark-900 px-2 py-1 rounded">
                          {doc.version_number ? `v${doc.version_number}` : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider shadow-sm ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => router.push(`/qms/documents/${doc.doc_id}`)}
                          className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-primary-600 rounded-lg transition-all shadow-sm inline-block"
                          title="View Document Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CREATE NEW DOCUMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-primary-500" />
                Plan New QMS Document
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleCreateDocument} className="p-6 space-y-6">
              
              {createError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{createError}</p>
                </div>
              )}

              <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                <label className="block text-sm font-bold text-gray-300 mb-2">1. Official Document Code</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    value={newDoc.doc_code} 
                    onChange={(e) => setNewDoc({...newDoc, doc_code: e.target.value.toUpperCase()})} 
                    placeholder="e.g. QA-PRO-SOP-011" 
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono uppercase focus:border-primary-500" 
                  />
                  {isGeneratingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Automatically sequenced based on Section & Type.</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">2. Document Type</label>
                  <select 
                    required
                    value={newDoc.doc_type} 
                    onChange={(e) => setNewDoc({...newDoc, doc_type: e.target.value})}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  >
                    <option value="SOP">SOP - Standard Operating Procedure</option>
                    <option value="POL">POL - Corporate Policy</option>
                    <option value="MAN">MAN - Quality Manual</option>
                    <option value="FRM">FRM - Standard Form</option>
                    <option value="LOG">LOG - Record Log</option>
                    <option value="CHK">CHK - Checklist</option>
                    <option value="REG">REG - Master Register</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">3. Document Title</label>
                  <input 
                    type="text" 
                    required
                    value={newDoc.doc_name} 
                    onChange={(e) => setNewDoc({...newDoc, doc_name: e.target.value})}
                    placeholder="e.g. Daily Line Clearance Procedure"
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">4. Department / Section</label>
                  <select 
                    required
                    value={newDoc.section_id} 
                    onChange={(e) => setNewDoc({...newDoc, section_id: e.target.value})}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  >
                    <option value="">Select Section...</option>
                    {sections.map(s => (
                      <option key={s.section_id} value={s.section_id}>{s.section_code} - {s.section_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">5. ERP Module Link (Optional)</label>
                  <select 
                    value={newDoc.erp_link_module} 
                    onChange={(e) => setNewDoc({...newDoc, erp_link_module: e.target.value})}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  >
                    <option value="">None - Standalone Document</option>
                    <option value="Production">Production Dashboard</option>
                    <option value="Inventory">Inventory Management</option>
                    <option value="HR">Human Resources</option>
                    <option value="IT">Information Technology</option>
                    <option value="QC Lab">QC Lab</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium transition-colors bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={createLoading || isGeneratingCode} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50">
                  {createLoading ? 'Generating...' : <><Save className="w-5 h-5"/> Generate Template & Edit</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

export default function MasterDocumentRegister() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-primary-500">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <p className="font-bold tracking-widest uppercase text-sm">Loading QMS Register...</p>
      </div>
    }>
      <MasterDocumentRegisterContent />
    </Suspense>
  );
}