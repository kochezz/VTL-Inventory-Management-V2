import React from 'react';

const productList = [
  {
    name: '500ml Premium',
    badge: 'Premium',
    img: '/images/PREMO_FreshDrip-500ml-Premium-Bottle.png',
    desc: 'Clear-label premium design. Pure natural spring water crafted for those who demand the best.',
    vol: '500 ml · 16.9 fl oz'
  },
  {
    name: '500ml Regular',
    img: '/images/Mockup-500ml-Bottle-A1.png',
    desc: 'Our everyday on-the-go bottle. Crisp, clean and refreshing — anytime, anywhere.',
    vol: '500 ml · 16.9 fl oz'
  },
  {
    name: '750ml Regular',
    img: '/images/Mockup-750ml-Bottle-А1.png',
    desc: 'More hydration per bottle. Perfect for active lifestyles, sport and dining occasions.',
    vol: '750 ml · 25.4 fl oz'
  },
  {
    name: '5 Gallon',
    img: '/images/5-Gallon-Bottle-Mockup-A1.png',
    desc: 'Home and office water cooler refill. Large-capacity pure spring water for your workspace or household.',
    vol: '5 gal · 18.9 L'
  }
];

const Products = () => (
  <section id="products" className="products-section">
    <div className="container">
      <div className="products-hd">
        <span className="eyebrow">Our Products</span>
        <h2 className="heading">The freshDRIP Range</h2>
        <span className="rule rule-c"></span>
        <p>Pure Natural Spring Water in a variety of sizes — from everyday on-the-go bottles to large home and office solutions.</p>
      </div>
      <div className="products-grid">
        {productList.map((p, i) => (
          <div key={i} className="product-card">
            <div className="product-img">
              {p.badge && <span className="product-badge">{p.badge}</span>}
              <img src={p.img} alt={p.name} />
            </div>
            <div className="product-info">
              <span className="eyebrow">freshDRIP™</span>
              <h3 className="product-name">{p.name}</h3>
              <p className="product-desc">{p.desc}</p>
              <span className="product-vol">{p.vol}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Products;