import React, { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import CommandPalette from './components/CommandPalette/CommandPalette';
import Home from './views/Home';
import Library from './views/Library';
import Automation from './views/Automation';
import Devices from './views/Devices';
import Settings from './views/Settings';
import Onboarding from './views/Onboarding';
import Chat from './screens/Chat';
import SetupScreen from './screens/SetupScreen';
import './App.css';

function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(() => !localStorage.getItem('myca_ready'));

  if (isFirstLaunch) {
    return (
      <SetupScreen onComplete={() => {
        localStorage.setItem('myca_ready', '1');
        setIsFirstLaunch(false);
      }} />
    );
  }

  return (
    <>
      <CommandPalette />
      <MemoryRouter>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="chat" element={<Chat />} />
            <Route path="library" element={<Library />} />
            <Route path="automation" element={<Automation />} />
            <Route path="devices" element={<Devices />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </>
  );
}

export default App;
