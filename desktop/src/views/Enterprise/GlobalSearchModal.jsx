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

const ALL_MOCK_SEARCH_ITEMS = [
  { type: 'Invoice', title: 'Invoice #INV-9041 ($42,000)', subtitle: 'SAP S/4HANA · Acmed Corp · Pending Approval', target_tab: 'approvals' },
  { type: 'Invoice', title: 'Invoice #INV-8812 ($145,000)', subtitle: 'SAP S/4HANA · High Value Payout', target_tab: 'approvals' },
  { type: 'Customer', title: 'Acme Global Manufacturing', subtitle: 'Salesforce CRM · Account ID #CUST-881', target_tab: 'ontology' },
  { type: 'Customer', title: 'Stark Industries Logistics', subtitle: 'Salesforce CRM · Account ID #CUST-902', target_tab: 'ontology' },
  { type: 'Workflow', title: 'End-of-Month SAP Ledger Reconciliation', subtitle: 'Execution OS · 84% Complete · Running', target_tab: 'execution' },
  { type: 'Workflow', title: 'GDPR PII Scrub & Anonymization Audit', subtitle: 'Execution OS · Active · 45% Complete', target_tab: 'execution' },
  { type: 'Driver', title: 'SAP S/4HANA Enterprise Driver', subtitle: 'Driver OS · 1,420 ops/sec · Active', target_tab: 'drivers' },
  { type: 'Driver', title: 'Salesforce CRM Connector Driver', subtitle: 'Driver OS · 890 ops/sec · Active', target_tab: 'drivers' },
  { type: 'Employee', title: 'Dr. Elizabeth Vance (CFO)', subtitle: 'Workday HCM · Financial Signatory Passkey', target_tab: 'approvals' },
  { type: 'Policy', title: 'Single Transaction Payout Cap ($50,000)', subtitle: 'Policy Engine · Active · SOX Enforcement', target_tab: 'policies' },
  { type: 'Approval', title: 'APPR-9402: High-Value SAP Vendor Payout', subtitle: 'Requires CFO Passkey · $145,000', target_tab: 'approvals' },
  { type: 'Secret', title: 'SAP_PRODUCTION_BAPI_TOKEN', subtitle: 'OS Vault · Encrypted AES-256 · Healthy', target_tab: 'secrets' }
];

const GlobalSearchModal = ({ isOpen, onClose, onNavigateTab }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  const filterMock = (q) => {
    if (!q || !q.trim()) return ALL_MOCK_SEARCH_ITEMS;
    const lower = q.toLowerCase();
    return ALL_MOCK_SEARCH_ITEMS.filter(i => 
      i.title.toLowerCase().includes(lower) || 
      i.subtitle.toLowerCase().includes(lower) || 
      i.type.toLowerCase().includes(lower)
    );
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      // Load default results
      fetch(`${window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420'}/enterprise/dashboard/search?q=`)
        .then(r => r.json())
        .then(d => {
          if (d && d.results && d.results.length > 0) setResults(d.results);
          else setResults(filterMock(''));
        })
        .catch(() => setResults(filterMock('')));
    }
  }, [isOpen]);

  const handleSearch = useCallback((val) => {
    setQuery(val);
    fetch(`${window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420'}/enterprise/dashboard/search?q=${encodeURIComponent(val)}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.results && d.results.length > 0) setResults(d.results);
        else setResults(filterMock(val));
      })
      .catch(() => setResults(filterMock(val)));
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
