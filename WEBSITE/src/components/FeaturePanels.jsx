import React from 'react';

const FeaturePanels = () => (
  <div className="feature-strip">
    <div className="feature-panel">
      <div className="fp-ph fp-ph-a"></div>
      <div className="fp-overlay"></div>
      <div className="fp-content">
        <span className="eyebrow">Sourced Locally</span>
        <h3>Deep Underground.<br/>Naturally Pure.</h3>
        <a href="#story" className="btn btn-outline" style={{fontSize: '.72rem', padding: '11px 22px'}}>
          Learn More
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
    <div className="feature-panel">
      <div className="fp-ph fp-ph-b"></div>
      <div className="fp-overlay"></div>
      <div className="fp-content">
        <span className="eyebrow">Sustainability</span>
        <h3>100% Recyclable.<br/>Made for a Cleaner Zambia.</h3>
        <a href="#story" className="btn btn-outline" style={{fontSize: '.72rem', padding: '11px 22px'}}>
          Our Commitment
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
  </div>
);

export default FeaturePanels;