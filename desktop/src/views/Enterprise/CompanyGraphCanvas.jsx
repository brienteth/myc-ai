import React, { useRef, useEffect, useCallback } from 'react';

/**
 * CompanyGraphCanvas — Interactive Canvas-based Enterprise Digital Twin Graph
 * Renders nodes with health color states (green/yellow/red), animated connections,
 * hover tooltips, and click navigation.
 */

const DEPARTMENTS = [
  { id: 'company', label: 'COMPANY', x: 0.5, y: 0.12, r: 28, color: '#238636', system: 'Myca OS' },
  { id: 'finance', label: 'Finance', x: 0.22, y: 0.35, r: 22, color: '#3fb950', system: 'Oracle Driver', health: 'healthy' },
  { id: 'hr', label: 'HR', x: 0.78, y: 0.35, r: 20, color: '#3fb950', system: 'Workday Driver', health: 'healthy' },
  { id: 'manufacturing', label: 'Manufacturing', x: 0.12, y: 0.6, r: 22, color: '#3fb950', system: 'SAP Driver', health: 'healthy' },
  { id: 'procurement', label: 'Procurement', x: 0.36, y: 0.6, r: 20, color: '#d29922', system: 'SAP Driver', health: 'warning' },
  { id: 'logistics', label: 'Logistics', x: 0.64, y: 0.6, r: 20, color: '#3fb950', system: 'NetSuite Driver', health: 'healthy' },
  { id: 'crm', label: 'CRM', x: 0.88, y: 0.6, r: 22, color: '#3fb950', system: 'Salesforce Driver', health: 'healthy' },
  { id: 'sales', label: 'Sales', x: 0.28, y: 0.85, r: 20, color: '#3fb950', system: 'Salesforce Driver', health: 'healthy' },
  { id: 'marketing', label: 'Marketing', x: 0.72, y: 0.85, r: 20, color: '#d29922', system: 'HubSpot Driver', health: 'warning' }
];

const EDGES = [
  ['company', 'finance'], ['company', 'hr'], ['company', 'manufacturing'],
  ['company', 'procurement'], ['company', 'logistics'], ['company', 'crm'],
  ['finance', 'sales'], ['crm', 'sales'], ['crm', 'marketing'],
  ['procurement', 'manufacturing'], ['logistics', 'manufacturing']
];

const CompanyGraphCanvas = ({ onNodeClick, graphData }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const hoveredRef = useRef(null);
  const pulseRef = useRef(0);

  const getNodePositions = useCallback((w, h) => {
    return DEPARTMENTS.map(d => ({
      ...d,
      px: d.x * w,
      py: d.y * h
    }));
  }, []);

  const draw = useCallback((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const nodes = getNodePositions(w, h);
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    // Draw edges
    EDGES.forEach(([from, to]) => {
      const a = nodeMap[from];
      const b = nodeMap[to];
      if (!a || !b) return;

      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.strokeStyle = 'rgba(63, 185, 80, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Animated pulse particle along edge
      const progress = ((t * 0.0004 + EDGES.indexOf(arguments[0]) * 0.15) % 1);
      const particleIdx = EDGES.findIndex(e => e[0] === from && e[1] === to);
      const p = ((t * 0.0003 + particleIdx * 0.12) % 1);
      const px = a.px + (b.px - a.px) * p;
      const py = a.py + (b.py - a.py) * p;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(63, 185, 80, 0.6)';
      ctx.fill();
    });

    // Draw nodes
    nodes.forEach(node => {
      const isHovered = hoveredRef.current === node.id;
      const pulseSize = isHovered ? 4 : Math.sin(t * 0.002 + node.px) * 1.5;
      const r = node.r + pulseSize;

      // Glow
      ctx.beginPath();
      ctx.arc(node.px, node.py, r + 8, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(node.px, node.py, r, node.px, node.py, r + 12);
      glow.addColorStop(0, node.color + '30');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fill();

      // Node body
      ctx.beginPath();
      ctx.arc(node.px, node.py, r, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? node.color + 'cc' : '#161b22';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e6edf3';
      ctx.font = node.id === 'company' ? 'bold 11px DM Sans' : '10px DM Sans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.px, node.py - 2);

      // System sub-label
      if (node.system && node.id !== 'company') {
        ctx.fillStyle = '#8b949e';
        ctx.font = '8px DM Mono';
        ctx.fillText(node.system, node.px, node.py + 10);
      }
    });
  }, [getNodePositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);

    const animate = (t) => {
      const rect = canvas.parentElement.getBoundingClientRect();
      draw(ctx, rect.width, rect.height, t);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    // Mouse hover detection
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const nodes = getNodePositions(rect.width, rect.height);
      let found = null;
      for (const n of nodes) {
        const dx = mx - n.px;
        const dy = my - n.py;
        if (Math.sqrt(dx * dx + dy * dy) < n.r + 5) {
          found = n.id;
          break;
        }
      }
      hoveredRef.current = found;
      canvas.style.cursor = found ? 'pointer' : 'default';
    };

    const handleClick = (e) => {
      if (hoveredRef.current && onNodeClick) {
        onNodeClick(hoveredRef.current);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [draw, getNodePositions, onNodeClick]);

  return (
    <div className="company-graph-container">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default CompanyGraphCanvas;
