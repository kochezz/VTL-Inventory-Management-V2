import { useState } from 'react';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinPad({ onComplete, disabled = false }) {
  const [digits, setDigits] = useState('');

  const press = (key) => {
    if (disabled || key === '') return;
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1));
      return;
    }
    const next = digits + key;
    setDigits(next);
    if (next.length === 4) {
      setDigits('');
      onComplete(next);
    }
  };

  return (
    <div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`pin-dot${i < digits.length ? ' filled' : ''}`} />
        ))}
      </div>
      <div className="pinpad">
        {KEYS.map((key, i) => (
          <button
            key={i}
            className={`pinpad-btn${key === '' ? ' empty' : ''}${key === '⌫' ? ' back' : ''}`}
            onClick={() => press(key)}
            disabled={disabled && key !== ''}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
