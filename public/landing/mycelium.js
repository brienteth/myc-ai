export function MyceliumCanvas(canvasEl, options = {}) {
  const {
    nodeCount   = 45,
    nodeColor   = '#2E6B45',
    threadColor = '#2E6B45',
    bgColor     = 'transparent',
    speed       = 0.18,
    connectDist = 130,
    pulseEvery  = 2800,
    organic     = true,
  } = options;

  const ctx = canvasEl.getContext('2d');
  let W, H, nodes = [], anim;

  function resize() {
    W = canvasEl.width  = canvasEl.offsetWidth;
    H = canvasEl.height = canvasEl.offsetHeight;
  }

  function makeNode() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r:  Math.random() * 1.8 + 1.2,
      pulse:   0,    // 0–1 glow amount
      pulsing: false,
      // organic: slight wobble offset
      wx: Math.random() * Math.PI * 2,
      wy: Math.random() * Math.PI * 2,
      wSpeed: (Math.random() * 0.004 + 0.002),
    };
  }

  function init() {
    resize();
    nodes = Array.from({ length: nodeCount }, makeNode);
  }

  function activatePulse() {
    const count = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < count; i++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      n.pulsing = true;
      setTimeout(() => { n.pulsing = false; }, 1400);
    }
  }

  function drawThread(ax, ay, bx, by, alpha) {
    // Organic: bezier curve, not straight line
    const mx = (ax + bx) / 2 + (Math.random() - 0.5) * 12;
    const my = (ay + by) / 2 + (Math.random() - 0.5) * 12;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    if (organic) {
      ctx.quadraticCurveTo(mx, my, bx, by);
    } else {
      ctx.lineTo(bx, by);
    }
    // Using --f-spore/thread color: rgb(46, 107, 69)
    ctx.strokeStyle = `rgba(46, 107, 69, ${alpha})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // Update positions with organic wobble
    nodes.forEach(n => {
      n.wx += n.wSpeed;
      n.wy += n.wSpeed * 1.3;
      n.x += n.vx + Math.sin(n.wx) * 0.08;
      n.y += n.vy + Math.cos(n.wy) * 0.08;

      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;

      if (n.pulsing) n.pulse = Math.min(n.pulse + 0.06, 1);
      else           n.pulse = Math.max(n.pulse - 0.03, 0);
    });

    // Draw threads between nearby nodes
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < connectDist) {
          const bothPulsing = a.pulse > 0.3 && b.pulse > 0.3;
          const baseAlpha   = (1 - dist / connectDist) * 0.12;
          const alpha       = bothPulsing
            ? baseAlpha + 0.25
            : baseAlpha;
          drawThread(a.x, a.y, b.x, b.y, alpha);
        }
      });
    });

    // Draw nodes
    nodes.forEach(n => {
      const r = n.r + n.pulse * 2.5;

      // Outer glow ring when pulsing
      if (n.pulse > 0.1) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46, 107, 69, ${n.pulse * 0.12})`;
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.pulse > 0
        ? `rgba(46, 107, 69, ${0.5 + n.pulse * 0.5})`
        : 'rgba(46, 107, 69, 0.45)';
      ctx.fill();
    });

    anim = requestAnimationFrame(draw);
  }

  init();
  draw();
  let interval = setInterval(activatePulse, pulseEvery);
  
  const handleResize = () => resize();
  window.addEventListener('resize', handleResize);

  return { stop: () => {
    cancelAnimationFrame(anim);
    clearInterval(interval);
    window.removeEventListener('resize', handleResize);
  }};
}
