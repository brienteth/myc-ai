import React, { useState, useEffect } from 'react';
import { BookOpen, Bookmark, Link2, Highlighter, Share2, Bot } from 'lucide-react';
import '../../views/Library.css';

const ResearchWorkspace = ({ document }) => {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (document) {
      setIsLoading(true);
      const prompt = `Please provide a summary abstract and 2 key highlights for this document: ${document.name || document.filename}`;
      
      fetch('http://127.0.0.1:8420/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false })
      })
      .then(res => res.json())
      .then(data => {
        setAnalysis(data.response || data.error);
        setIsLoading(false);
      })
      .catch(err => {
        setAnalysis("Failed to connect to local AI model.");
        setIsLoading(false);
      });
    }
  }, [document]);

  if (!document) {
    return (
      <div className="research-workspace" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', color: 'var(--f-stone)'}}>
          <BookOpen size={48} style={{margin: '0 auto 16px', opacity: 0.5}} />
          <h3>No Document Selected</h3>
          <p>Select a document from your library to start researching.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="research-workspace">
      <div className="research-header">
        <div className="r-title">
          <BookOpen size={20} color="var(--f-moss)" />
          <h2>{document.name || document.filename}</h2>
        </div>
        <div className="r-actions">
          <button className="icon-btn"><Bookmark size={16} /></button>
          <button className="icon-btn"><Share2 size={16} /></button>
        </div>
      </div>

      <div className="research-body">
        <div className="research-reader">
          <div className="r-abstract">
            <strong><Bot size={14} style={{display: 'inline', marginRight: 4}}/> AI Abstract:</strong> 
            {isLoading ? " Analyzing document..." : ` ${analysis || 'Ready to analyze.'}`}
          </div>
          
          <div className="mock-pdf-pages">
            <div className="mock-page">
              <p style={{color: 'var(--f-earth)'}}>[Document Viewer - Rendered locally via semantic cache]</p>
              <br/>
              <p>Type: {document.type}</p>
              <p>Size: {document.size || 'Unknown'}</p>
              <p>Indexed: {new Date(document.created_at * 1000).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="research-sidebar">
          <h3><Link2 size={14} /> Similar Documents</h3>
          <div className="citation-card">
            <p className="cit-title">Semantic Search</p>
            <p className="cit-author">Currently unavailable</p>
          </div>
          
          <h3 style={{marginTop: 24}}><Highlighter size={14} /> Highlights</h3>
          <div className="highlight-card">
            <p>{isLoading ? "Extracting highlights..." : "Review the AI abstract above for key highlights."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchWorkspace;
