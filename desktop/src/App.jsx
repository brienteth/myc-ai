import React, { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import CommandPalette from './components/CommandPalette/CommandPalette';
import Home from './views/Home';
import Library from './views/Library';
import Automation from './views/Automation';
import Colony from './views/Colony';
import Workflows from './views/Workflows';
import Models from './views/Models';
import Settings from './views/Settings';
import Onboarding from './views/Onboarding';
import Chat from './screens/Chat';
import SetupScreen from './screens/SetupScreen';
import EnterpriseDomain from './views/Enterprise/EnterpriseDomain';
import SecondBrain from './views/SecondBrain';
import SkillsView from './views/SkillsView';
import SimuleView from './views/SimuleView';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const isElectron = /Electron/i.test(navigator.userAgent);
  const isFileProtocol = window.location.protocol === 'file:';
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isHostApp = isElectron || isFileProtocol || isLocalHost || !window.location.hostname;

  const [isFirstLaunch, setIsFirstLaunch] = useState(() => {
    if (!isHostApp) return false; // Mobile/remote clients skip onboarding/setup entirely
    return !localStorage.getItem('myca_ready');
  });

  if (isFirstLaunch) {
    return (
      <SetupScreen onComplete={() => {
        localStorage.setItem('myca_ready', '1');
        setIsFirstLaunch(false);
      }} />
    );
  }

  return (
    <ErrorBoundary title="Myca OS Application">
      <CommandPalette />
      <MemoryRouter>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<ErrorBoundary title="Assistant"><Chat /></ErrorBoundary>} />
            <Route path="chat" element={<ErrorBoundary title="Assistant"><Chat /></ErrorBoundary>} />
            <Route path="library" element={<ErrorBoundary title="Knowledge OS"><Library /></ErrorBoundary>} />
            <Route path="automation" element={<ErrorBoundary title="Execution Studio"><Automation /></ErrorBoundary>} />
            <Route path="brain" element={<ErrorBoundary title="Second Brain"><SecondBrain /></ErrorBoundary>} />
            <Route path="skills" element={<ErrorBoundary title="Skills & MCP Registry"><SkillsView /></ErrorBoundary>} />
            <Route path="lab" element={<ErrorBoundary title="Research Lab"><SimuleView /></ErrorBoundary>} />
            <Route path="simule" element={<ErrorBoundary title="Research Lab"><SimuleView /></ErrorBoundary>} />
            <Route path="enterprise/*" element={<ErrorBoundary title="Enterprise"><EnterpriseDomain /></ErrorBoundary>} />
            <Route path="colony" element={<ErrorBoundary title="Colony Mesh"><Colony /></ErrorBoundary>} />
            <Route path="workflows" element={<ErrorBoundary title="Workflows"><Workflows /></ErrorBoundary>} />
            <Route path="models" element={<ErrorBoundary title="Models Manager"><Models /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary title="Settings"><Settings /></ErrorBoundary>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ErrorBoundary>
  );
}

export default App;
