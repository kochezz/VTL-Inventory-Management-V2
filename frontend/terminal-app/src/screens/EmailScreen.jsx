import { useState } from 'react';

export default function EmailScreen({ punchType, onIdentify, onBack }) {
  const [localpart, setLocalpart] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const submit = async () => {
    const val = localpart.trim().toLowerCase();
    if (!val) { setError('Enter your email username.'); return; }
    setLoading(true);
    setError('');
    try {
      await onIdentify({ email_localpart: val });
    } catch (err) {
      setError(err.message || 'Worker not found. Check your email username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <h1 className="screen-title">
        {punchType === 'clock_in' ? 'Clock In' : 'Clock Out'}
      </h1>
      <p className="screen-subtitle">Enter your email username (before @vilag.io)</p>

      <input
        className="input-field"
        type="text"
        placeholder="e.g. wezi.phiri"
        value={localpart}
        onChange={e => { setLocalpart(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && !loading && submit()}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={loading}
      />

      {error && <div className="error-card">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={!localpart.trim() || loading}
      >
        {loading ? 'Looking up...' : 'Continue'}
      </button>

      <button className="btn btn-ghost" onClick={onBack}>
        Back to QR Scan
      </button>
    </div>
  );
}
