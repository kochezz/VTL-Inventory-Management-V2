'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FileText, FileCheck, FileEdit, AlertOctagon, 
  Activity, ShieldCheck, Target, ArrowRight, 
  CheckCircle2, FolderTree, ClipboardCheck, GraduationCap,
} from 'lucide-react';

interface QmsStats {
  overall_completion: number;
  total_documents: number;
  total_released: number;
  sections: {
    section_id: string;
    section_code: string;
    section_name: string;
    color_code: string;
    sort_order: number;
    total_docs: string;
    released_docs: string;
    approved_docs: string;
    review_docs: string;
    draft_docs: string;
    completion_percentage: number;
  }[];
}

export default function QmsDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [stats, setStats] = useState<QmsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/qms/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load QMS stats', error);
    } finally {
      setLoading(false);
    }
  };

  // Safe mapping for Tailwind dynamic colors
  const getColorStyle = (color: string, type: 'bg' | 'text' | 'border' | 'lightBg') => {
    const colors: Record<string, any> = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', lightBg: 'bg-blue-500/10' },
      teal: { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500/30', lightBg: 'bg-teal-500/10' },
      indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', lightBg: 'bg-indigo-500/10' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', lightBg: 'bg-purple-500/10' },
      green: { bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500/30', lightBg: 'bg-green-500/10' },
      orange: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', lightBg: 'bg-orange-500/10' },
      amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', lightBg: 'bg-amber-500/10' },
      red: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', lightBg: 'bg-red-500/10' },
      rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30', lightBg: 'bg-rose-500/10' },
      cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30', lightBg: 'bg-cyan-500/10' },
    };
    return colors[color]?.[type] || colors.blue[type];
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary-500" />
              Quality Management System
            </h1>
            <p className="text-gray-400 mt-1">ISO 9001 & GMP Compliance Engine</p>
          </div>
          <button 
            onClick={() => router.push('/qms/documents')}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary-500/20"
          >
            <FolderTree className="w-5 h-5" /> Master Document Register
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div></div>
        ) : stats ? (
          <>
            {/* HERO KPI: Overall Compliance Readiness */}
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
              
              <div className="flex justify-between items-end mb-4 relative z-10">
                <div>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Overall QMS Certification Readiness</h2>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black text-white">{stats.overall_completion}%</span>
                    <span className="text-gray-400 font-medium mb-1 border-l border-dark-600 pl-3">
                      <strong className="text-white">{stats.total_released}</strong> of {stats.total_documents} documents released
                    </span>
                  </div>
                </div>
                {stats.overall_completion === 100 && (
                  <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5" /> <span className="font-bold text-sm">Audit Ready</span>
                  </div>
                )}
              </div>
              
              <div className="w-full bg-dark-950 rounded-full h-4 border border-dark-600 relative z-10 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary-600 to-primary-400 h-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${stats.overall_completion}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"></div>
                </div>
              </div>
            </div>

            {/* Document Stats & Quality Workflows */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
              
              {/* Left Side: Document Control Stats */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500/10 text-green-400 rounded-lg"><FileCheck className="w-5 h-5" /></div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Released</p>
                  </div>
                  <p className="text-3xl font-black text-white pl-1">{stats.total_released}</p>
                </div>
                <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg"><FileEdit className="w-5 h-5" /></div>
                    <p className="text-xs text-gray-400 font-bold uppercase">In Draft</p>
                  </div>
                  <p className="text-3xl font-black text-white pl-1">{stats.total_documents - stats.total_released}</p>
                </div>
              </div>

              {/* Right Side: Active Quality Workflows */}
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* NCR Link */}
                <div 
                  onClick={() => router.push('/qms/ncr')}
                  className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center cursor-pointer hover:border-red-500/50 hover:bg-dark-750 transition-all group relative overflow-hidden"
                >
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-4 h-4 text-red-400" /></div>
                  <div className="p-3 bg-red-500/10 text-red-400 rounded-lg w-max mb-3 group-hover:bg-red-500/20 transition-colors"><AlertOctagon className="w-6 h-6" /></div>
                  <p className="text-sm text-gray-400 font-bold uppercase group-hover:text-red-400 transition-colors">NCR Register</p>
                </div>

                {/* CAPA Link */}
                <div 
                  onClick={() => router.push('/qms/capa')}
                  className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center cursor-pointer hover:border-purple-500/50 hover:bg-dark-750 transition-all group relative overflow-hidden"
                >
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-4 h-4 text-purple-400" /></div>
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg w-max mb-3 group-hover:bg-purple-500/20 transition-colors"><Target className="w-6 h-6" /></div>
                  <p className="text-sm text-gray-400 font-bold uppercase group-hover:text-purple-400 transition-colors">Active CAPAs</p>
                </div>

                {/* Audits Link */}
                <div 
                  onClick={() => router.push('/qms/audits')}
                  className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center cursor-pointer hover:border-teal-500/50 hover:bg-dark-750 transition-all group relative overflow-hidden"
                >
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-4 h-4 text-teal-400" /></div>
                  <div className="p-3 bg-teal-500/10 text-teal-400 rounded-lg w-max mb-3 group-hover:bg-teal-500/20 transition-colors"><ClipboardCheck className="w-6 h-6" /></div>
                  <p className="text-sm text-gray-400 font-bold uppercase group-hover:text-teal-400 transition-colors">Internal Audits</p>
                </div>

                {/* Training Matrix Link */}
                <div 
                  onClick={() => router.push('/qms/training')}
                  className="bg-dark-800 border border-dark-700 p-5 rounded-xl flex flex-col justify-center cursor-pointer hover:border-blue-500/50 hover:bg-dark-750 transition-all group relative overflow-hidden"
                >
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-4 h-4 text-blue-400" /></div>
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg w-max mb-3 group-hover:bg-blue-500/20 transition-colors"><GraduationCap className="w-6 h-6" /></div>
                  <p className="text-sm text-gray-400 font-bold uppercase group-hover:text-blue-400 transition-colors">Training Matrix</p>
                </div>
              </div>
            </div>

            {/* The 10 Sections Grid */}
            <div className="pt-4">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400" />
                Departmental QMS Modules
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.sections.map((section) => (
                  <div 
                    key={section.section_id} 
                    onClick={() => router.push(`/qms/documents?section=${section.section_id}`)}
                    className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:bg-dark-750 transition-all cursor-pointer group hover:border-dark-500 hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border ${getColorStyle(section.color_code, 'lightBg')} ${getColorStyle(section.color_code, 'text')} ${getColorStyle(section.color_code, 'border')}`}>
                          {section.section_code}
                        </div>
                        <div>
                          <h3 className="text-white font-bold group-hover:text-primary-400 transition-colors">{section.section_name}</h3>
                          <p className="text-xs text-gray-400">{section.released_docs} of {section.total_docs} Released</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                    </div>

                    <div className="w-full bg-dark-950 rounded-full h-2 border border-dark-700 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${getColorStyle(section.color_code, 'bg')}`}
                        style={{ width: `${section.completion_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-red-400">Failed to load QMS data. Please check the backend connection.</div>
        )}
      </div>
    </DashboardLayout>
  );
}