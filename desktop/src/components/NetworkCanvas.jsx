import { useEffect, useRef } from 'react'

const NetworkCanvas = ({ peers, health, activeEdges }) => {
  const canvasRef = useRef(null)
  
  // Create a stable layout map so nodes don't jump around
  const layoutMap = useRef(new Map())
  const animationRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = canvas.width
    let height = canvas.height
    
    // Resize handler
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width
      canvas.height = height
    }
    
    window.addEventListener('resize', resize)
    resize()

    // ── Graph Layout Engine ──────────────────────────────────────
    const updateLayout = () => {
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) / 3

      // Center is always primary node
      if (health?.node_id) {
        layoutMap.current.set(health.node_id, {
          x: cx,
          y: cy,
          role: health.role,
          id: health.node_id,
          status: health.status
        })
      }

      // Distribute peers in a circle
      const peerCount = peers.length
      peers.forEach((peer, i) => {
        const angle = (i / peerCount) * Math.PI * 2 - Math.PI / 2
        
        // Add a little randomness so it doesn't look too perfect
        const r = radius + Math.sin(i * 10) * 10
        
        layoutMap.current.set(peer.node_id, {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          role: peer.role,
          id: peer.node_id,
          status: peer.status,
          latency: peer.latency_ms
        })
      })
    }

    // ── Render Loop ──────────────────────────────────────────────
    let particles = []
    
    const render = (time) => {
      ctx.clearRect(0, 0, width, height)
      updateLayout()

      const nodes = Array.from(layoutMap.current.values())
      const primaryNode = nodes.find(n => n.id === health?.node_id)

      if (!primaryNode) {
        animationRef.current = requestAnimationFrame(render)
        return
      }

      // 1. Draw Edges
      ctx.lineWidth = 1
      nodes.forEach(node => {
        if (node.id === primaryNode.id) return
        
        // Is this edge active?
        const isActive = activeEdges.some(e => e.id === node.id)
        
        if (node.status === 'dead') {
          ctx.strokeStyle = 'rgba(255, 51, 51, 0.2)' // Red dashed
          ctx.setLineDash([4, 4])
        } else if (isActive) {
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)' // Bright green
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)' // Dim white
          ctx.setLineDash([])
        }
        
        ctx.beginPath()
        ctx.moveTo(primaryNode.x, primaryNode.y)
        ctx.lineTo(node.x, node.y)
        ctx.stroke()
        ctx.setLineDash([]) // Reset
        
        // Draw latency label if active
        if (node.status !== 'dead' && node.latency) {
          const midX = (primaryNode.x + node.x) / 2
          const midY = (primaryNode.y + node.y) / 2
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
          ctx.font = '9px "JetBrains Mono", monospace'
          ctx.fillText(`${Math.round(node.latency)}ms`, midX + 5, midY)
        }
      })

      // 2. Manage and Draw Data Particles
      // Spawn new particles for active edges
      if (time % 5 === 0) { // Throttle spawn rate
        activeEdges.forEach(edge => {
          const targetNode = layoutMap.current.get(edge.id)
          if (targetNode) {
            // Direction: randomly from primary to node or node to primary
            const toPrimary = Math.random() > 0.5
            particles.push({
              start: toPrimary ? targetNode : primaryNode,
              end: toPrimary ? primaryNode : targetNode,
              progress: 0,
              speed: 0.02 + Math.random() * 0.02,
              color: 'rgba(0, 255, 136, 0.8)'
            })
          }
        })
      }

      // Update and draw particles
      particles = particles.filter(p => p.progress < 1)
      particles.forEach(p => {
        p.progress += p.speed
        const x = p.start.x + (p.end.x - p.start.x) * p.progress
        const y = p.start.y + (p.end.y - p.start.y) * p.progress
        
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      })

      // 3. Draw Nodes
      nodes.forEach(node => {
        // Node color
        let color = '#555555' // offline
        if (node.status === 'active' || node.status === 'ready') color = '#00ff88'
        else if (node.status === 'busy') color = '#ffaa00'
        else if (node.status === 'dead') color = '#ff3333'
        
        // Pulse animation for active nodes
        let pulseRadius = 0
        if (color === '#00ff88') {
          pulseRadius = 6 + Math.sin(time / 200) * 2
        }

        // Draw pulse
        if (pulseRadius > 0) {
          ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba')
          if (color.startsWith('#')) {
            // Hex to rgba is annoying in pure JS, just use a hardcoded glow
            ctx.fillStyle = color === '#00ff88' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 170, 0, 0.2)'
          }
          ctx.beginPath()
          ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // Draw core
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fill()

        // Draw label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.id, node.x, node.y + 16)
        
        // Draw role
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.font = '8px "JetBrains Mono", monospace'
        ctx.fillText(`[${node.role}]`, node.x, node.y + 26)
      })

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [peers, health, activeEdges])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        className="network-canvas"
      />
      {!health && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'var(--text-dim)',
          fontSize: '11px'
        }}>
          Waiting for network...
        </div>
      )}
    </div>
  )
}

export default NetworkCanvas
