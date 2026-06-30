import { useState, useEffect } from 'react';

function pad(n) { return String(n).padStart(2, '0'); }

export default function IdleScreen({ onPunchType }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="screen">
      <img src="/logo-white.png" alt="Vilagio" className="idle-logo" />
      <div className="idle-time">{timeStr}</div>
      <div className="idle-date">{dateStr}</div>

      <div style={{ height: 24 }} />

      <div className="idle-punch-btns">
        <button className="btn btn-green" onClick={() => onPunchType('clock_in')}>
          CLOCK IN
        </button>
        <button className="btn btn-red" onClick={() => onPunchType('clock_out')}>
          CLOCK OUT
        </button>
      </div>
    </div>
  );
}
