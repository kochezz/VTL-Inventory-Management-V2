import React, { useState, useEffect } from 'react';

const Hero = () => {
  const [current, setCurrent] = useState(0);
  const slidesCount = 3;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slidesCount);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="home">
      <div className="hero-track">
        
        <div className={`hero-slide ${current === 0 ? 'on' : ''}`}>
          <img src="/images/carousel_1.png" alt="Pure Natural Spring Water" className="hero-slide-bg" />
          <div className="hbg hbg-1" style={{display: 'none'}}></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <span className="eyebrow">Welcome to Vilagio</span>
            <h1 className="hero-title">Pure <strong>Natural</strong><br/>Spring Water.</h1>
            <p className="hero-sub">Sourced from deep underground aquifers in Zambia. Purified through Reverse Osmosis &amp; Ozonation. Every drop a promise of purity.</p>
            <div className="hero-btns">
              <a href="#story" className="btn btn-gold">Our Story <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
              <a href="#products" className="btn btn-outline">Our Range</a>
            </div>
          </div>
        </div>

        <div className={`hero-slide ${current === 1 ? 'on' : ''}`}>
          <img src="/images/carousel_2.png" alt="Freshness in Every Size" className="hero-slide-bg" />
          <div className="hbg hbg-2" style={{display: 'none'}}></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <span className="eyebrow">Our Range</span>
            <h1 className="hero-title"><strong>Freshness</strong><br/>In Every Size.</h1>
            <p className="hero-sub">From 500ml on-the-go to 5-gallon home &amp; office. freshDRIP has you covered — anytime, anywhere in Zambia.</p>
            <div className="hero-btns">
              <a href="#products" className="btn btn-gold">Discover Products <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
            </div>
          </div>
        </div>

        <div className={`hero-slide ${current === 2 ? 'on' : ''}`}>
          <img src="/images/carousel_3.jpg" alt="Build the Future of Water" className="hero-slide-bg" />
          <div className="hbg hbg-3" style={{display: 'none'}}></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <span className="eyebrow">Career Opportunity</span>
            <h1 className="hero-title">Build the<br/><strong>Future</strong> of Water.</h1>
            <p className="hero-sub">We are hiring in Chingola. Lead our bottling line and help shape Zambia's most exciting water brand.</p>
            <div className="hero-btns">
              <a href="#careers" className="btn btn-gold">View Openings <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
            </div>
          </div>
        </div>

      </div>

      <div className="hero-dots">
        <button className={`hero-dot ${current === 0 ? 'on' : ''}`} onClick={() => setCurrent(0)} aria-label="Slide 1"></button>
        <button className={`hero-dot ${current === 1 ? 'on' : ''}`} onClick={() => setCurrent(1)} aria-label="Slide 2"></button>
        <button className={`hero-dot ${current === 2 ? 'on' : ''}`} onClick={() => setCurrent(2)} aria-label="Slide 3"></button>
      </div>
      <div className="scroll-label" aria-hidden="true">Scroll</div>
    </section>
  );
};

export default Hero;