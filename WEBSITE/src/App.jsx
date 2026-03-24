import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Story from './components/Story';
import Mission from './components/Mission';
import Products from './components/Products';
import FeaturePanels from './components/FeaturePanels';
import ZambiaPride from './components/ZambiaPride';
import Careers from './components/Careers';
import Footer from './components/Footer';
import './styles/global.css';

function App() {
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('v');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.r').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar isDark={isDark} toggleTheme={() => setIsDark(!isDark)} />
      <Hero />
      <Stats />
      <Story />
      <Mission />
      <Products />
      <FeaturePanels />
      <ZambiaPride />
      <Careers />
      <Footer />
    </>
  );
}

export default App;