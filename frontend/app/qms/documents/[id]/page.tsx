'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, Save, Send, CheckCircle2, AlertCircle,
  FileSignature, History, ShieldCheck, Key, X, Printer,
  FilePlus, RefreshCw, FileEdit, Upload, Download,
  FileText, Clock, User, Link, Trash2, ChevronDown
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Section { id: string; title: string; desc: string; }
interface Version {
  version_id: string; version_number: string; status: string;
  authored_by: string; author_name: string; reviewer_name?: string;
  approver_name?: string; created_at: string;
  content_data: Record<string, string>;
  content_strategy: 'structured' | 'upload' | 'richtext';
  file_original_name?: string;
  change_reason?: string;
  effective_date?: string; review_due_date?: string;
}
interface LinkedDoc {
  link_id: string; relationship: string;
  doc_id: string; doc_code: string; doc_name: string; doc_type: string; status: string;
}
interface AuditEntry {
  trail_id: string; action: string; actor_name: string; actor_role: string;
  from_status?: string; to_status?: string; notes?: string; created_at: string;
}
interface UserOption { user_id: string; full_name: string; role: string; }

// ── SOP section schema (fallback if API not yet called) ──────────────────

const FALLBACK_SOP_SECTIONS: Section[] = [
  { id: 'purpose',         title: '1. Purpose',                        desc: 'What this SOP governs and why it exists.' },
  { id: 'scope',           title: '2. Scope',                          desc: 'Who and what this applies to.' },
  { id: 'definitions',     title: '3. Definitions',                    desc: 'Key specialist terms.' },
  { id: 'responsibilities',title: '4. Responsibilities',               desc: 'Role | Responsibility mapping.' },
  { id: 'materials',       title: '5. Required Materials / Equipment', desc: 'Tools, chemicals, PPE, equipment.' },
  { id: 'procedure',       title: '6. Procedure / Instructions',       desc: 'Numbered steps.' },
  { id: 'criteria',        title: '7. Acceptance Criteria / Limits',   desc: 'Pass/fail criteria.' },
  { id: 'records',         title: '8. Records Required',               desc: 'Forms/logs to complete.' },
  { id: 'related',         title: '9. Related Documents',              desc: 'Linked document codes.' },
];

// ── Status colour helper ──────────────────────────────────────────────────

const statusColour = (s: string) => {
  switch (s) {
    case 'RELEASED':   return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'REVIEW':     return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'DRAFT':      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'SUPERSEDED': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'WITHDRAWN':  return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    default:           return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const actionColour = (action: string) => {
  if (action === 'RELEASED')  return 'text-green-400';
  if (action === 'SUBMITTED') return 'text-blue-400';
  if (action === 'WITHDRAWN') return 'text-red-400';
  if (action === 'DRAFT_CREATED') return 'text-yellow-400';
  return 'text-gray-400';
};

// ============================================================================
export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [doc, setDoc]                     = useState<any>(null);
  const [activeVersion, setActiveVersion] = useState<Version | null>(null);
  const [sections, setSections]           = useState<Section[]>(FALLBACK_SOP_SECTIONS);
  const [allSections, setAllSections]     = useState<any[]>([]);
  const [users, setUsers]                 = useState<UserOption[]>([]);
  const [auditTrail, setAuditTrail]       = useState<AuditEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const [activeTab, setActiveTab]         = useState<'content'|'links'|'trail'>('content');

  // Structured editor content
  const [content, setContent] = useState<Record<string, string>>({});

  // Upload mode
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Approval modal
  const [showApproval, setShowApproval] = useState(false);
  const [signature, setSignature]       = useState('');

  // Create draft modal (revision) — collects change_reason
  const [showDraftModal, setShowDraftModal]   = useState(false);
  const [changeReason, setChangeReason]       = useState('');

  // Submit for review modal — assigns reviewer
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reviewerId, setReviewerId]           = useState('');

  // Edit metadata modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [isGenCode, setIsGenCode]         = useState(false);
  const [editData, setEditData]           = useState({
    doc_code: '', doc_name: '', doc_type: '', section_id: '', erp_link_module: '', doc_owner: ''
  });

  // Withdraw modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason]       = useState('');
  const [withdrawSig, setWithdrawSig]             = useState('');

  // Add link modal
  const [showLinkModal, setShowLinkModal]   = useState(false);
  const [linkDocId, setLinkDocId]           = useState('');
  const [linkRelationship, setLinkRelationship] = useState('references');
  const [allDocs, setAllDocs]               = useState<any[]>([]);

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => { if (params.id) fetchAll(); }, [params.id]);

  async function fetchAll() {
    try {
      setLoading(true);
      const [docRes, sectionsRes, usersRes, trailRes] = await Promise.all([
        api.get(`/qms/documents/${params.id}`),
        api.get('/qms/sections'),
        api.get('/qms/users'),
        api.get(`/qms/documents/${params.id}/audit-trail`),
      ]);
      const d = docRes.data;
      setDoc(d);
      setAllSections(sectionsRes.data);
      setUsers(usersRes.data);
      setAuditTrail(trailRes.data);

      if (d.versions?.length > 0) {
        const latest = d.versions[0];
        setActiveVersion(latest);
        setContent(latest.content_data || {});
        setUploadedFileName(latest.file_original_name || '');
        // Fetch section schema from API for this doc type
        await fetchSchema(d.doc_type);
      }
    } catch {
      setError('Failed to load document details.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchema(docType: string) {
    try {
      const res = await api.get(`/qms/schema/${docType}`);
      if (res.data.sections?.length > 0) setSections(res.data.sections);
    } catch {
      // fallback already set
    }
  }

  // ── Draft creation ────────────────────────────────────────────────────────

  async function handleCreateDraft() {
    // For revision of released doc, show modal to collect change_reason
    if (doc.status === 'RELEASED') { setShowDraftModal(true); return; }
    await doCreateDraft('');
  }

  async function doCreateDraft(reason: string) {
    try {
      setSaving(true);
      const res = await api.post(`/qms/documents/${doc.doc_id}/draft`, { change_reason: reason });
      setShowDraftModal(false);
      setChangeReason('');
      await fetchAll();
      setSuccess(`Draft v${res.data.version_number} created (${res.data.content_strategy} mode).`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create draft');
    } finally { setSaving(false); }
  }

  // ── Save draft (structured / richtext) ───────────────────────────────────

  async function handleSaveDraft() {
    if (!activeVersion) return;
    try {
      setSaving(true);
      await api.put(`/qms/versions/${activeVersion.version_id}`, { content_data: content });
      setSuccess('Draft saved.');
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  // ── File upload ───────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeVersion) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('document_file', file);
      await api.post(`/qms/versions/${activeVersion.version_id}/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedFileName(file.name);
      setSuccess(`"${file.name}" uploaded successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  }

  async function handleDownloadFile() {
    if (!activeVersion) return;
    const token = localStorage.getItem('token') || '';
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/qms/versions/${activeVersion.version_id}/file`, '_blank');
  }

  // ── Submit for review ─────────────────────────────────────────────────────

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!activeVersion) return;
    try {
      setSaving(true);
      // Save content first if structured/richtext
      if (activeVersion.content_strategy !== 'upload') {
        await api.put(`/qms/versions/${activeVersion.version_id}`, { content_data: content });
      }
      await api.post(`/qms/versions/${activeVersion.version_id}/submit`, { reviewer_id: reviewerId || undefined });
      setShowSubmitModal(false);
      await fetchAll();
      setSuccess('Submitted for QA Review. Notification sent.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
    } finally { setSaving(false); }
  }

  // ── Approve & release ─────────────────────────────────────────────────────

  async function handleApproveRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!activeVersion || !signature) return;
    try {
      setSaving(true);
      await api.post(`/qms/versions/${activeVersion.version_id}/approve`, { signature_password: signature });
      setShowApproval(false);
      await fetchAll();
      setSuccess('Document officially released!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to release. Invalid signature?');
    } finally { setSaving(false); setSignature(''); }
  }

  // ── Withdraw ──────────────────────────────────────────────────────────────

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post(`/qms/documents/${doc.doc_id}/withdraw`, {
        signature_password: withdrawSig, withdraw_reason: withdrawReason
      });
      setShowWithdrawModal(false);
      await fetchAll();
      setSuccess('Document formally withdrawn.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Withdrawal failed');
    } finally { setSaving(false); }
  }

  // ── Edit metadata ─────────────────────────────────────────────────────────

  function openEditModal() {
    setEditData({
      doc_code: doc.doc_code, doc_name: doc.doc_name, doc_type: doc.doc_type,
      section_id: doc.section_id, erp_link_module: doc.erp_link_module || '',
      doc_owner: doc.doc_owner || ''
    });
    setShowEditModal(true);
  }

  useEffect(() => {
    if (!showEditModal || !editData.section_id || !editData.doc_type || !doc) return;
    if (editData.section_id === doc.section_id && editData.doc_type === doc.doc_type) return;
    const timer = setTimeout(async () => {
      setIsGenCode(true);
      try {
        const res = await api.get(`/qms/documents/next-code?section_id=${editData.section_id}&doc_type=${editData.doc_type}`);
        if (res.data?.next_code) setEditData(p => ({ ...p, doc_code: res.data.next_code }));
      } finally { setIsGenCode(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [editData.section_id, editData.doc_type, showEditModal]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put(`/qms/documents/${doc.doc_id}`, editData);
      setShowEditModal(false);
      await fetchAll();
      setSuccess('Document details updated.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  }

  // ── Add link ──────────────────────────────────────────────────────────────

  async function openLinkModal() {
    if (!allDocs.length) {
      const res = await api.get('/qms/documents');
      setAllDocs(res.data.filter((d: any) => d.doc_id !== doc.doc_id));
    }
    setShowLinkModal(true);
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/qms/document-links', {
        parent_doc_id: doc.doc_id, child_doc_id: linkDocId, relationship: linkRelationship
      });
      setShowLinkModal(false);
      await fetchAll();
      setSuccess('Document link added.');
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Link failed');
    }
  }

  async function handleRemoveLink(linkId: string) {
    if (!confirm('Remove this document link?')) return;
    await api.delete(`/qms/document-links/${linkId}`);
    await fetchAll();
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isDraft    = activeVersion?.status === 'DRAFT';
  const isReview   = activeVersion?.status === 'REVIEW';
  const isReleased = activeVersion?.status === 'RELEASED';
  const isAuthor   = activeVersion?.authored_by === user?.user_id;
  const canApprove = ['admin', 'qa', 'manager', 'ceo', 'cfo'].includes(user?.role || '');
  const strategy   = activeVersion?.content_strategy || 'structured';

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );
  if (!doc) return <DashboardLayout><div className="p-10 text-center text-red-400">Document not found</div></DashboardLayout>;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="print:hidden">
        <DashboardLayout>
          <div className="max-w-[1600px] mx-auto space-y-6 pb-12">

            {/* Breadcrumb header */}
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/qms/documents')} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-400"/>
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-mono font-bold text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">{doc.doc_code}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusColour(doc.status)}`}>{doc.status}</span>
                  {doc.status === 'WITHDRAWN' && (
                    <span className="text-xs text-red-400 italic">Formally withdrawn — not in active use</span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-white">{doc.doc_name}</h1>
              </div>
            </div>

            {/* Action bar */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-4 text-sm text-gray-400">
                <p><strong>Section:</strong> {doc.section_code} — {doc.section_name}</p>
                <p><strong>Type:</strong> {doc.doc_type}</p>
                {doc.owner_name && <p><strong>Owner:</strong> {doc.owner_name}</p>}
                {activeVersion && <p><strong>Version:</strong> v{activeVersion.version_number}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {doc.status === 'PLANNED' && (
                  <button onClick={handleCreateDraft} disabled={saving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                    <FileEdit className="w-4 h-4"/> Author First Draft
                  </button>
                )}
                {doc.status === 'RELEASED' && (
                  <button onClick={handleCreateDraft} disabled={saving} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                    <FilePlus className="w-4 h-4"/> Create Revision
                  </button>
                )}
                {activeVersion && (
                  <button onClick={() => window.print()} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                    <Printer className="w-4 h-4"/> Print
                  </button>
                )}
                {canApprove && doc.status !== 'WITHDRAWN' && (
                  <button onClick={openEditModal} disabled={saving} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                    <FileEdit className="w-4 h-4"/> Edit Details
                  </button>
                )}
                {isDraft && isAuthor && (
                  <>
                    {strategy !== 'upload' && (
                      <button onClick={handleSaveDraft} disabled={saving} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                        <Save className="w-4 h-4"/> Save Draft
                      </button>
                    )}
                    <button onClick={() => setShowSubmitModal(true)} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 text-sm transition-colors shadow-lg shadow-blue-500/20">
                      <Send className="w-4 h-4"/> Submit for Review
                    </button>
                  </>
                )}
                {isReview && canApprove && (
                  <button onClick={() => setShowApproval(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-green-500/20">
                    <FileSignature className="w-4 h-4"/> Release Document
                  </button>
                )}
                {(doc.status === 'RELEASED' || doc.status === 'PLANNED' || doc.status === 'DRAFT' || doc.status === 'REVIEW') && canApprove && (
                  <button onClick={() => setShowWithdrawModal(true)} className="px-4 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/30 text-red-400 rounded-lg font-medium flex items-center gap-2 text-sm transition-colors">
                    <Trash2 className="w-4 h-4"/> Withdraw
                  </button>
                )}
              </div>
            </div>

            {/* Alerts */}
            {success && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 flex-shrink-0"/>{success}</div>}
            {error   && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4"/></button></div>}

            {/* Superseded warning */}
            {activeVersion && doc.current_version_id !== activeVersion.version_id && activeVersion.status === 'SUPERSEDED' && (
              <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <h3 className="text-red-400 font-bold text-sm">Viewing Archived Version {activeVersion.version_number}</h3>
                  <p className="text-red-400/80 text-xs mt-1">This version has been superseded and is for historical reference only.</p>
                  <button onClick={() => {
                    const latest = doc.versions.find((v: any) => v.version_id === doc.current_version_id) || doc.versions[0];
                    setActiveVersion(latest); setContent(latest.content_data || {});
                  }} className="mt-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded">
                    Return to Active Version
                  </button>
                </div>
              </div>
            )}

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: Content area */}
              <div className="lg:col-span-2 space-y-4">

                {/* Tab bar */}
                <div className="flex gap-1 bg-dark-900 border border-dark-700 rounded-xl p-1 w-fit">
                  {(['content', 'links', 'trail'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-dark-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                      {tab === 'trail' ? 'Audit Trail' : tab === 'links' ? 'Related Docs' : 'Content'}
                    </button>
                  ))}
                </div>

                {/* CONTENT TAB */}
                {activeTab === 'content' && (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
                    {/* Document header */}
                    <div className="bg-dark-900 border-b border-dark-700 p-6 flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 bg-dark-950 border border-dark-700 rounded-lg flex items-center justify-center font-black text-lg text-gray-500">VTL</div>
                        <div>
                          <h2 className="text-base font-black text-white uppercase tracking-widest">VILAGIO TRADING LIMITED</h2>
                          <p className="text-sm font-bold text-primary-400 mt-0.5">{doc.doc_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Strategy: <span className={`font-medium ${strategy === 'upload' ? 'text-amber-400' : strategy === 'richtext' ? 'text-purple-400' : 'text-blue-400'}`}>{strategy}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-400 space-y-1">
                        <p><strong>Doc No:</strong> {doc.doc_code}</p>
                        <p><strong>Rev:</strong> {activeVersion?.version_number || '-'}</p>
                        <p><strong>Status:</strong> <span className={isReleased ? 'text-green-400' : 'text-yellow-400'}>{activeVersion?.status || doc.status}</span></p>
                      </div>
                    </div>

                    {/* Editor area */}
                    <div className="p-6 min-h-[400px] bg-dark-950">
                      {!activeVersion ? (
                        <div className="text-center py-20 text-gray-500 italic">No content drafted yet.</div>
                      ) : strategy === 'upload' ? (
                        /* ── UPLOAD MODE ── */
                        <div className="space-y-6">
                          <div className="border-2 border-dashed border-dark-600 rounded-xl p-10 text-center">
                            {uploadedFileName ? (
                              <div className="space-y-4">
                                <div className="flex items-center justify-center gap-3 text-green-400">
                                  <CheckCircle2 className="w-8 h-8"/>
                                  <div className="text-left">
                                    <p className="font-bold">{uploadedFileName}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Current controlled template</p>
                                  </div>
                                </div>
                                <div className="flex justify-center gap-3">
                                  <button onClick={handleDownloadFile} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                                    <Download className="w-4 h-4"/> Download Template
                                  </button>
                                  {isDraft && isAuthor && (
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                                      <Upload className="w-4 h-4"/> {uploading ? 'Uploading...' : 'Replace File'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <Upload className="w-12 h-12 text-gray-600 mx-auto"/>
                                <div>
                                  <p className="text-white font-medium">Upload controlled template</p>
                                  <p className="text-gray-500 text-sm mt-1">Word (.docx), Excel (.xlsx), or PDF. Max 20 MB.</p>
                                </div>
                                {isDraft && isAuthor && (
                                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors">
                                    <Upload className="w-4 h-4"/> {uploading ? 'Uploading...' : 'Choose File'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <input ref={fileInputRef} type="file" accept=".docx,.xlsx,.doc,.xls,.pdf" className="hidden" onChange={handleFileUpload}/>
                          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 text-sm text-gray-400">
                            <p className="font-medium text-gray-300 mb-2">About upload mode</p>
                            <p>Forms, checklists, logs, and registers are managed as file uploads. Upload the master blank template here. Users download it, complete it physically or digitally, and retain the completed record. The version control and approval workflow applies to the template itself.</p>
                          </div>
                        </div>
                      ) : strategy === 'richtext' ? (
                        /* ── RICH TEXT MODE ── */
                        <div className="space-y-4">
                          {isDraft && isAuthor && (
                            <p className="text-xs text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20 w-fit">
                              Click directly on the document below to type
                            </p>
                          )}
                          <div
                            className={`prose prose-invert max-w-none bg-white text-black p-8 rounded border min-h-[500px] overflow-x-auto ${isDraft && isAuthor ? 'border-primary-500/50' : 'border-gray-300'}`}
                            contentEditable={isDraft && isAuthor}
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{ __html: content.html_content || '<p>Start typing...</p>' }}
                            onBlur={e => setContent({ ...content, html_content: e.currentTarget.innerHTML })}
                          />
                        </div>
                      ) : (
                        /* ── STRUCTURED MODE ── */
                        <div className="space-y-8">
                          {sections.map(sec => (
                            <div key={sec.id} className="space-y-2">
                              <h3 className="text-white font-bold border-b border-dark-700 pb-2 text-sm uppercase tracking-wider">{sec.title}</h3>
                              {isDraft && isAuthor ? (
                                <textarea
                                  value={content[sec.id] || ''}
                                  onChange={e => setContent({ ...content, [sec.id]: e.target.value })}
                                  placeholder={sec.desc}
                                  rows={sec.id === 'procedure' ? 8 : 3}
                                  className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-gray-300 focus:outline-none focus:border-primary-500 transition-colors resize-y text-sm"
                                />
                              ) : (
                                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed py-2 text-sm">
                                  {content[sec.id] || <span className="text-gray-600 italic">Not specified</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* LINKS TAB */}
                {activeTab === 'links' && (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-bold flex items-center gap-2"><Link className="w-5 h-5 text-primary-400"/> Related Documents</h3>
                      <button onClick={openLinkModal} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm flex items-center gap-1.5 transition-colors">
                        <Link className="w-3.5 h-3.5"/> Add Link
                      </button>
                    </div>
                    {doc.linked_documents?.length === 0 ? (
                      <p className="text-gray-500 text-sm italic">No document links defined yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {doc.linked_documents?.map((l: LinkedDoc) => (
                          <div key={l.link_id} className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs px-2 py-0.5 bg-dark-700 text-gray-400 rounded font-mono">{l.relationship.replace('_', ' ')}</span>
                              <div>
                                <p className="text-white text-sm font-medium">{l.doc_code} — {l.doc_name}</p>
                                <p className="text-gray-500 text-xs">{l.doc_type} · {l.status}</p>
                              </div>
                            </div>
                            {canApprove && l.relationship !== 'referenced_by' && (
                              <button onClick={() => handleRemoveLink(l.link_id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AUDIT TRAIL TAB */}
                {activeTab === 'trail' && (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-400"/> 21 CFR Part 11 Audit Trail</h3>
                    <div className="space-y-1">
                      {auditTrail.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">No audit entries yet.</p>
                      ) : (
                        auditTrail.map((entry, i) => (
                          <div key={entry.trail_id} className="flex gap-4 py-3 border-b border-dark-700 last:border-0">
                            <div className="flex flex-col items-center gap-1 pt-0.5">
                              <div className={`w-2 h-2 rounded-full mt-1 ${actionColour(entry.action).replace('text-', 'bg-')}`}/>
                              {i < auditTrail.length - 1 && <div className="w-px flex-1 bg-dark-700"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className={`text-xs font-bold uppercase tracking-wider ${actionColour(entry.action)}`}>{entry.action.replace(/_/g, ' ')}</span>
                                  {entry.from_status && entry.to_status && (
                                    <span className="text-xs text-gray-500 ml-2">{entry.from_status} → {entry.to_status}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 flex-shrink-0">{new Date(entry.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-300 mt-0.5">{entry.actor_name || 'System'} <span className="text-gray-500">({entry.actor_role})</span></p>
                              {entry.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{entry.notes}</p>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Metadata panels */}
              <div className="space-y-6">
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-400"/> Governance</h3>
                  <div className="space-y-3 text-sm">
                    <div><p className="text-gray-500 mb-0.5">Author</p><p className="text-white font-medium">{activeVersion?.author_name || '-'}</p></div>
                    {activeVersion?.reviewer_name && <div><p className="text-gray-500 mb-0.5">Reviewer</p><p className="text-white font-medium">{activeVersion.reviewer_name}</p></div>}
                    {activeVersion?.change_reason && <div><p className="text-gray-500 mb-0.5">Change reason</p><p className="text-white">{activeVersion.change_reason}</p></div>}
                    <div><p className="text-gray-500 mb-0.5">Effective date</p><p className="text-white font-medium">{activeVersion?.effective_date ? new Date(activeVersion.effective_date).toLocaleDateString() : 'Not released'}</p></div>
                    <div><p className="text-gray-500 mb-0.5">Review due</p><p className={`font-medium ${activeVersion?.review_due_date && new Date(activeVersion.review_due_date) < new Date() ? 'text-red-400' : 'text-white'}`}>
                      {activeVersion?.review_due_date ? new Date(activeVersion.review_due_date).toLocaleDateString() : 'Not set'}
                    </p></div>
                  </div>
                </div>

                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><History className="w-5 h-5 text-primary-400"/> Version History</h3>
                  <div className="space-y-3">
                    {doc.versions?.map((v: Version) => (
                      <div key={v.version_id} onClick={() => { setActiveVersion(v); setContent(v.content_data || {}); setUploadedFileName(v.file_original_name || ''); }}
                        className={`pl-4 border-l-2 cursor-pointer transition-all hover:bg-dark-700/30 p-2 rounded-r-lg ${activeVersion?.version_id === v.version_id ? 'border-primary-500 bg-dark-700/50' : 'border-dark-600'}`}>
                        <p className="text-white font-bold text-sm">Version {v.version_number}</p>
                        <p className="text-xs text-gray-400">{v.status} · {new Date(v.created_at).toLocaleDateString()}</p>
                        {v.change_reason && <p className="text-xs text-gray-500 italic mt-0.5 truncate" title={v.change_reason}>{v.change_reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Create revision modal (change_reason) */}
      {showDraftModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FilePlus className="w-5 h-5 text-yellow-400"/> Create New Revision</h2>
              <button onClick={() => setShowDraftModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
                A revision of a released document requires a documented change reason. This is recorded in the audit trail.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Change Reason <span className="text-red-400">*</span></label>
                <textarea
                  value={changeReason} onChange={e => setChangeReason(e.target.value)}
                  placeholder="Describe what changed and why (e.g. Updated section 6 to reflect new equipment SOPs following NCR-2604-001)"
                  rows={4}
                  className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDraftModal(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg text-sm">Cancel</button>
                <button onClick={() => doCreateDraft(changeReason)} disabled={!changeReason.trim() || saving}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit for review modal (reviewer assignment) */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Send className="w-5 h-5 text-blue-400"/> Submit for QA Review</h2>
              <button onClick={() => setShowSubmitModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmitReview} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2"><User className="w-4 h-4"/> Assign Reviewer (optional)</label>
                <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
                  <option value="">Broadcast to all QA / Admin roles</option>
                  {users.filter(u => ['qa', 'admin', 'manager', 'ceo'].includes(u.role)).map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Assigning a named reviewer sends the notification directly to them. Leave blank to notify all QA personnel.</p>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs">
                Once submitted, you will no longer be able to edit this draft.
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSubmitModal(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {saving ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release approval modal */}
      {showApproval && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/50 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileSignature className="w-5 h-5 text-green-400"/> QA Official Release</h2>
              <button onClick={() => setShowApproval(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={handleApproveRelease} className="p-6 space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                <strong>Irreversible action.</strong> Releasing makes this the governing standard. The previous version will be superseded.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-primary-400"/> Digital Signature Password</label>
                <input type="password" value={signature} onChange={e => setSignature(e.target.value)} required placeholder="Enter your login password"
                  className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono tracking-widest focus:border-primary-500 outline-none"/>
                <p className="text-xs text-gray-500 mt-2">Your password constitutes an electronic signature per 21 CFR Part 11.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowApproval(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !signature} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50">
                  {saving ? 'Verifying...' : 'Sign & Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400"/> Formally Withdraw Document</h2>
              <button onClick={() => setShowWithdrawModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={handleWithdraw} className="p-6 space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                Withdrawal permanently retires this document from the active QMS. It will remain visible in the audit trail but cannot be used or referenced. This is <strong>not</strong> the same as creating a new revision.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Withdrawal Reason <span className="text-red-400">*</span></label>
                <textarea value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} required rows={3}
                  placeholder="e.g. Process no longer in use following restructure. Superseded by QA-OPS-SOP-012."
                  className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-red-500 outline-none resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2"><Key className="w-4 h-4"/> Digital Signature</label>
                <input type="password" value={withdrawSig} onChange={e => setWithdrawSig(e.target.value)} required placeholder="Your login password"
                  className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono tracking-widest focus:border-red-500 outline-none"/>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving || !withdrawReason.trim() || !withdrawSig}
                  className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {saving ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit metadata modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileEdit className="w-5 h-5 text-primary-500"/> Edit Document Details</h2>
              <button onClick={() => setShowEditModal(false)}><X className="w-6 h-6 text-gray-400"/></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                <label className="block text-sm font-bold text-gray-300 mb-2">Document Code</label>
                <div className="relative">
                  <input type="text" required value={editData.doc_code}
                    onChange={e => setEditData({ ...editData, doc_code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono uppercase focus:border-primary-500 outline-none"/>
                  {isGenCode && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400"><RefreshCw className="w-4 h-4 animate-spin"/></div>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Document Type</label>
                  <select value={editData.doc_type} onChange={e => setEditData({ ...editData, doc_type: e.target.value })} required
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none">
                    <option value="SOP">SOP</option><option value="POL">POL</option><option value="MAN">MAN</option>
                    <option value="FRM">FRM</option><option value="LOG">LOG</option><option value="CHK">CHK</option><option value="REG">REG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Document Title</label>
                  <input type="text" required value={editData.doc_name} onChange={e => setEditData({ ...editData, doc_name: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Section</label>
                  <select value={editData.section_id} onChange={e => setEditData({ ...editData, section_id: e.target.value })} required
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none">
                    <option value="">Select...</option>
                    {allSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_code} — {s.section_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Document Owner</label>
                  <select value={editData.doc_owner} onChange={e => setEditData({ ...editData, doc_owner: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none">
                    <option value="">Unassigned</option>
                    {users.filter(u => ['qa', 'admin', 'manager'].includes(u.role)).map(u =>
                      <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">ERP Module Link</label>
                <select value={editData.erp_link_module} onChange={e => setEditData({ ...editData, erp_link_module: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 outline-none">
                  <option value="">None</option><option value="Production">Production</option>
                  <option value="Inventory">Inventory</option><option value="HR">Human Resources</option>
                  <option value="IT">Information Technology</option><option value="QC Lab">QC Lab</option>
                </select>
              </div>
              <div className="pt-4 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-2.5 text-gray-400 hover:text-white bg-dark-900 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving || isGenCode} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4"/> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add link modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white">Add Document Link</h2>
              <button onClick={() => setShowLinkModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <form onSubmit={handleAddLink} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Relationship</label>
                <select value={linkRelationship} onChange={e => setLinkRelationship(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
                  <option value="references">This document references →</option>
                  <option value="implements">This document implements →</option>
                  <option value="spawned_from">This document was spawned from →</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Document</label>
                <select value={linkDocId} onChange={e => setLinkDocId(e.target.value)} required
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
                  <option value="">Select document...</option>
                  {allDocs.map((d: any) => <option key={d.doc_id} value={d.doc_id}>{d.doc_code} — {d.doc_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={!linkDocId} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm disabled:opacity-50">Add Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}