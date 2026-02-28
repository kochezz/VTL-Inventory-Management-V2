'use client';

import { useState, useEffect } from 'react';
import { api } from '@/hooks/useAuth';
import { AlertOctagon, X, Save, AlertTriangle, Key } from 'lucide-react';

interface RaiseNCRModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceModule: string; // e.g., 'Production', 'Inventory'
  sourceId: string;     // e.g., 'PROD-R500-001'
  onSuccess?: () => void;
}

export default function RaiseNCRModal({ isOpen, onClose, sourceModule, sourceId, onSuccess }: RaiseNCRModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');

  const [formData, setFormData] = useState({
    description: '',
    severity: 'Minor',
    assigned_to: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setFormData({ description: '', severity: 'Minor', assigned_to: '' });
      setSignature('');
      setError('');
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.filter((u: any) => ['qa', 'manager', 'admin'].includes(u.role)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) return setError('Digital Signature is required.');
    setSaving(true);
    setError('');

    try {
      const payload = {
        source_module: sourceModule,
        source_id: sourceId,
        description: formData.description,
        severity: formData.severity,
        assigned_to: formData.assigned_to,
        status: 'OPEN',
        signature_password: signature
      };

      await api.post('/qms/ncrs', payload);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to raise NCR.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-2xl shadow-2xl">
        <div className="px-6 py-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-red-500"/> 
            Raise Non-Conformance (NCR)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}

          {/* Auto-filled Context */}
          <div className="flex gap-4 p-4 bg-dark-900 rounded-lg border border-dark-700">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Source Module</p>
              <p className="text-white font-medium">{sourceModule}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Reference ID</p>
              <p className="text-white font-mono font-bold">{sourceId}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Issue Description *</label>
            <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500" placeholder="Describe the deviation, defect, or failure..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Severity</label>
              <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500">
                <option value="Minor">Minor (Easily corrected)</option>
                <option value="Major">Major (Product loss, moderate risk)</option>
                <option value="Critical">Critical (Food safety risk, recall risk)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Assign Investigator (Optional)</label>
              <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-red-500">
                <option value="">-- Unassigned --</option>
                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Key className="w-4 h-4 text-primary-400" /> Digital Signature Required</h3>
            <input type="password" value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder="Enter your login password" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 font-mono tracking-widest" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-2 text-gray-400 hover:text-white bg-dark-900 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !signature} className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50">
              {saving ? 'Processing...' : <><Save className="w-4 h-4"/> Sign & Escalate to QMS</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}