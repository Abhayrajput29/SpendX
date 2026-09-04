import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, Receipt, PiggyBank,
  Sparkles, TrendingUp, CalendarDays, Zap
} from 'lucide-react';
import Dashboard    from './views/Dashboard';
import OcrScanner   from './views/OcrScanner';
import Transactions from './views/Transactions';
import Budgets      from './views/Budgets';
import AiAdvisor    from './views/AiAdvisor';
import Forecast     from './views/Forecast';
import Subscriptions from './views/Subscriptions';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Logo */}
          <div style={{ padding: '22px 20px 12px' }}>
            <div className="logo-container">
              <div className="logo-icon">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="logo-text">FinanceAI</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            <p className="nav-section-label">Main</p>
            <ul className="nav-links">
              <li>
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/ocr" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <ScanLine size={18} />
                  <span>Receipt Scanner</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/transactions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Receipt size={18} />
                  <span>Transactions</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/budgets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <PiggyBank size={18} />
                  <span>Budgets</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/subscriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <CalendarDays size={18} />
                  <span>Subscriptions</span>
                </NavLink>
              </li>
            </ul>

            <p className="nav-section-label" style={{ marginTop: '8px' }}>Analytics</p>
            <ul className="nav-links">
              <li>
                <NavLink to="/forecast" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <TrendingUp size={18} />
                  <span>Forecast</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/advisor" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Sparkles size={18} />
                  <span>AI Advisor</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="user-avatar">AS</div>
            <div className="user-info">
              <span className="user-name">Abhay Singh</span>
              <span className="user-role">Lead Developer</span>
            </div>
            <div className="user-status-dot" title="Online" />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/ocr"          element={<OcrScanner />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets"      element={<Budgets />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/forecast"     element={<Forecast />} />
            <Route path="/advisor"      element={<AiAdvisor />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}
