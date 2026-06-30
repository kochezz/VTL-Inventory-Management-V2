'use client';

// Admin-only: issue or reset clock-in PINs for employees.
// Issued / reset PINs are always temporary — the employee must change them
// at the clock-in terminal before their first punch.

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth, api } from '@/hooks/useAuth';
import { ShieldCheck, AlertCircle, CheckCircle, Info, Lock, QrCode, AlertTriangle, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AttendanceAdminPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [employees, setEmployees] = useState<any[]>([]);
  const [userId,  setUserId]  = useState('');
  const [tempPin, setTempPin] = useState('');
  const [action,  setAction]  = useState<'issue' | 'reset'>('issue');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  // Badge issuance — independent state; never shares data with PIN section
  const [badgeUserId,  setBadgeUserId]  = useState('');
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgePreview, setBadgePreview] = useState<any>(null);
  const [badgeError,   setBadgeError]   = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') { router.push('/dashboard'); return; }
    api.get('/attendance/employees')
      .then(r => {
        setEmployees(r.data.employees);
        if (r.data.employees.length) {
          setUserId(r.data.employees[0].user_id);
          setBadgeUserId(r.data.employees[0].user_id);
        }
      })
      .catch(() => setError('Failed to load employee list.'));
  }, [user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(tempPin)) {
      setError('PIN must be exactly 4 digits (0–9).');
      return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      const endpoint = action === 'issue'
        ? '/attendance/pin/issue'
        : '/attendance/pin/reset';
      await api.post(endpoint, { user_id: userId, temp_pin: tempPin });
      const name = employees.find(e => e.user_id === userId)?.full_name ?? 'Employee';
      setSuccess(
        `PIN ${action === 'issue' ? 'issued' : 'reset'} for ${name}. ` +
        `They must change it at the terminal before their first punch.`
      );
      setTempPin('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueBadge = async () => {
    setBadgeLoading(true); setBadgeError(''); setBadgePreview(null);
    try {
      const res = await api.post('/attendance/badge/issue', { user_id: badgeUserId });
      setBadgePreview(res.data);
    } catch (err: any) {
      setBadgeError(err.response?.data?.message || 'Failed to generate badge.');
    } finally {
      setBadgeLoading(false);
    }
  };

  // Opens a minimal print window; raw_token is never in the markup — only in the QR SVG.
  function printBadge(preview: any) {
    const w = window.open('', '_blank', 'width=420,height=620');
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head>
      <title>Badge — ${preview.full_name}</title>
      <style>
        body{margin:0;display:flex;justify-content:center;padding:32px;
             font-family:Arial,sans-serif;background:#fff}
        .badge{border:2px solid #333;border-radius:12px;padding:24px;
               width:280px;text-align:center}
        .qr svg{width:200px!important;height:200px!important;display:block;margin:0 auto}
        img{width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:12px}
        h2{margin:8px 0 4px;font-size:17px;color:#111}
        .title{color:#555;font-size:12px;margin:2px 0}
        .empno{color:#999;font-size:11px;font-family:monospace;margin-top:6px}
        @media print{body{padding:0}}
      </style></head><body>
      <div class="badge">
        ${preview.photo_url ? `<img src="${preview.photo_url}" alt="">` : ''}
        <div class="qr">${preview.qr_svg}</div>
        <h2>${preview.full_name}</h2>
        ${preview.job_title       ? `<p class="title">${preview.job_title}</p>`       : ''}
        ${preview.employee_number ? `<p class="empno">${preview.employee_number}</p>` : ''}
      </div>
      <script>window.addEventListener('load',()=>{window.print();setTimeout(()=>window.close(),800);})<\/script>
      </body></html>`
    );
    w.document.close();
  }

  if (user?.role !== 'admin') return null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary-400" />
            Attendance PIN Management
          </h1>
          <p className="text-gray-400 mt-1">Issue or reset clock-in PINs for employees</p>
        </div>

        {/* Permanent notice about temporary PINs */}
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 p-4 rounded-xl
                        flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Issued and reset PINs are always temporary</p>
            <p className="text-sm opacity-85 mt-1">
              The employee will be prompted to change their PIN at the clock-in terminal
              before they can record their first punch. PINs are stored bcrypt-hashed —
              you cannot view a PIN after issuing it.
            </p>
          </div>
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400
                          px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400
                          px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden"
        >
          <div className="p-6 border-b border-dark-700 bg-dark-900/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-400" />
              PIN Action
            </h2>
          </div>

          <div className="p-6 space-y-5">

            {/* Action toggle */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Action</label>
              <div className="flex gap-3">
                {(['issue', 'reset'] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                      action === a
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-950 text-gray-400 border border-dark-600 hover:border-primary-500'
                    }`}
                  >
                    {a === 'issue' ? 'Issue New PIN' : 'Reset Existing PIN'}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Employee</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg
                           text-white focus:border-primary-500 outline-none"
              >
                {employees.length === 0 && <option value="">Loading...</option>}
                {employees.map((e: any) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name} — {e.email} ({e.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Temp PIN input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Temporary PIN <span className="text-gray-500">(4 digits)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={tempPin}
                onChange={e => { setTempPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="e.g. 1234"
                className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg
                           text-white font-mono text-xl tracking-[0.4em]
                           focus:border-primary-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Communicate this PIN securely. It is stored hashed and cannot be viewed again.
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end">
            <button
              type="submit"
              disabled={loading || !userId || tempPin.length !== 4}
              className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold
                         rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <ShieldCheck className="w-5 h-5" />}
              {action === 'issue' ? 'Issue PIN' : 'Reset PIN'}
            </button>
          </div>
        </form>
        {/* ── Badge QR Issuance ── */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-dark-700 bg-dark-900/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-400" />
              Badge QR Issuance
            </h2>
          </div>

          <div className="p-6 space-y-5">

            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300
                            p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Reissuing immediately revokes the previous badge</p>
                <p className="text-sm opacity-85 mt-1">
                  Any kiosk scan using the old QR is rejected instantly.
                  The QR shown here is the only readable form of the token —
                  it is never stored or displayed as text.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Employee</label>
              <select
                value={badgeUserId}
                onChange={e => { setBadgeUserId(e.target.value); setBadgePreview(null); setBadgeError(''); }}
                className="w-full px-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg
                           text-white focus:border-primary-500 outline-none"
              >
                {employees.length === 0 && <option value="">Loading...</option>}
                {employees.map((e: any) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name} — {e.email} ({e.role})
                  </option>
                ))}
              </select>
            </div>

            {badgeError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400
                              px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" /> {badgeError}
              </div>
            )}

            <button
              onClick={handleIssueBadge}
              disabled={badgeLoading || !badgeUserId}
              className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold
                         rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {badgeLoading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <QrCode className="w-5 h-5" />}
              Issue / Reissue Badge QR
            </button>

            {badgePreview && (
              <div className="space-y-4">
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Badge Preview</p>
                  {badgePreview.photo_url && (
                    <img
                      src={badgePreview.photo_url}
                      alt=""
                      className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border-2 border-dark-600"
                    />
                  )}
                  {/* QR SVG — raw_token encoded within; never exposed as display text */}
                  <div
                    className="mx-auto mb-4 [&_svg]:mx-auto [&_svg]:w-48 [&_svg]:h-48 [&_svg]:block"
                    dangerouslySetInnerHTML={{ __html: badgePreview.qr_svg }}
                  />
                  <p className="text-white font-bold text-lg">{badgePreview.full_name}</p>
                  {badgePreview.job_title && (
                    <p className="text-gray-400 text-sm mt-0.5">{badgePreview.job_title}</p>
                  )}
                  {badgePreview.employee_number && (
                    <p className="text-gray-500 text-xs font-mono mt-1">{badgePreview.employee_number}</p>
                  )}
                </div>
                <button
                  onClick={() => printBadge(badgePreview)}
                  className="w-full py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600
                             text-white font-bold rounded-lg flex items-center justify-center gap-2
                             transition-colors"
                >
                  <Download className="w-4 h-4" /> Print Badge
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
