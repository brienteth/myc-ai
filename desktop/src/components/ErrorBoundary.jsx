import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MYCA UI ERROR]', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          maxWidth: 680,
          margin: '40px auto',
          background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.95) 0%, rgba(12, 14, 24, 0.98) 100%)',
          borderRadius: 16,
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#f4f4f6',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.15)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <AlertCircle size={24} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
              {this.props.title || 'Screen Render Notice'}
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#a0a0b2', lineHeight: 1.5, marginBottom: 16 }}>
            An unexpected render issue occurred while displaying this section. You can reload this view below.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#070913',
              padding: 14,
              borderRadius: 10,
              fontSize: 12,
              color: '#f87171',
              overflowX: 'auto',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 20
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              if (this.props.onReset) this.props.onReset();
            }}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
              color: '#070a10',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <RotateCcw size={15} /> Reload View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
