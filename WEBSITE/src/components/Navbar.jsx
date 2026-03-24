import React, { useState, useEffect } from 'react';

const Navbar = ({ isDark, toggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header id="nav" className={scrolled ? 'scrolled' : ''}>
      <div className="container nav-row">
        
        <a href="#home" className="nav-brand">
          <img src="/images/logo-vilagio.png" alt="Vilagio" className="logo-main" />
          <span className="nav-wordmark" style={{display: 'none'}}>Vila<span>gio</span></span>
        </a>

        <nav>
          <ul className={`nav-links ${menuOpen ? 'open' : ''}`} id="nav-links">
            <li className="nav-item"><a href="#home">Home</a></li>
            
            <li className="nav-item">
              <a href="#story">Our Story <svg className="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></a>
              <div className="mega-panel">
                <div className="mega-inner">
                  <div className="mega-links">
                    <div className="mega-link-group-label">Our Journey</div>
                    <a className="mega-link" href="#story"><strong>Our Story</strong><span>How freshDRIP was born in Chingola</span></a>
                    <a className="mega-link" href="#story"><strong>Our Mission</strong><span>Zambia's most trusted water brand</span></a>
                    <a className="mega-link" href="#story"><strong>Water Quality</strong><span>RO + Ozonation — dual purification</span></a>
                    <a className="mega-link" href="#contact"><strong>Sustainability</strong><span>100% recyclable. Made for a cleaner Zambia</span></a>
                  </div>
                  <div className="mega-previews">
                    <div className="mega-preview-card">
                      <img src="/images/prod-floor.png" alt="Production Floor" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">Production</div>
                    </div>
                    <div className="mega-preview-card">
                      <img src="/images/carousel_1.png" alt="Spring Water" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">Purity</div>
                    </div>
                    <div className="mega-preview-card">
                      <img src="/images/carousel_2.png" alt="Range" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">Range</div>
                    </div>
                  </div>
                </div>
              </div>
            </li>

            <li className="nav-item">
              <a href="#products">Products <svg className="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></a>
              <div className="mega-panel">
                <div className="mega-inner">
                  <div className="mega-links">
                    <div className="mega-link-group-label">freshDRIP Range</div>
                    <a className="mega-link" href="#products"><strong>500ml Premium</strong><span>Clear-label premium design for those who demand the best</span></a>
                    <a className="mega-link" href="#products"><strong>500ml Regular</strong><span>Everyday on-the-go hydration, crisp and clean</span></a>
                    <a className="mega-link" href="#products"><strong>750ml Regular</strong><span>More hydration — perfect for active lifestyles</span></a>
                    <a className="mega-link" href="#products"><strong>5 Gallon</strong><span>Home &amp; office cooler refill</span></a>
                  </div>
                  <div className="mega-previews">
                    <div className="mega-preview-card">
                      <img src="/images/PREMO_FreshDrip-500ml-Premium-Bottle.png" alt="500ml Premium" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">500ml Premium</div>
                    </div>
                    <div className="mega-preview-card">
                      <img src="/images/Mockup-500ml-Bottle-A1.png" alt="500ml Regular" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">500ml Regular</div>
                    </div>
                    <div className="mega-preview-card">
                      <img src="/images/5-Gallon-Bottle-Mockup-A1.png" alt="5 Gallon" />
                      <div className="skeleton-shimmer"></div>
                      <div className="preview-label">5 Gallon</div>
                    </div>
                  </div>
                </div>
              </div>
            </li>

            <li className="nav-item"><a href="#careers">Careers</a></li>
            <li className="nav-item"><a href="#contact">Contact</a></li>
          </ul>
        </nav>

        <div className="nav-actions">
          <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
            {isDark ? '🌙' : '☀️'}
          </button>
          
          <a href="https://app.vilag.io" target="_blank" rel="noreferrer" className="btn btn-blue" style={{padding: '10px 16px', fontSize: '.72rem'}}>
            <img src="/images/VTL-erp.png" alt="ERP Portal" style={{width: '14px', height: '14px', filter: 'brightness(0) invert(1)'}} onError={(e) => e.target.style.display='none'} />
            VTL-ERP
          </a>

          <a href="mailto:careers@vilagio.co.zm" className="btn btn-gold" style={{padding: '10px 22px', fontSize: '.72rem'}}>Apply Now</a>
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;