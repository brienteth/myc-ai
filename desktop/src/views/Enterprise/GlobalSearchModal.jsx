import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

/**
 * GlobalSearchModal (⌘K)
 * Searches Invoices, Customers, Workflows, Drivers, Employees, Policies, Approvals, Secrets.
 */
const TYPE_CLASS_MAP = {
  'Invoice': 'srt-invoice',
  'Customer': 'srt-customer',
  'Workflow': 'srt-workflow',
  'Driver': 'srt-driver',
  'Employee': 'srt-employee',
  'Policy': 'srt-policy',
  'Approval': 'srt-approval',
  'Secret': 'srt-secret'
};

const GlobalSearchModal = ({ isOpen, onClose, onNavigateTab }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      // Load default results
      fetch('http://127.0.0.1:8420/enterprise/dashboard/search?q=')
        .then(r => r.json())
        .then(d => setResults(d.results || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSearch = useCallback((val) => {
    setQuery(val);
    fetch(`http://127.0.0.1:8420/enterprise/dashboard/search?q=${encodeURIComponent(val)}`)
      .then(r => r.json())
      .then(d => setResults(d.results || []))
      .catch(() => setResults([]));
  }, []);

  const handleResultClick = useCallback((item) => {
    if (item.target_tab && onNavigateTab) {
      onNavigateTab(item.target_tab);
    }
    onClose();
  }, [onNavigateTab, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-box" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <Search size={18} color="#8b949e" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search company... Invoices, Customers, Workflows, Drivers..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div className="global-search-results">
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#484f58', fontSize: 13 }}>
              No results found for "{query}"
            </div>
          ) : (
            results.map((item, idx) => (
              <div key={idx} className="search-result-item" onClick={() => handleResultClick(item)}>
                <span className={`search-result-type ${TYPE_CLASS_MAP[item.type] || ''}`}>
                  {item.type}
                </span>
                <div className="search-result-text">
                  <div className="srt-title">{item.title}</div>
                  <div className="srt-sub">{item.subtitle}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
