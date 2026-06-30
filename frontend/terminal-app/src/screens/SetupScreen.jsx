import { useState } from 'react';

export default function SetupScreen({ onSetup }) {
  const [code,  setCode]  = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter the device code printed on this terminal.'); return; }
    onSetup(trimmed);
  };

  return (
    <div className="screen">
      <div className="setup-logo">🕐</div>
      <h1 className="screen-title">VTL Terminal Setup</h1>
      <p className="screen-subtitle">Enter the device code for this terminal.</p>

      <input
        className="input-field"
        type="text"
        placeholder="e.g. KIOSK-01"
        value={code}
        onChange={e => { setCode(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />

      {error && <div className="error-card">{error}</div>}

      <button className="btn btn-primary" onClick={submit} disabled={!code.trim()}>
        Save &amp; Continue
      </button>
    </div>
  );
}
