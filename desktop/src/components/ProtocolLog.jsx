import { useEffect, useRef } from 'react'

const ProtocolLog = ({ events }) => {
  const logEndRef = useRef(null)

  useEffect(() => {
    // Auto-scroll to bottom on new event
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const formatTime = (ts) => {
    const d = new Date(ts * 1000)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0').substring(0, 2)}`
  }

  const formatDetail = (event) => {
    // Exclude basic keys from detail string
    const skipKeys = ['type', 'timestamp', 'layer']
    const details = Object.entries(event)
      .filter(([k]) => !skipKeys.includes(k))
      .map(([k, v]) => {
        if (typeof v === 'object') {
          return `${k}: {...}`
        }
        return `${k}: ${v}`
      })
      .join(' | ')
      
    return details
  }

  return (
    <div className="log-container">
      {events.map((evt, i) => (
        <div key={i} className="log-entry" data-layer={evt.layer}>
          <span className="log-time">{formatTime(evt.timestamp)}</span>
          <span className="log-type">{evt.type}</span>
          <span className="log-detail" title={formatDetail(evt)}>
            {formatDetail(evt)}
          </span>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  )
}

export default ProtocolLog
