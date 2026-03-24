import React from 'react';

const Story = () => (
  <section id="story" className="story-section">
    <div className="container">
      <div className="story-grid">
        <div className="story-text">
          <span className="eyebrow r">Our Story</span>
          <h2 className="heading r d1">Quality You<br/><strong>Can Trust.</strong></h2>
          <span className="rule r d2"></span>
          <p className="r d2">At Vilagio, our journey began with a simple belief — that pure water should be crafted with the same care, dedication, and precision as any premium product. Sourced from deep underground aquifers and purified through a rigorous Reverse Osmosis (RO) and Ozonation process, our water undergoes one of the most advanced treatment standards to ensure unmatched purity, freshness, and safety.</p>
          <p className="r d3">From source to bottle, we combine cutting-edge technology with a passion for quality to deliver water you can trust. Every bottle of freshDRIP reflects our commitment to excellence, sustainability, and the well-being of our community. Rooted in Zambia and driven by global standards, we are dedicated to producing water that is clean, refreshing, and crafted for those who value purity in every drop.</p>
          <div className="specs-row">
            <div className="spec-card r d1"><span className="spec-lbl">pH Balance</span><span className="spec-val">6.5 – 8.5</span></div>
            <div className="spec-card r d2"><span class="spec-lbl">TDS</span><span className="spec-val">&lt; 50 mg/L</span></div>
            <div className="spec-card r d3"><span class="spec-lbl">Calcium Ca²⁺</span><span className="spec-val">5–15 mg/L</span></div>
            <div className="spec-card r d4"><span class="spec-lbl">Certification</span><span className="spec-val">ZABS ZS 190:2010</span></div>
          </div>
        </div>
        <div className="story-img-frame r d2">
          <img src="/images/prod-floor.png" alt="Vilagio Production Floor" style={{aspectRatio: '1/1', height: 'auto'}} />
        </div>
      </div>
    </div>
  </section>
);

export default Story;