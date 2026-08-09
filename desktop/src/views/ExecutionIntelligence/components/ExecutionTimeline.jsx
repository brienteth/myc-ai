import React from 'react';
import './ExecutionTimeline.css';

const ExecutionTimeline = () => {
  const events = [
    { time: '18:01:22', text: 'Intent parsed', type: 'info' },
    { time: '18:01:23', text: 'Graph compiled', type: 'info' },
    { time: '18:01:24', text: 'Agent A started', type: 'running' },
    { time: '18:01:24', text: 'Agent B started', type: 'running' },
    { time: '18:01:24', text: 'Agent C started', type: 'running' },
    { time: '18:01:31', text: 'Agent B completed', type: 'success' },
    { time: '18:01:36', text: 'Agent A completed', type: 'success' },
    { time: '18:01:38', text: 'Agent C completed', type: 'success' },
    { time: '18:01:39', text: 'Verification started', type: 'running' },
    { time: '18:01:43', text: 'Finding #3 rejected', type: 'error' },
    { time: '18:01:44', text: 'Repair started', type: 'warning' },
  ];

  return (
    <div className="execution-timeline">
      <div className="et-header">
        <h3>TIMELINE</h3>
      </div>
      <div className="et-content">
        <ul className="et-list">
          {events.map((ev, i) => (
            <li key={i} className={`et-item ${ev.type}`}>
              <span className="et-time">{ev.time}</span>
              <span className="et-text">{ev.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ExecutionTimeline;
