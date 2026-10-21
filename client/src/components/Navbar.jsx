import React from 'react';
import { Activity, Layers } from 'lucide-react';

export default function Navbar({ title }) {
  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div className="topbar-badge" style={{ backgroundColor: '#ecfdf5', color: '#065f46' }}>
          <Activity size={14} />
          <span>MongoDB: Active (smart_hospital)</span>
        </div>
        <div className="topbar-badge">
          <Layers size={14} />
          <span>Neo4j Graph: Active</span>
        </div>
      </div>
    </header>
  );
}
