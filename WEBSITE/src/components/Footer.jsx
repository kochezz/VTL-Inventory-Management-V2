import React from 'react';

const Footer = () => (
  <footer id="contact">
    <div className="container">
      <div className="footer-body">
        <div>
          {/* Updated the logo image source below */}
          <img src="/images/vtl-logo-white.png" alt="Vilagio" className="footer-logo-img" />
          <div className="footer-tagline">Nothing Better</div>
          <p className="footer-about">Pure Natural Spring Water. Sourced deep, purified for perfection. Rooted in Zambia, driven by global standards.</p>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#story">Our Story</a></li>
            <li><a href="#products">Products</a></li>
            <li><a href="#careers">Careers</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Contact Us</h4>
          <div className="footer-address">
            <p>Vilagio Trading Limited</p>
            <p>Plot No. 28441, Gymkhana</p>
            <p>Kitwe Road, Chingola, Zambia</p>
            <br />
            <p><a href="mailto:info@vilagio.co.zm">info@vilagio.co.zm</a></p>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2025 Vilagio Trading Limited. All Rights Reserved.</p>
      </div>
    </div>
  </footer>
);

export default Footer;