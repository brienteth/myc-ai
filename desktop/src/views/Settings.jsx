import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import './Settings.css';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [telemetry, setTelemetry] = useState(false);
  const { lang, setLang, t } = useTranslation();

  const handleLang = (l) => {
    setLang(l);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <>
            <div className="settings-section-lbl">{t('set.sidebar.general').toUpperCase()}</div>
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">{t('set.gen.lang.label')}</div>
                <div className="setting-desc">{t('set.gen.lang.desc')}</div>
              </div>
              <div className="lang-pills">
                <button className={`lang-pill ${lang === 'tr' ? 'active' : ''}`} onClick={() => handleLang('tr')}>🇹🇷 Türkçe</button>
                <button className={`lang-pill ${lang === 'en' ? 'active' : ''}`} onClick={() => handleLang('en')}>🇬🇧 English</button>
              </div>
            </div>
          </>
        );
      case 'models':
        return (
          <>
            <div className="settings-section-lbl">MODELS</div>
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">{t('set.gen.model.label')}</div>
                <div className="setting-desc">{t('set.gen.model.desc')}</div>
              </div>
              <select className="myc-select" value="1" readOnly>
                <option value="1">Myca Core 3B · 1.1s avg</option>
                <option value="2">Myca Vision 7B · 2.4s avg</option>
              </select>
            </div>
          </>
        );
      case 'colony':
        return (
          <>
            <div className="settings-section-lbl">COLONY MESH</div>
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">Auto-Discover Peers</div>
                <div className="setting-desc">Find other devices on the local network automatically</div>
              </div>
              <button className={`myc-toggle ${autoDiscover ? 'on' : ''}`} onClick={() => setAutoDiscover(!autoDiscover)}>
                <div className="myc-toggle-thumb"></div>
              </button>
            </div>
          </>
        );
      case 'privacy':
        return (
          <>
            <div className="settings-section-lbl">{t('set.sidebar.privacy').toUpperCase()}</div>
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">Analytics & Telemetry</div>
                <div className="setting-desc">Send anonymous usage data (Always off by default)</div>
              </div>
              <button className={`myc-toggle ${telemetry ? 'on' : ''}`} onClick={() => setTelemetry(!telemetry)}>
                <div className="myc-toggle-thumb"></div>
              </button>
            </div>
          </>
        );
      case 'advanced':
        return (
          <>
            <div className="settings-section-lbl">{t('set.sidebar.advanced').toUpperCase()}</div>
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">Developer Mode</div>
                <div className="setting-desc">Enable detailed logging and debugging tools</div>
              </div>
              <button className={`myc-toggle`} onClick={() => {}}>
                <div className="myc-toggle-thumb"></div>
              </button>
            </div>
            
            <div className="setting-row">
              <div className="setting-row-left">
                <div className="setting-lbl">Local API Port</div>
                <div className="setting-desc">Port used by Myca Engine (default: 8420)</div>
              </div>
              <input type="text" className="myc-select" value="8420" style={{ width: '80px', textAlign: 'center' }} readOnly />
            </div>

            <div className="setting-row" style={{ marginTop: '20px' }}>
              <div className="setting-row-left">
                <div className="setting-lbl" style={{ color: 'var(--f-dead)' }}>Reset Database</div>
                <div className="setting-desc">Clear all local knowledge and history. This cannot be undone.</div>
              </div>
              <button style={{ 
                background: 'transparent', border: '1px solid var(--f-dead)', color: 'var(--f-dead)', 
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' 
              }}>Reset Everything</button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <h2>{t('nav.settings')}</h2>
        <button className={`setting-cat ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>{t('set.sidebar.general')}</button>
        <button className={`setting-cat ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>Models</button>
        <button className={`setting-cat ${activeTab === 'colony' ? 'active' : ''}`} onClick={() => setActiveTab('colony')}>Colony</button>
        <button className={`setting-cat ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>{t('set.sidebar.privacy')}</button>
        <button className={`setting-cat ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => setActiveTab('advanced')} style={{color: 'var(--f-dead)'}}>{t('set.sidebar.advanced')}</button>
      </div>

      <div className="settings-main">
        <div className="settings-header">
          <h1 className="f-serif-italic">Preferences</h1>
          <p>Configure your living colony</p>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default Settings;
