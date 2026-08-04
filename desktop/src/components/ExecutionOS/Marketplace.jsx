import React, { useState, useEffect } from 'react';
import { Download, Star, Users } from 'lucide-react';

const Marketplace = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/automation/marketplace')
      .then(res => res.json())
      .then(data => setItems(data.items || []))
      .catch(err => console.error("Failed to load marketplace items:", err));
  }, []);

  return (
    <>
      <div className="auto-header">
        <h1 className="f-serif-italic">Marketplace</h1>
        <p>Discover and install new Skills, Workflows, and Agents</p>
      </div>

      <div className="auto-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {items.map(item => (
          <div key={item.id} className="auto-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{item.name}</h4>
                <div style={{ fontSize: 12, color: 'var(--f-soil)' }}>by {item.author}</div>
              </div>
              <span className="node-badge" style={{ background: 'var(--f-linen)' }}>{item.type}</span>
            </div>
            
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--f-earth)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} color="#ffaa00" /> {item.rating}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {item.installs}</div>
            </div>
            
            <button className="primary-btn" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', gap: 6, padding: '8px' }}>
              <Download size={14} /> Install
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default Marketplace;
