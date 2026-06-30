import { useEffect } from 'react';

const AUTO_RETURN_MS = 3000;

function pad(n) { return String(n).padStart(2, '0'); }

export default function ConfirmScreen({ confirmation, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, AUTO_RETURN_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  if (!confirmation) return null;

  const { full_name, punch_type, punch_time, queued } = confirmation;
  const action  = punch_type === 'clock_in' ? 'CLOCKED IN' : 'CLOCKED OUT';
  const timeStr = `${pad(punch_time.getHours())}:${pad(punch_time.getMinutes())}`;

  return (
    <div className="screen">
      <div className="confirm-icon">{queued ? '📋' : '✓'}</div>
      <div className="confirm-action">{action}</div>
      <div className="confirm-time">{timeStr}</div>
      <div className="confirm-name">{full_name}</div>
      {queued && (
        <div className="confirm-queued">
          Saved offline — will sync automatically when connected
        </div>
      )}
    </div>
  );
}
