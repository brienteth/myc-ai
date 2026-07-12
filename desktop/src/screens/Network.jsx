const Network = ({ nodes, isVisible, onClose }) => {
  return (
    <>
      <div 
        style={{
          ...styles.backdrop,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        onClick={onClose}
      />
      <div style={{
        ...styles.sheet,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)'
      }}>
        <div style={styles.handle} />
        
        <div style={styles.title}>Network Devices</div>
        
        <div style={styles.nodesList}>
          {nodes.map((node, idx) => {
            let badgeStyle = { ...styles.badge };
            if (node.role === 'this device') {
              badgeStyle.background = 'var(--accent)';
              badgeStyle.color = '#000';
            } else if (node.role === 'inference') {
              badgeStyle.background = '#4488ff20';
              badgeStyle.border = '1px solid #4488ff40';
              badgeStyle.color = '#4488ff';
            } else if (node.role === 'storage') {
              badgeStyle.background = '#b844ff20';
              badgeStyle.border = '1px solid #b844ff40';
              badgeStyle.color = '#b844ff';
            }

            let dotColor = '#00ff88'; // green
            if (node.status === 'dead') dotColor = '#ff3333';
            else if (node.status === 'busy') dotColor = '#ffaa00';

            return (
              <div key={idx} style={styles.nodeCard}>
                <div style={styles.left}>
                  <div style={{ ...styles.dot, background: dotColor }} />
                </div>
                <div style={styles.center}>
                  <div style={styles.nodeName}>{node.name}</div>
                  <div style={styles.nodeId}>{node.id}</div>
                </div>
                <div style={styles.right}>
                  <div style={badgeStyle}>{node.role}</div>
                  {node.latency > 0 && <div style={styles.latency}>{Math.round(node.latency)}ms</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.divider} />

        <div>
          <h3 style={styles.howTitle}>How does it work?</h3>
          <div style={styles.step}>
            <div style={styles.numberCircle}>1</div>
            <div style={styles.stepTextWrapper}>
              <div style={styles.stepTitle}>Finds neighbors</div>
              <div style={styles.stepSubtitle}>Discover devices on the same network using mDNS</div>
            </div>
          </div>
          <div style={styles.step}>
            <div style={styles.numberCircle}>2</div>
            <div style={styles.stepTextWrapper}>
              <div style={styles.stepTitle}>Connects directly</div>
              <div style={styles.stepSubtitle}>P2P connection without servers via WebRTC</div>
            </div>
          </div>
          <div style={styles.step}>
            <div style={styles.numberCircle}>3</div>
            <div style={styles.stepTextWrapper}>
              <div style={styles.stepTitle}>Combines power</div>
              <div style={styles.stepSubtitle}>Shares prompt load, combines response</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: '#00000080',
    zIndex: 100,
    transition: 'opacity 0.25s ease-out',
  },
  sheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--surface)',
    borderRadius: '20px 20px 0 0',
    borderTop: '1px solid var(--border)',
    padding: '0 16px 32px',
    maxHeight: '70vh',
    overflowY: 'auto',
    zIndex: 101,
    transition: 'transform 0.25s ease-out',
  },
  handle: {
    width: '36px',
    height: '4px',
    background: 'var(--border)',
    borderRadius: '2px',
    margin: '12px auto 20px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--muted)',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  nodesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  nodeCard: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  left: {
    flexShrink: 0,
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  nodeName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nodeId: {
    fontSize: '11px',
    color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
    flexShrink: 0,
  },
  badge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600,
  },
  latency: {
    fontSize: '11px',
    color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '24px 0',
  },
  howTitle: {
    fontSize: '13px',
    fontWeight: 600,
    margin: '0 0 14px 0',
    color: 'var(--text)',
  },
  step: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px',
  },
  numberCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontWeight: 600,
  },
  stepTextWrapper: {
    flex: 1,
  },
  stepTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  stepSubtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '2px',
  }
};

export default Network;
