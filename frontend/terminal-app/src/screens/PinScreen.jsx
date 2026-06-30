import PinPad from '../components/PinPad.jsx';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

export default function PinScreen({ worker, error, onComplete, onBack }) {
  const locked = error?.code === 'PIN_LOCKED';

  let errorMsg = null;
  if (error) {
    if (locked) {
      errorMsg = `Account locked — try again in ${error.minutes_remaining} minute${error.minutes_remaining !== 1 ? 's' : ''}`;
    } else if (error.code === 'INVALID_PIN') {
      errorMsg = `Wrong PIN — ${error.attempts_remaining} attempt${error.attempts_remaining !== 1 ? 's' : ''} remaining`;
    } else {
      errorMsg = error.message || 'PIN error';
    }
  }

  return (
    <div className="screen">
      {worker && (
        <div className="worker-card">
          <div className="worker-avatar">{initials(worker.full_name)}</div>
          <div className="worker-name">{worker.full_name}</div>
        </div>
      )}

      {errorMsg
        ? <div className="error-card">{errorMsg}</div>
        : <p className="screen-subtitle">Enter your 4-digit PIN</p>
      }

      <PinPad onComplete={onComplete} disabled={locked} />

      <button className="btn btn-ghost" onClick={onBack}>
        Cancel
      </button>
    </div>
  );
}
