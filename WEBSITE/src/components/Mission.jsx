import React from 'react';

const Mission = () => (
  <section className="mission">
    <div className="mission-bg-word" aria-hidden="true">DRIP</div>
    <div className="container mission-inner">
      <span className="eyebrow r">Our Mission</span>
      <h2 className="heading r d1">Zambia's Most<br/><em>Trusted</em> <strong>Water Brand.</strong></h2>
      <span className="rule rule-c r d2"></span>
      <p className="r d2">We are on a mission to become the Copperbelt's most loved, most sustainable bottled water brand — made for a cleaner Zambia, one recyclable bottle at a time. Abena Kopala.</p>
      <div className="r d3">
        <a href="#products" className="btn btn-white">
          Discover Our Range
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
  </section>
);

export default Mission;