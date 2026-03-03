'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, Save, Send, CheckCircle2, XCircle, 
  History, ShieldCheck, FileSignature, AlertCircle, 
  FileEdit, Clock, Key, X, Printer, FilePlus, RefreshCw
} from 'lucide-react';

const STANDARD_SECTIONS = [
  { id: 'purpose', title: '1. PURPOSE', desc: 'What this document governs and why it exists.' },
  { id: 'scope', title: '2. SCOPE', desc: 'Who and what this applies to. Explicit exclusions noted.' },
  { id: 'definitions', title: '3. DEFINITIONS', desc: 'Key specialist terms.' },
  { id: 'responsibilities', title: '4. RESPONSIBILITIES', desc: 'Role | Responsibility. Who owns, executes, verifies.' },
  { id: 'materials', title: '5. REQUIRED MATERIALS / EQUIPMENT', desc: 'Tools, chemicals, PPE, equipment.' },
  { id: 'procedure', title: '6. PROCEDURE / INSTRUCTIONS', desc: 'Numbered steps. Critical steps marked.' },
  { id: 'criteria', title: '7. ACCEPTANCE CRITERIA / LIMITS', desc: 'Quantitative pass/fail criteria.' },
  { id: 'records', title: '8. RECORDS REQUIRED', desc: 'Which forms, logs, or registers must be completed.' },
  { id: 'related', title: '9. RELATED DOCUMENTS', desc: 'Codes of linked documents.' }
];

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [doc, setDoc] = useState<any>(null);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Editor state
  const [content, setContent] = useState<Record<string, string>>({});
  
  // Approval Modal state
  const [showApproval, setShowApproval] = useState(false);
  const [signature, setSignature] = useState('');

  // Edit Metadata Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [editData, setEditData] = useState({
    doc_code: '',
    doc_name: '',
    doc_type: '',
    section_id: '',
    erp_link_module: ''
  });
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    if (params.id) fetchDocument();
  }, [params.id]);

  // NEW: Auto-sequence generator for the Edit Modal
  useEffect(() => {
    if (showEditModal && editData.section_id && editData.doc_type && doc) {
      if (editData.section_id !== doc.section_id || editData.doc_type !== doc.doc_type) {
        const fetchNextCode = async () => {
          setIsGeneratingCode(true);
          try {
            const res = await api.get(`/qms/documents/next-code?section_id=${editData.section_id}&doc_type=${editData.doc_type}`);
            if (res.data && res.data.next_code) {
              setEditData(prev => ({ ...prev, doc_code: res.data.next_code }));
            }
          } catch (e) {
            console.error("Failed to fetch next doc code for edit", e);
          } finally {
            setIsGeneratingCode(false);
          }
        };
        fetchNextCode();
      }
    }
  }, [editData.section_id, editData.doc_type, showEditModal, doc]);

  const handleOpenEditModal = () => {
    setEditData({
      doc_code: doc.doc_code,
      doc_name: doc.doc_name,
      doc_type: doc.doc_type,
      section_id: doc.section_id,
      erp_link_module: doc.erp_link_module || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put(`/qms/documents/${doc.doc_id}`, editData);
      setShowEditModal(false);
      await fetchDocument();
      setSuccess('Document details updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update document details.');
    } finally {
      setSaving(false);
    }
  };

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/qms/documents/${params.id}`);
      setDoc(res.data);

      api.get('/qms/sections').then(res => setSections(res.data)).catch(e => console.error(e));
      
      if (res.data.versions && res.data.versions.length > 0) {
        const latest = res.data.versions[0];
        setActiveVersion(latest);
        setContent(latest.content_data || {});
      }
    } catch (err) {
      setError('Failed to load document details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    try {
      setSaving(true);
      const res = await api.post(`/qms/documents/${doc.doc_id}/draft`);
      await fetchDocument(); 
      setSuccess(`Draft v${res.data.version_number} created successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeVersion) return;
    try {
      setSaving(true);
      await api.put(`/qms/versions/${activeVersion.version_id}`, { content_data: content });
      setSuccess('Draft saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!activeVersion) return;
    if (!confirm('Are you sure you want to submit this document for QA Review? You will no longer be able to edit it.')) return;
    
    try {
      setSaving(true);
      await api.put(`/qms/versions/${activeVersion.version_id}`, { content_data: content }); 
      await api.post(`/qms/versions/${activeVersion.version_id}/submit`);
      await fetchDocument();
      setSuccess('Document submitted for QA Review. Notification sent.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit document');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVersion || !signature) return;
    
    try {
      setSaving(true);
      setError('');
      await api.post(`/qms/versions/${activeVersion.version_id}/approve`, {
        signature_password: signature
      });
      setShowApproval(false);
      await fetchDocument();
      setSuccess('Document officially released!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve document. Invalid signature?');
    } finally {
      setSaving(false);
      setSignature('');
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div></div></DashboardLayout>;
  if (!doc) return <DashboardLayout><div className="p-10 text-center text-red-400">Document not found</div></DashboardLayout>;

  const isDraft = activeVersion?.status === 'DRAFT';
  const isReview = activeVersion?.status === 'REVIEW';
  const isReleased = activeVersion?.status === 'RELEASED';
  const isAuthor = activeVersion?.authored_by === user?.user_id;
  const canApprove = ['admin', 'qa', 'manager', 'ceo'].includes(user?.role || '');

  const getDocTypeString = (type: string) => {
    switch(type) {
      case 'SOP': return 'STANDARD OPERATING PROCEDURE';
      case 'POL': return 'CORPORATE POLICY';
      case 'MAN': return 'QUALITY MANUAL';
      case 'FRM': return 'STANDARD FORM';
      case 'LOG': return 'STANDARD RECORD LOG';
      case 'CHK': return 'STANDARD CHECKLIST';
      case 'REG': return 'MASTER REGISTER';
      default: return 'CONTROLLED DOCUMENT';
    }
  };

  const isUniversalTemplate = content.html_content !== undefined || (doc.doc_type !== 'SOP' && isDraft);

  return (
    <>
      <div className="print:hidden">
        <DashboardLayout>
          <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
            
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/qms/documents')} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-mono font-bold text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">{doc.doc_code}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    doc.status === 'RELEASED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    doc.status === 'REVIEW' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    doc.status === 'DRAFT' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                    {doc.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white">{doc.doc_name}</h1>
              </div>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-4 text-sm text-gray-400">
                <p><strong>Section:</strong> {doc.section_code} - {doc.section_name}</p>
                <p><strong>Type:</strong> {doc.doc_type}</p>
                {activeVersion && <p><strong>Current Ver:</strong> v{activeVersion.version_number}</p>}
              </div>
              
              <div className="flex gap-3">
                {doc.status === 'PLANNED' && (
                  <button onClick={handleCreateDraft} disabled={saving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                    <FileEdit className="w-4 h-4"/> Author First Draft
                  </button>
                )}

                {doc.status === 'RELEASED' && (
                  <button onClick={handleCreateDraft} disabled={saving} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                    <FilePlus className="w-4 h-4"/> Create New Revision
                  </button>
                )}

                {activeVersion && (
                  <button onClick={() => window.print()} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                    <Printer className="w-4 h-4"/> Print Official Document
                  </button>
                )}

                {canApprove && (
                  <button onClick={handleOpenEditModal} disabled={saving} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                    <FileEdit className="w-4 h-4"/> Edit Details
                  </button>
                )}

                {isDraft && isAuthor && (
                  <>
                    <button onClick={handleSaveDraft} disabled={saving} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                      <Save className="w-4 h-4"/> Save Progress
                    </button>
                    <button onClick={handleSubmitReview} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20">
                      <Send className="w-4 h-4"/> Submit for QA Review
                    </button>
                  </>
                )}

                {isReview && canApprove && (
                  <button onClick={() => setShowApproval(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-500/20">
                    <FileSignature className="w-4 h-4"/> QA Manager Approval
                  </button>
                )}
              </div>
            </div>

            {activeVersion && doc.current_version_id !== activeVersion.version_id && activeVersion.status === 'SUPERSEDED' && (
              <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-red-400 font-bold">Viewing Archived Version</h3>
                  <p className="text-red-400/80 text-sm mt-1">You are viewing Version {activeVersion.version_number} which has been SUPERSEDED. This is not the active document and is for historical reference only.</p>
                  <button 
                    onClick={() => {
                      const latest = doc.versions.find((v:any) => v.version_id === doc.current_version_id) || doc.versions[0];
                      setActiveVersion(latest);
                      setContent(latest.content_data || {});
                    }}
                    className="mt-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded transition-colors"
                  >
                    Return to Active Version
                  </button>
                </div>
              </div>
            )}

            {success && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/>{success}</div>}
            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-dark-900 border-b border-dark-700 p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-dark-950 border border-dark-700 rounded-lg flex items-center justify-center font-black text-xl text-gray-500">VTL</div>
                      <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">VILAGIO TRADING LIMITED</h2>
                        <p className="text-sm font-bold text-primary-400 mt-1">{doc.doc_name}</p>
                        <p className="text-xs text-gray-500 mt-1">Department: Quality Assurance (QA)</p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-400 space-y-1">
                      <p><strong>Doc No:</strong> {doc.doc_code}</p>
                      <p><strong>Revision:</strong> {activeVersion ? activeVersion.version_number : '-'}</p>
                      <p><strong>Status:</strong> <span className={activeVersion?.status === 'SUPERSEDED' ? 'text-red-400' : isReleased ? 'text-green-400' : 'text-yellow-400'}>{activeVersion?.status || doc.status}</span></p>
                    </div>
                  </div>

                  <div className="p-6 space-y-8 bg-dark-950 min-h-[500px]">
                    {!activeVersion ? (
                      <div className="text-center py-20 text-gray-500 italic">No content drafted yet. Click "Author First Draft" to begin.</div>
                    ) : isUniversalTemplate ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-dark-700 pb-2">
                          <h3 className="text-white font-bold">Document Visual Editor</h3>
                          {isDraft && isAuthor && (
                            <p className="text-xs text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">Click directly on the document below to type</p>
                          )}
                        </div>
                        
                        <div 
                          className={`prose prose-invert max-w-none bg-white text-black p-8 rounded border min-h-[600px] overflow-x-auto ${isDraft && isAuthor ? 'border-primary-500/50 focus:outline-none focus:ring-4 focus:ring-primary-500/30' : 'border-gray-300'}`}
                          contentEditable={isDraft && isAuthor}
                          suppressContentEditableWarning={true}
                          dangerouslySetInnerHTML={{ __html: content.html_content || '<p>Start typing here...</p>' }}
                          onBlur={(e) => {
                            setContent({...content, html_content: e.currentTarget.innerHTML});
                          }}
                        />
                      </div>
                    ) : (
                      STANDARD_SECTIONS.map((sec) => (
                        <div key={sec.id} className="space-y-2">
                          <h3 className="text-white font-bold border-b border-dark-700 pb-2">{sec.title}</h3>
                          {isDraft && isAuthor ? (
                            <div>
                              <textarea
                                value={content[sec.id] || ''}
                                onChange={(e) => setContent({...content, [sec.id]: e.target.value})}
                                placeholder={sec.desc}
                                rows={sec.id === 'procedure' ? 8 : 3}
                                className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-gray-300 focus:outline-none focus:border-primary-500 transition-colors"
                              />
                            </div>
                          ) : (
                            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed py-2">
                              {content[sec.id] || <span className="text-gray-600 italic">Not specified</span>}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-400"/> Document Governance</h3>
                  <div className="space-y-4 text-sm">
                    <div><p className="text-gray-500 mb-1">Author</p><p className="text-white font-medium">{activeVersion?.author_name || '-'}</p></div>
                    <div><p className="text-gray-500 mb-1">Effective Date</p><p className="text-white font-medium">{activeVersion?.effective_date ? new Date(activeVersion.effective_date).toLocaleDateString() : 'Not released'}</p></div>
                    <div><p className="text-gray-500 mb-1">Next Review Due</p><p className="text-white font-medium">{activeVersion?.review_due_date ? new Date(activeVersion.review_due_date).toLocaleDateString() : 'Not set'}</p></div>
                  </div>
                </div>

                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><History className="w-5 h-5 text-primary-400"/> Version History</h3>
                  <div className="space-y-4">
                    {doc.versions?.map((v: any) => (
                      <div 
                        key={v.version_id} 
                        onClick={() => {
                          setActiveVersion(v);
                          setContent(v.content_data || {});
                        }}
                        className={`pl-4 border-l-2 cursor-pointer transition-all hover:bg-dark-700/30 p-2 rounded-r-lg ${activeVersion?.version_id === v.version_id ? 'border-primary-500 bg-dark-700/50' : 'border-dark-600'} relative`}
                      >
                        <div className={`absolute w-2 h-2 rounded-full -left-[5px] top-3.5 ${activeVersion?.version_id === v.version_id ? 'bg-primary-500' : 'bg-dark-600'}`}></div>
                        <p className="text-white font-bold text-sm">Version {v.version_number}</p>
                        <p className="text-xs text-gray-400 mb-1">{v.status} • {new Date(v.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">By {v.author_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </div>

      {activeVersion && (
        <div className="hidden print:block bg-white text-black font-sans w-full max-w-5xl mx-auto p-8">
          
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
                <p className="text-xs text-gray-800">Email: quality@vilag.io | Quality System ISO 22000 & HACCP Compliant</p>
              </div>
            </div>
            
            <div className="text-center bg-gray-100 py-2 border-y-2 border-black my-4">
              <h2 className="text-xl font-black uppercase tracking-widest">{getDocTypeString(doc.doc_type)}</h2>
            </div>

            <table className="w-full text-sm border border-black">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold w-1/4 border-r border-black uppercase bg-gray-50">Document Title</td>
                  <td className="p-2 font-bold text-base w-3/4">{doc.doc_name}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Document No.</td>
                  <td className="p-2 font-mono font-bold">{doc.doc_code}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Section & Dept</td>
                  <td className="p-2">{doc.section_code} - Quality Assurance</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Revision No.</td>
                  <td className="p-2 font-mono">{activeVersion.version_number}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-black uppercase bg-gray-50">Effective Date</td>
                  <td className="p-2">{isReleased && activeVersion.effective_date ? new Date(activeVersion.effective_date).toLocaleDateString() : 'UNRELEASED DRAFT'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-6 text-sm">
            {isUniversalTemplate ? (
              <div dangerouslySetInnerHTML={{ __html: content.html_content || '' }} />
            ) : (
              STANDARD_SECTIONS.map((sec) => {
                const hasContent = !!content[sec.id];
                if (!hasContent && !isDraft) return null;

                return (
                  <div key={sec.id} className="break-inside-avoid">
                    <h3 className="font-bold text-base border-b border-black mb-2 pb-1 uppercase">
                      {sec.title}
                    </h3>
                    <div className="whitespace-pre-wrap leading-relaxed text-justify px-2">
                      {content[sec.id] || <span className="text-gray-500 italic">Not specified</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-16 pt-6 border-t-2 border-black text-sm">
            <div className="grid grid-cols-2 gap-12 mb-6">
              <div>
                <p className="font-bold mb-4 uppercase text-gray-600">Authored By</p>
                <p className="font-bold text-lg border-b border-gray-400 pb-1">{activeVersion.author_name || 'System User'}</p>
                <p className="text-gray-600 mt-2">Date: {new Date(activeVersion.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-bold mb-4 uppercase text-gray-600">Approved By (QA Manager)</p>
                <p className={`font-bold text-lg border-b border-gray-400 pb-1 ${isReleased ? 'italic text-blue-800' : 'text-gray-400'}`}>
                  {isReleased ? 'Electronically Signed & Approved' : 'Pending Approval'}
                </p>
                <p className="text-gray-600 mt-2">
                  Date: {isReleased && activeVersion.effective_date ? new Date(activeVersion.effective_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="text-center font-bold text-xs uppercase tracking-widest border-t border-gray-300 pt-4 mt-8 text-gray-500">
              VILAGIO QMS STANDARD • Printed copies are uncontrolled • Verify against ERP before use
            </div>
          </div>

        </div>
      )}

      {showApproval && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileSignature className="w-5 h-5 text-green-400"/> QA Official Release</h2>
              <button onClick={() => setShowApproval(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApproveRelease} className="p-6">
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400 font-medium mb-1">Warning: Irreversible Action</p>
                <p className="text-xs text-yellow-400/80">Releasing this document will immediately make it the governing standard across the VILAGIO ERP. The previous version will be superseded.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary-400"/> Digital Signature Password
                  </label>
                  <input 
                    type="password" 
                    value={signature} 
                    onChange={(e) => setSignature(e.target.value)}
                    required
                    placeholder="Enter your login password"
                    className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono tracking-widest focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">By entering your password, you electronically sign and approve this document in compliance with 21 CFR Part 11.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t border-dark-700">
                <button type="button" onClick={() => setShowApproval(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !signature} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Verifying...' : 'Sign & Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-primary-500" />
                Edit Document Details
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              
              <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                <label className="block text-sm font-bold text-gray-300 mb-2">Document Code</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    value={editData.doc_code} 
                    onChange={(e) => setEditData({...editData, doc_code: e.target.value.toUpperCase()})} 
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono uppercase focus:border-primary-500" 
                  />
                  {isGeneratingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Document Type</label>
                  <select 
                    required
                    value={editData.doc_type} 
                    onChange={(e) => setEditData({...editData, doc_type: e.target.value})}
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
                  <label className="block text-sm font-bold text-gray-300 mb-2">Document Title</label>
                  <input 
                    type="text" 
                    required
                    value={editData.doc_name} 
                    onChange={(e) => setEditData({...editData, doc_name: e.target.value})}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Department / Section</label>
                  <select 
                    required
                    value={editData.section_id} 
                    onChange={(e) => setEditData({...editData, section_id: e.target.value})}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  >
                    <option value="">Select Section...</option>
                    {sections.map(s => (
                      <option key={s.section_id} value={s.section_id}>{s.section_code} - {s.section_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">ERP Module Link (Optional)</label>
                  <select 
                    value={editData.erp_link_module} 
                    onChange={(e) => setEditData({...editData, erp_link_module: e.target.value})}
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
                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium transition-colors bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || isGeneratingCode} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50">
                  {saving ? 'Saving...' : <><Save className="w-5 h-5"/> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}