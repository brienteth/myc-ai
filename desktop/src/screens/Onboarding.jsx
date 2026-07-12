import { useEffect, useRef } from 'react';

const Onboarding = ({ onStart }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: 3,
      isPulsing: false,
      pulseTime: 0
    }));

    let animationId;
    let lastTime = performance.now();

    const render = (time) => {
      const dt = time - lastTime;
      lastTime = time;
      
      ctx.clearRect(0, 0, width, height);
      
      // Every roughly 3 seconds, pulse 2-3 dots
      if (Math.random() < 0.005) {
        const count = 2 + Math.floor(Math.random() * 2);
        for(let i=0; i<count; i++) {
          const idx = Math.floor(Math.random() * particles.length);
          particles[idx].isPulsing = true;
          particles[idx].pulseTime = 0;
        }
      }
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        
        let currentRadius = p.radius;
        if (p.isPulsing) {
          p.pulseTime += dt;
          if (p.pulseTime < 300) {
            currentRadius = 3 + (p.pulseTime / 300) * 4; // up to 7
          } else if (p.pulseTime < 600) {
            currentRadius = 7 - ((p.pulseTime - 300) / 300) * 4; // down to 3
          } else {
            p.isPulsing = false;
            p.pulseTime = 0;
          }
        }

        ctx.fillStyle = '#00ff8860';
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const baseOpacity = (1 - dist / 120) * 0.3;
            const isBright = particles[i].isPulsing || particles[j].isPulsing;
            ctx.strokeStyle = `rgba(0, 255, 136, ${isBright ? Math.max(baseOpacity, 0.7) : baseOpacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    // Pause animation when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        lastTime = performance.now();
        animationId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={styles.content}>
        <div style={styles.label}>EARLY ACCESS</div>
        <h1 style={styles.headline}>
          Your AI.<br/>
          <span style={{ color: 'var(--accent)' }}>Only yours.</span>
        </h1>
        <p style={styles.bodyText}>
          Nothing leaves your device. Peer devices pool their computation. Online or offline.
        </p>
        <button style={styles.button} onClick={onStart}>
          Start
        </button>
        <div style={styles.footerText}>
          No accounts. No sign-ups. Free forever.
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    zIndex: 0,
  },
  content: {
    position: 'absolute',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  label: {
    fontSize: '11px',
    letterSpacing: '3px',
    color: 'var(--accent)',
    marginBottom: '16px',
    fontWeight: 600,
  },
  headline: {
    fontSize: 'clamp(28px, 6vw, 48px)',
    fontWeight: 600,
    lineHeight: 1.15,
    margin: '0 0 24px 0',
  },
  bodyText: {
    fontSize: '15px',
    color: 'var(--muted)',
    lineHeight: 1.6,
    maxWidth: '340px',
    margin: '0 0 36px 0',
  },
  button: {
    padding: '14px 40px',
    background: 'var(--accent)',
    color: '#000',
    fontWeight: 600,
    fontSize: '15px',
    borderRadius: '100px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: '16px',
  },
  footerText: {
    fontSize: '12px',
    color: 'var(--muted)',
  }
};

export default Onboarding;
