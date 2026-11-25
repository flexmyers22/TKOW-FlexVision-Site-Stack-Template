import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { OverviewPage } from './pages/OverviewPage';
import { PowerFlowPage } from './pages/PowerFlowPage';
import { BatteryPage } from './pages/BatteryPage';
import { PCSControlPage } from './pages/PCSControlPage';
import { OscillationPage } from './pages/OscillationPage';
import { TestsPage } from './pages/TestsPage';
import { AlarmsPage } from './pages/AlarmsPage';
import './styles.css';

const links = [
  ['/', 'Overview'],
  ['/power', 'Power Flow'],
  ['/battery', 'Battery'],
  ['/pcs', 'PCS Control'],
  ['/oscillation', 'Oscillation'],
  ['/tests', 'Tests'],
  ['/alarms', 'Alarms'],
] as const;

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="top">
          <strong>TKOW FlexVision BESS</strong>
          <span className="muted">TKOW-FV-BESS-DT-001</span>
        </header>
        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/power" element={<PowerFlowPage />} />
            <Route path="/battery" element={<BatteryPage />} />
            <Route path="/pcs" element={<PCSControlPage />} />
            <Route path="/oscillation" element={<OscillationPage />} />
            <Route path="/tests" element={<TestsPage />} />
            <Route path="/alarms" element={<AlarmsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
