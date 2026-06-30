import { useState } from 'react';
import PinPad from '../components/PinPad.jsx';
import { changePinKiosk } from '../api.js';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

export default function ChangePinScreen({ worker, currentPin, onDone, onBack }) {
  const [phase,   setPhase]   = useState(1); // 1 = new PIN, 2 = confirm PIN
  const [newPin,  setNewPin]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handlePhase1 = (pin) => {
    setNewPin(pin);
    setError('');
    setPhase(2);
  };

  const handlePhase2 = async (confirm) => {
    if (confirm !== newPin) {
      setError("PINs don't match. Try again.");
      setNewPin('');
      setPhase(1);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await changePinKiosk({
        badge_token:     worker.badge_token,
        email_localpart: worker.email_localpart,
        old_pin:         currentPin,
        new_pin:         newPin,
      });
      onDone(newPin);
    } catch (err) {
      setError(err.message || 'PIN change failed. Please try again.');
      setNewPin('');
      setPhase(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      {worker && (
        <div className="worker-card">
          <div className="worker-avatar">{initials(worker.full_name)}</div>
          <div className="worker-name">{worker.full_name}</div>
        </div>
      )}

      <h1 className="screen-title">Set New PIN</h1>
      <p className="screen-subtitle" style={{ color: '#fbbf24' }}>
        Your PIN must be changed before you can punch in.
      </p>

      {error && <div className="error-card">{error}</div>}

      {loading ? (
        <p className="screen-subtitle">Saving...</p>
      ) : (
        <>
          <p className="screen-subtitle">
            {phase === 1 ? 'Enter your new 4-digit PIN' : 'Confirm your new PIN'}
          </p>
          <PinPad key={phase} onComplete={phase === 1 ? handlePhase1 : handlePhase2} />
        </>
      )}

      <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
    </div>
  );
}
