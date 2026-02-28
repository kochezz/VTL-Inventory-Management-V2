'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Search, Filter, Eye, FileText, 
  CheckCircle2, Clock, AlertCircle, FileEdit,
  FolderTree, BookOpen, Link
} from 'lucide-react';

interface QMSDocument {
  doc_id: string;
  doc_code: string;
  doc_name: string;
  doc_type: string;
  status: string;
  erp_link_module: string;
  section_code: string;
  section_name: string;
  color_code: string;
  version_number: string;
  effective_date: string;
  author_name: string;
}

// ----------------------------------------------------------------------------
// INNER COMPONENT: Handles the actual data fetching and search params
// ----------------------------------------------------------------------------
function MasterDocumentRegisterContent() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  // NEW: Capture the ?search=... parameter from the URL
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  
  const [documents, setDocuments] = useState<QMSDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters (searchQuery now defaults to the URL parameter)
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated) fetchDocuments();
  }, [isAuthenticated]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/qms/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique sections for the filter dropdown
  const uniqueSections = Array.from(new Set(documents.map(d => d.section_code))).sort();

  // Apply client-side filtering
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.doc_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.doc_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesType = typeFilter === 'all' || doc.doc_type === typeFilter;
    const matchesSection = sectionFilter === 'all' || doc.section_code === sectionFilter;

    return matchesSearch && matchesStatus && matchesType && matchesSection;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RELEASED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3"/> Released</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3"/> Approved</span>;
      case 'REVIEW':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><Eye className="w-3 h-3"/> In Review</span>;
      case 'DRAFT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1 w-max"><FileEdit className="w-3 h-3"/> Draft</span>;
      case 'PLANNED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Planned</span>;
      case 'SUPERSEDED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max"><AlertCircle className="w-3 h-3"/> Superseded</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20 w-max">{status}</span>;
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'POL': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'MAN': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'SOP': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'FRM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'LOG': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'CHK': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'REG': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FolderTree className="w-8 h-8 text-primary-500" />
              Master Document Register
            </h1>
            <p className="text-gray-400 mt-1">Definitive index of all controlled QMS documentation</p>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
          
          {/* Filters & Search Bar */}
          <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 bg-dark-900/50">
            
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by Code or Title..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 transition-colors"
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-40 pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
                >
                  <option value="all">All Sections</option>
                  {uniqueSections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>

              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-40 pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
                >
                  <option value="all">All Types</option>
                  <option value="POL">Policies (POL)</option>
                  <option value="MAN">Manuals (MAN)</option>
                  <option value="SOP">Procedures (SOP)</option>
                  <option value="FRM">Forms (FRM)</option>
                  <option value="LOG">Records (LOG)</option>
                  <option value="CHK">Checklists (CHK)</option>
                  <option value="REG">Registers (REG)</option>
                </select>
              </div>

              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40 px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white"
              >
                <option value="all">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="DRAFT">Draft</option>
                <option value="REVIEW">In Review</option>
                <option value="RELEASED">Released</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4 font-medium">Doc Code</th>
                  <th className="px-6 py-4 font-medium">Document Title</th>
                  <th className="px-6 py-4 font-medium">Section</th>
                  <th className="px-6 py-4 font-medium">Ver.</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
                      Loading register...
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No documents found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.doc_id} className="hover:bg-dark-700/30 transition-colors group">
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-gray-200 group-hover:text-primary-400 transition-colors">{doc.doc_code}</span>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getTypeStyle(doc.doc_type)}`}>
                            {doc.doc_type}
                          </span>
                          <div>
                            <p className="text-white font-medium">{doc.doc_name}</p>
                            {doc.erp_link_module && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Link className="w-3 h-3" /> Links to: {doc.erp_link_module}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: doc.color_code || '#3b82f6' }}></div>
                          {doc.section_code} - {doc.section_name}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {doc.version_number ? (
                          <span className="text-sm font-mono text-gray-300 bg-dark-900 px-2 py-1 rounded border border-dark-600">v{doc.version_number}</span>
                        ) : (
                          <span className="text-xs text-gray-600">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => router.push(`/qms/documents/${doc.doc_id}`)}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-dark-700 hover:bg-primary-600 rounded-lg transition-colors inline-flex items-center gap-2 border border-dark-600 hover:border-primary-500"
                        >
                          {doc.status === 'PLANNED' ? (
                            <><FileEdit className="w-4 h-4"/> Author Draft</>
                          ) : (
                            <><FileText className="w-4 h-4"/> View Document</>
                          )}
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
    </DashboardLayout>
  );
}

// ----------------------------------------------------------------------------
// EXPORT: Wraps the inner component in Suspense to prevent Next.js build errors
// ----------------------------------------------------------------------------
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