'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FileText, FileCheck, FileEdit, AlertOctagon,
  Activity, ShieldCheck, Target, ArrowRight,
  CheckCircle2, FolderTree, ClipboardCheck, GraduationCap,
  Clock, AlertCircle, BookOpen, Bell, ChevronRight,
  User, RefreshCw, X
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QmsStats {
  overall_completion: number;
  total_documents: number;
  total_released: number;
  sections: {
    section_id: string; section_code: string; section_name: string;
    color_code: string; sort_order: number;
    total_docs: string; released_docs: string;
    completion_percentage: number;
  }[];
}

interface DashboardSummary {
  total_released: string;
  total_in_review: string;
  total_in_draft: string;
  total_active: string;
  review_tasks_open: string;
  overdue_count: string;
  training_pending: string;
  ncr_open: string;
  capa_open: string;
}

interface TaskItem {
  task_type: 'review_assignment' | 'periodic_review' | 'training';
  doc_id: string; doc_code: string; doc_name: string; doc_type: string;
  version_id?: string; version_number: string;
  author_name?: string; change_reason?: string; task_date: string;
}

interface MyTasks {
  review_assignments: TaskItem[];
  periodic_reviews: TaskItem[];
  training_pending: TaskItem[];
  total_open: number;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const getColorStyle = (color: string, type: 'bg' | 'text' | 'border' | 'lightBg') => {
  const colors: Record<string, any> = {
    blue:   { bg: 'bg-blue-500',   text: 'text-blue-400',   border: 'border-blue-500/30',   lightBg: 'bg-blue-500/10' },
    teal:   { bg: 'bg-teal-500',   text: 'text-teal-400',   border: 'border-teal-500/30',   lightBg: 'bg-teal-500/10' },
    indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', lightBg: 'bg-indigo-500/10' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', lightBg: 'bg-purple-500/10' },
    green:  { bg: 'bg-green-500',  text: 'text-green-400',  border: 'border-green-500/30',  lightBg: 'bg-green-500/10' },
    orange: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', lightBg: 'bg-orange-500/10' },
    amber:  { bg: 'bg-amber-500',  text: 'text-amber-400',  border: 'border-amber-500/30',  lightBg: 'bg-amber-500/10' },
    red:    { bg: 'bg-red-500',    text: 'text-red-400',    border: 'border-red-500/30',    lightBg: 'bg-red-500/10' },
    cyan:   { bg: 'bg-cyan-500',   text: 'text-cyan-400',   border: 'border-cyan-500/30',   lightBg: 'bg-cyan-500/10' },
  };
  return colors[color]?.[type] || colors.blue[type];
};

// ── Task card component ───────────────────────────────────────────────────────

function TaskCard({
  task, onAction, onDismiss, actionLabel, actionColor
}: {
  task: TaskItem;
  onAction: (task: TaskItem) => void;
  onDismiss?: (task: TaskItem) => void;
  actionLabel: string;
  actionColor: string;
}) {
  const relativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0)  return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Due today';
    if (diff <= 7)  return `Due in ${diff}d`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const isOverdue = new Date(task.task_date) < new Date() && task.task_type === 'periodic_review';

  return (
    <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all ${isOverdue ? 'bg-red-500/5 border-red-500/20' : 'bg-dark-900 border-dark-700'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-primary-400 font-bold">{task.doc_code}</span>
          <span className="text-xs text-gray-500 bg-dark-800 px-1.5 py-0.5 rounded">{task.doc_type}</span>
          {task.task_type === 'periodic_review' && (
            <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
              {relativeDate(task.task_date)}
            </span>
          )}
          {task.task_type === 'training' && (
            <span className="text-xs text-blue-400">v{task.version_number}</span>
          )}
        </div>
        <p className="text-white text-sm font-medium truncate">{task.doc_name}</p>
        {task.author_name && (
          <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3"/> Authored by {task.author_name}
            {task.change_reason && <span className="ml-1 italic truncate max-w-[200px]">— {task.change_reason}</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onDismiss && (
          <button onClick={() => onDismiss(task)} title="Dismiss task"
            className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5"/>
          </button>
        )}
        <button onClick={() => onAction(task)}
          className={`px-3 py-1.5 ${actionColor} text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors`}>
          {actionLabel} <ChevronRight className="w-3 h-3"/>
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QmsDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const [stats,   setStats]   = useState<QmsStats | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [myTasks, setMyTasks] = useState<MyTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTaskTab, setActiveTaskTab] = useState<'review'|'periodic'|'training'>('review');

  useEffect(() => {
    if (isAuthenticated) { fetchStats(); fetchMyTasks(); }
  }, [isAuthenticated]);

  async function fetchStats() {
    try {
      setLoading(true);
      const [statsRes, summaryRes] = await Promise.all([
        api.get('/qms/stats'),
        api.get('/qms/dashboard-summary'),
      ]);
      setStats(statsRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to load QMS stats', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyTasks() {
    try {
      setTasksLoading(true);
      const res = await api.get('/qms/my-tasks');
      setMyTasks(res.data);
      // Default to whichever tab has items
      if (res.data.review_assignments.length > 0)   setActiveTaskTab('review');
      else if (res.data.periodic_reviews.length > 0) setActiveTaskTab('periodic');
      else if (res.data.training_pending.length > 0) setActiveTaskTab('training');
    } catch (error) {
      console.error('Failed to load tasks', error);
    } finally {
      setTasksLoading(false);
    }
  }

  function handleTaskAction(task: TaskItem) {
    if (task.task_type === 'training') {
      router.push('/qms/training');
    } else {
      router.push(`/qms/documents/${task.doc_id}`);
    }
  }

  async function handleDismissReview(task: TaskItem) {
    // For periodic review tasks, find the task_id from the review tasks list
    // We navigate to the document where they can dismiss from the UI
    router.push(`/qms/documents/${task.doc_id}`);
  }

  if (!isAuthenticated) return null;

  const totalTasks = myTasks?.total_open || 0;
  const overdueCount = parseInt(summary?.overdue_count || '0');

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary-500"/>
              Quality Management System
            </h1>
            <p className="text-gray-400 mt-1">ISO 9001 & GMP Compliance Engine</p>
          </div>
          <button onClick={() => router.push('/qms/documents')}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary-500/20">
            <FolderTree className="w-5 h-5"/> Master Document Register
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
          </div>
        ) : stats ? (
          <>
            {/* Overall readiness bar */}
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-10 -mt-10"/>
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
                    <CheckCircle2 className="w-5 h-5"/> <span className="font-bold text-sm">Audit Ready</span>
                  </div>
                )}
              </div>
              <div className="w-full bg-dark-950 rounded-full h-4 border border-dark-600 relative z-10 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-600 to-primary-400 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats.overall_completion}%` }}/>
              </div>
            </div>

            {/* Two-column: KPIs left, My Tasks right */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* KPI grid — left 2 cols */}
              <div className="lg:col-span-2 space-y-4">

                {/* Alert banner if overdue docs exist */}
                {overdueCount > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0"/>
                    <div>
                      <p className="text-red-400 font-bold text-sm">{overdueCount} document{overdueCount > 1 ? 's' : ''} overdue for review</p>
                      <p className="text-red-400/70 text-xs mt-0.5">Action required to maintain GMP compliance</p>
                    </div>
                    <button onClick={() => router.push('/qms/review-tasks')} className="ml-auto text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1">
                      View <ChevronRight className="w-3 h-3"/>
                    </button>
                  </div>
                )}

                {/* KPI tiles */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-green-500/10 text-green-400 rounded-lg"><FileCheck className="w-4 h-4"/></div>
                      <p className="text-xs text-gray-400 font-bold uppercase">Released</p>
                    </div>
                    <p className="text-3xl font-black text-white">{summary?.total_released || 0}</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"><Clock className="w-4 h-4"/></div>
                      <p className="text-xs text-gray-400 font-bold uppercase">In Review</p>
                    </div>
                    <p className="text-3xl font-black text-white">{summary?.total_in_review || 0}</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg"><FileEdit className="w-4 h-4"/></div>
                      <p className="text-xs text-gray-400 font-bold uppercase">Drafts</p>
                    </div>
                    <p className="text-3xl font-black text-white">{summary?.total_in_draft || 0}</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><Bell className="w-4 h-4"/></div>
                      <p className="text-xs text-gray-400 font-bold uppercase">Reviews Due</p>
                    </div>
                    <p className={`text-3xl font-black ${parseInt(summary?.review_tasks_open || '0') > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {summary?.review_tasks_open || 0}
                    </p>
                  </div>
                </div>

                {/* Quality workflows */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'NCR Register',     count: summary?.ncr_open,       color: 'red',    icon: AlertOctagon,  route: '/qms/ncr' },
                    { label: 'Active CAPAs',      count: summary?.capa_open,      color: 'purple', icon: Target,        route: '/qms/capa' },
                    { label: 'Internal Audits',   count: null,                    color: 'teal',   icon: ClipboardCheck,route: '/qms/audits' },
                    { label: 'Training Pending',  count: summary?.training_pending,color:'blue',   icon: GraduationCap, route: '/qms/training' },
                  ].map(({ label, count, color, icon: Icon, route }) => (
                    <div key={route} onClick={() => router.push(route)}
                      className="bg-dark-800 border border-dark-700 p-4 rounded-xl cursor-pointer hover:border-dark-500 transition-all group relative overflow-hidden">
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400"/>
                      </div>
                      <div className={`p-2 ${getColorStyle(color, 'lightBg')} ${getColorStyle(color, 'text')} rounded-lg w-max mb-2`}>
                        <Icon className="w-4 h-4"/>
                      </div>
                      <p className="text-xs text-gray-400 font-bold uppercase leading-tight">{label}</p>
                      {count !== null && count !== undefined && (
                        <p className={`text-2xl font-black mt-1 ${parseInt(count) > 0 ? getColorStyle(color, 'text') : 'text-white'}`}>{count}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* My Tasks panel — right 3 cols */}
              <div className="lg:col-span-3 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
                <div className="bg-dark-900/80 border-b border-dark-700 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-white font-bold flex items-center gap-2">
                      <Bell className="w-5 h-5 text-primary-400"/> My Tasks
                    </h2>
                    {totalTasks > 0 && (
                      <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {totalTasks}
                      </span>
                    )}
                  </div>
                  <button onClick={fetchMyTasks} className="text-gray-500 hover:text-gray-300 transition-colors" title="Refresh tasks">
                    <RefreshCw className="w-4 h-4"/>
                  </button>
                </div>

                {/* Task type tabs */}
                <div className="flex border-b border-dark-700">
                  {([
                    { key: 'review',   label: 'Review',   count: myTasks?.review_assignments.length || 0,  color: 'text-blue-400' },
                    { key: 'periodic', label: 'Due',      count: myTasks?.periodic_reviews.length || 0,    color: 'text-amber-400' },
                    { key: 'training', label: 'Training', count: myTasks?.training_pending.length || 0,    color: 'text-green-400' },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTaskTab(tab.key)}
                      className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTaskTab === tab.key ? 'border-primary-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-dark-700 ${tab.color}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-3 min-h-[280px]">
                  {tasksLoading ? (
                    <div className="flex justify-center py-10">
                      <div className="w-7 h-7 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
                    </div>
                  ) : (
                    <>
                      {/* Review assignment tab */}
                      {activeTaskTab === 'review' && (
                        myTasks?.review_assignments.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-700"/>
                            <p className="text-sm">No documents awaiting your review</p>
                          </div>
                        ) : myTasks?.review_assignments.map(task => (
                          <TaskCard key={task.version_id || task.doc_id} task={task}
                            onAction={handleTaskAction}
                            actionLabel="Review" actionColor="bg-blue-600 hover:bg-blue-700"/>
                        ))
                      )}

                      {/* Periodic review tab */}
                      {activeTaskTab === 'periodic' && (
                        myTasks?.periodic_reviews.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-700"/>
                            <p className="text-sm">No periodic reviews due</p>
                          </div>
                        ) : myTasks?.periodic_reviews.map(task => (
                          <TaskCard key={task.doc_id} task={task}
                            onAction={handleTaskAction}
                            onDismiss={handleDismissReview}
                            actionLabel="Open Doc" actionColor="bg-amber-600 hover:bg-amber-700"/>
                        ))
                      )}

                      {/* Training tab */}
                      {activeTaskTab === 'training' && (
                        myTasks?.training_pending.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-700"/>
                            <p className="text-sm">All training up to date</p>
                          </div>
                        ) : myTasks?.training_pending.map(task => (
                          <TaskCard key={task.version_id || task.doc_id} task={task}
                            onAction={handleTaskAction}
                            actionLabel="Acknowledge" actionColor="bg-green-600 hover:bg-green-700"/>
                        ))
                      )}
                    </>
                  )}
                </div>

                {/* Footer CTA */}
                {totalTasks > 0 && (
                  <div className="border-t border-dark-700 px-4 py-3 bg-dark-900/40">
                    <button onClick={() => router.push('/qms/training')}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                      View full training matrix <ChevronRight className="w-3 h-3"/>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Departmental section grid */}
            <div className="pt-2">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400"/> Departmental QMS Modules
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {stats.sections.map((section) => (
                  <div key={section.section_id}
                    onClick={() => router.push(`/qms/documents?section=${section.section_id}`)}
                    className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:bg-dark-750 transition-all cursor-pointer group hover:border-dark-500 hover:shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border text-sm ${getColorStyle(section.color_code, 'lightBg')} ${getColorStyle(section.color_code, 'text')} ${getColorStyle(section.color_code, 'border')}`}>
                          {section.section_code}
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm group-hover:text-primary-400 transition-colors">{section.section_name}</h3>
                          <p className="text-xs text-gray-400">{section.released_docs} of {section.total_docs} released</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors"/>
                    </div>
                    <div className="w-full bg-dark-950 rounded-full h-2 border border-dark-700 overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${getColorStyle(section.color_code, 'bg')}`}
                        style={{ width: `${section.completion_percentage}%` }}/>
                    </div>
                    <p className="text-right text-xs text-gray-500 mt-1">{section.completion_percentage}%</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-red-400 py-10">Failed to load QMS data. Check backend connection.</div>
        )}
      </div>
    </DashboardLayout>
  );
}