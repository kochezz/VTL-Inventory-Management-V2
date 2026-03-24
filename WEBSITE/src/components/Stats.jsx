import React from 'react';

const stats = [
  { num: '100%', label: 'Recyclable Bottle' },
  { num: '<50', label: 'TDS mg/L' },
  { num: 'RO+O₃', label: 'Dual Purification' },
  { num: 'ZABS', label: 'Certified ZS 190:2010' }
];

const Stats = () => (
  <div className="stats-strip">
    <div className="container">
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className={`stat r v d${i}`}>
            <span className="stat-num">{s.num}</span>
            <span className="stat-lbl">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Stats;