import React, { useState } from 'react';
import { Bot, ArrowRight } from 'lucide-react';
import './WorkflowStudio.css';

const WorkflowAIAssist = ({ onGenerate }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="workflow-ai-assist">
      <div className="assist-header">
        <Bot size={16} color="var(--f-moss)" />
        <span style={{fontWeight: 600}}>AI Assist</span>
      </div>
      <form className="assist-input-form" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Describe what you want..." 
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
        <button type="submit" className="icon-btn"><ArrowRight size={16}/></button>
      </form>
    </div>
  );
};

export default WorkflowAIAssist;
