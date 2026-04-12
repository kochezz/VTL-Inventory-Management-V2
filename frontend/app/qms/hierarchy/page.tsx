'use client';

// ============================================================================
// DOCUMENT HIERARCHY PAGE
// Route: /qms/hierarchy
// File: app/qms/hierarchy/page.tsx
//
// Interactive visualisation of document relationships across the QMS.
// Uses a force-directed layout built with D3-style positioning in React —
// no external graph library needed.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, Filter, ZoomIn, ZoomOut, Maximize2,
  FileText, BookOpen, FileEdit, FolderTree, ChevronRight,
  CheckCircle2, Clock, Search, X
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Node {
  id: string; doc_code: string; doc_name: string; doc_type: string;
  status: string; section_code: string; section_name: string; color_code: string;
  version_number?: string;
  // layout
  x?: number; y?: number; vx?: number; vy?: number;
}

interface Edge {
  id: string; source: string; target: string; relationship: string;
}

// ── Doc type helpers ───────────────────────────────────────────────────────

const DOC_TYPE_COLOR: Record<string, string> = {
  MAN: '#8b5cf6', POL: '#0ea5e9', SOP: '#10b981',
  FRM: '#f59e0b', CHK: '#f97316', LOG: '#6366f1', REG: '#ec4899',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  MAN: 'Manual', POL: 'Policy', SOP: 'SOP',
  FRM: 'Form', CHK: 'Checklist', LOG: 'Log', REG: 'Register',
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  references:    'references',
  implements:    'implements',
  spawned_from:  'spawned from',
};

const RELATIONSHIP_COLOR: Record<string, string> = {
  references:   '#64748b',
  implements:   '#0ea5e9',
  spawned_from: '#f59e0b',
};

const STATUS_RING: Record<string, string> = {
  RELEASED: '#10b981', REVIEW: '#3b82f6', DRAFT: '#f59e0b',
  PLANNED: '#a855f7', SUPERSEDED: '#6b7280',
};

// ── Simple force layout (no D3 dependency) ────────────────────────────────

function runLayout(nodes: Node[], edges: Edge[], width: number, height: number): Node[] {
  const positioned = nodes.map((n, i) => ({
    ...n,
    x: n.x ?? width / 2 + Math.cos((i / nodes.length) * 2 * Math.PI) * 300,
    y: n.y ?? height / 2 + Math.sin((i / nodes.length) * 2 * Math.PI) * 200,
    vx: 0, vy: 0,
  }));

  const nodeMap = new Map(positioned.map(n => [n.id, n]));

  // Run 80 iterations of force simulation
  for (let iter = 0; iter < 80; iter++) {
    const alpha = 1 - iter / 80;

    // Repulsion between all nodes
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i], b = positioned[j];
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (4000 / (dist * dist)) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx = (a.vx ?? 0) - fx;
        a.vy = (a.vy ?? 0) - fy;
        b.vx = (b.vx ?? 0) + fx;
        b.vy = (b.vy ?? 0) + fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;
      const dx = (tgt.x ?? 0) - (src.x ?? 0);
      const dy = (tgt.y ?? 0) - (src.y ?? 0);
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const target_dist = 200;
      const force = ((dist - target_dist) / dist) * 0.05 * alpha;
      const fx = dx * force;
      const fy = dy * force;
      src.vx = (src.vx ?? 0) + fx;
      src.vy = (src.vy ?? 0) + fy;
      tgt.vx = (tgt.vx ?? 0) - fx;
      tgt.vy = (tgt.vy ?? 0) - fy;
    }

    // Gravity toward center
    for (const n of positioned) {
      n.vx = ((n.vx ?? 0) + ((width / 2 - (n.x ?? 0)) * 0.002 * alpha)) * 0.9;
      n.vy = ((n.vy ?? 0) + ((height / 2 - (n.y ?? 0)) * 0.002 * alpha)) * 0.9;
      n.x = (n.x ?? 0) + n.vx;
      n.y = (n.y ?? 0) + n.vy;
      // Keep in bounds
      n.x = Math.max(80, Math.min(width - 80, n.x));
      n.y = Math.max(60, Math.min(height - 60, n.y));
    }
  }

  return positioned;
}

// ============================================================================

export default function HierarchyPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const [nodes, setNodes]         = useState<Node[]>([]);
  const [edges, setEdges]         = useState<Edge[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sections, setSections]   = useState<any[]>([]);
  const [sectionFilter, setSectionFilter] = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Node | null>(null);
  const [zoom, setZoom]           = useState(1);
  const [pan, setPan]             = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart]   = useState({ x: 0, y: 0 });

  const W = 1200, H = 700;

  useEffect(() => {
    fetchData();
  }, [sectionFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      const [hierRes, sectRes] = await Promise.all([
        api.get(`/qms/hierarchy${sectionFilter ? `?section_id=${sectionFilter}` : ''}`),
        api.get('/qms/sections'),
      ]);
      setSections(sectRes.data);
      const rawNodes: Node[] = hierRes.data.nodes;
      const rawEdges: Edge[] = hierRes.data.edges;
      const laid = runLayout(rawNodes, rawEdges, W, H);
      setNodes(laid);
      setEdges(rawEdges);
    } catch (e) {
      console.error('Failed to load hierarchy', e);
    } finally {
      setLoading(false);
    }
  }

  // Visible nodes after filter
  const visibleNodes = nodes.filter(n => {
    const matchType   = !typeFilter || n.doc_type === typeFilter;
    const matchSearch = !search ||
      n.doc_code.toLowerCase().includes(search.toLowerCase()) ||
      n.doc_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

  // Pan handlers
  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest('.node-group')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }
  function onMouseUp() { setIsPanning(false); }

  function zoomIn()  { setZoom(z => Math.min(z + 0.15, 2.5)); }
  function zoomOut() { setZoom(z => Math.max(z - 0.15, 0.3)); }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Arrow midpoint for edge label
  function edgeMid(e: Edge) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (!src || !tgt) return { x: 0, y: 0 };
    return { x: ((src.x ?? 0) + (tgt.x ?? 0)) / 2, y: ((src.y ?? 0) + (tgt.y ?? 0)) / 2 };
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/qms')} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400"/>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <FolderTree className="w-7 h-7 text-primary-500"/> Document Hierarchy
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">Visual map of document relationships across the QMS</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="pl-9 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm w-48 focus:border-primary-500 outline-none"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5"/></button>}
            </div>

            {/* Section filter */}
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
              <option value="">All sections</option>
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_code} — {s.section_name}</option>)}
            </select>

            {/* Doc type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
              <option value="">All types</option>
              {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
              <button onClick={zoomOut} className="p-1.5 hover:bg-dark-700 rounded text-gray-400 hover:text-white transition-colors"><ZoomOut className="w-4 h-4"/></button>
              <span className="text-xs text-gray-400 px-2 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 hover:bg-dark-700 rounded text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4"/></button>
              <button onClick={resetView} className="p-1.5 hover:bg-dark-700 rounded text-gray-400 hover:text-white transition-colors" title="Reset view"><Maximize2 className="w-4 h-4"/></button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-xs">
          <span className="text-gray-500 font-medium uppercase tracking-wider">Doc type</span>
          {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DOC_TYPE_COLOR[k] }}/>
              <span className="text-gray-300">{v}</span>
            </div>
          ))}
          <div className="ml-4 pl-4 border-l border-dark-600 flex items-center gap-4">
            <span className="text-gray-500 font-medium uppercase tracking-wider">Relationship</span>
            {Object.entries(RELATIONSHIP_LABEL).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-6 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLOR[k] }}/>
                <span className="text-gray-300">{v}</span>
              </div>
            ))}
          </div>
          {edges.length === 0 && !loading && (
            <span className="ml-auto text-amber-400 text-xs">No document links defined yet — add links from document detail pages</span>
          )}
        </div>

        {/* Graph canvas */}
        <div className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden" style={{ height: '620px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
            </div>
          ) : visibleNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FolderTree className="w-12 h-12 mb-4 text-gray-700"/>
              <p className="font-medium">No documents match your filters</p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%" height="100%"
              viewBox={`0 0 ${W} ${H}`}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <defs>
                <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
                </marker>
                {Object.entries(RELATIONSHIP_COLOR).map(([k, color]) => (
                  <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={color}/>
                  </marker>
                ))}
              </defs>

              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {visibleEdges.map(edge => {
                  const src = nodeMap.get(edge.source);
                  const tgt = nodeMap.get(edge.target);
                  if (!src || !tgt) return null;
                  const mid = edgeMid(edge);
                  const color = RELATIONSHIP_COLOR[edge.relationship] || '#64748b';
                  return (
                    <g key={edge.id}>
                      <line
                        x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                        stroke={color} strokeWidth="1.5" strokeOpacity="0.6"
                        markerEnd={`url(#arrow-${edge.relationship})`}
                      />
                      <text x={mid.x} y={mid.y - 6} textAnchor="middle"
                        fontSize="9" fill={color} opacity="0.8">
                        {RELATIONSHIP_LABEL[edge.relationship]}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {visibleNodes.map(node => {
                  const color   = DOC_TYPE_COLOR[node.doc_type] || '#64748b';
                  const ring    = STATUS_RING[node.status] || '#6b7280';
                  const isSelected = selected?.id === node.id;
                  const isDimmed = selected && !isSelected &&
                    !visibleEdges.some(e => e.source === node.id || e.target === node.id ||
                      (selected && (e.source === selected.id || e.target === selected.id) &&
                       (e.source === node.id || e.target === node.id)));

                  return (
                    <g key={node.id} className="node-group"
                      style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
                      transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                      onClick={() => setSelected(selected?.id === node.id ? null : node)}>

                      {/* Status ring */}
                      <circle r="30" fill="none" stroke={ring} strokeWidth="2.5" opacity="0.6"/>

                      {/* Node body */}
                      <circle r="26" fill={`${color}22`} stroke={color} strokeWidth={isSelected ? 3 : 1.5}/>

                      {/* Doc type label */}
                      <text textAnchor="middle" dominantBaseline="central"
                        fontSize="11" fontWeight="700" fill={color}>
                        {node.doc_type}
                      </text>

                      {/* Doc code below */}
                      <text textAnchor="middle" y="40" fontSize="9" fill="#94a3b8" fontWeight="500">
                        {node.doc_code}
                      </text>

                      {/* Doc name (truncated) */}
                      <text textAnchor="middle" y="52" fontSize="8" fill="#64748b">
                        {node.doc_name.length > 22 ? node.doc_name.slice(0, 20) + '…' : node.doc_name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Selected node detail panel */}
        {selected && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{ backgroundColor: `${DOC_TYPE_COLOR[selected.doc_type]}22`, color: DOC_TYPE_COLOR[selected.doc_type], border: `2px solid ${DOC_TYPE_COLOR[selected.doc_type]}` }}>
                {selected.doc_type}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono font-bold text-primary-400">{selected.doc_code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
                    selected.status === 'RELEASED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    selected.status === 'DRAFT' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>{selected.status}</span>
                  {selected.version_number && <span className="text-xs text-gray-500">v{selected.version_number}</span>}
                </div>
                <p className="text-white font-bold">{selected.doc_name}</p>
                <p className="text-gray-400 text-sm mt-0.5">{selected.section_code} — {selected.section_name}</p>
                <div className="flex items-center gap-3 mt-3 text-sm">
                  <span className="text-gray-500">
                    Links: {visibleEdges.filter(e => e.source === selected.id || e.target === selected.id).length} connection{visibleEdges.filter(e => e.source === selected.id || e.target === selected.id).length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => router.push(`/qms/documents/${selected.id}`)}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                Open Document <ChevronRight className="w-4 h-4"/>
              </button>
              <button onClick={() => router.push(`/qms/documents/${selected.id}/inspector`)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                Inspector View <ChevronRight className="w-4 h-4"/>
              </button>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors p-1"><X className="w-5 h-5"/></button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-sm text-gray-500 px-2">
          <span>{visibleNodes.length} document{visibleNodes.length !== 1 ? 's' : ''}</span>
          <span>{visibleEdges.length} link{visibleEdges.length !== 1 ? 's' : ''}</span>
          <span className="ml-auto text-xs">Drag to pan · Scroll or use controls to zoom · Click a node to inspect</span>
        </div>

      </div>
    </DashboardLayout>
  );
}