import React from 'react';

const ZambiaPride = () => (
  <section className="zambia-section">
    <div className="container">
      <div className="zambia-grid">
        <div className="zambia-stack r">
          {/* Replaced Placeholders with Actual Images */}
          <img 
            src="/images/vic-falls.jpg" 
            alt="Copperbelt Community" 
            className="zimg-main" 
          />
          <img 
            src="/images/zed.jpg" 
            alt="Zambian Community" 
            className="zimg-accent" 
          />
        </div>
        <div className="zambia-text">
          <span className="eyebrow r">Proudly Zambian</span>
          <h2 className="heading r d1">Rooted in <em>Zambia.</em><br/><strong>Driven by</strong> Global Standards.</h2>
          <span className="rule r d2"></span>
          <p className="r d2">Vilagio Trading Limited is a proudly Zambian company headquartered in Chingola on the Copperbelt. We believe in local enterprise, local employment, and products that Zambians can be proud of.</p>
          <p className="r d3">Our water is produced under strict hygienic conditions, fully compliant with Zambia Bureau of Standards (ZABS) requirements, and tested and certified safe for drinking. Abena Kopala.</p>
          <div className="badges r d3">
            <span className="badge"><span className="dot dot-b"></span>ZABS Certified</span>
            <span className="badge"><span className="dot dot-g"></span>Proudly Zambian</span>
            <span className="badge"><span className="dot dot-a"></span>100% Recyclable</span>
          </div>
          <div className="reg-affiliations r d4">
            <div className="reg-lbl" style={{textAlign: 'center'}}>Regulatory Affiliations &amp; Certifications</div>
            <div className="reg-logos" style={{justifyContent: 'center'}}>
              <img src="/images/abena_kopala.png" alt="Abena Kopala" className="reg-logo-item" style={{height: '70px'}} />
              <img src="/images/ZABS_Certificate.png" alt="ZABS Certified" className="reg-logo-item" style={{height: '72px'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default ZambiaPride;