import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import MobileNav from '../MobileNav/MobileNav';
import ErrorBoundary from '../ErrorBoundary';
import './Layout.css';

const Layout = () => {
  return (
    <div className="app-container">
      <ErrorBoundary title="Sidebar Navigation">
        <Sidebar />
      </ErrorBoundary>
      <main className="main-content">
        <ErrorBoundary title="View Content">
          <Outlet />
        </ErrorBoundary>
      </main>
      <ErrorBoundary title="Mobile Navigation">
        <MobileNav />
      </ErrorBoundary>
    </div>
  );
};

export default Layout;
