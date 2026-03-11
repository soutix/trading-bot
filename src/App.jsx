import { useState, useContext, createContext, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_PORTFOLIO_HISTORY = Array.from({ length: 60 }, (_, i) => {
  const base = 500;
  const noise = Math.sin(i * 0.3) * 30 + Math.sin(i * 0.1) * 20;
  const trend = i * 0.8;
  const val = base + noise + trend;
  const d = new Date(2025, 0, 1);
  d.setDate(d.getDate() + i * 3);
  return {
    date: d.toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    equity: parseFloat(val.toFixed(2)),
    btc: i > 15 && i < 40 ? parseFloat((val * 0.78).toFixed(2)) : null,
    eth: i >= 40 ? parseFloat((val * 0.76).toFixed(2)) : null,
    cash: parseFloat((val * (i > 15 ? 0.22 : 1)).toFixed(2)),
  };
});

const MOCK_TRADES = [
  { id: 1, date: "2025-03-11 09:02", type: "BUY",  asset: "BTC-USD", qty: 0.00421, price: 82340, notional: 346.67, fee: 2.08, slippage: 0.17, cashAfter: 153.25, equityAfter: 503.18, comment: "Rebalance — BTC top momentum" },
  { id: 2, date: "2025-02-18 09:01", type: "SELL", asset: "BTC-USD", qty: 0.00389, price: 78120, notional: 303.89, fee: 1.82, slippage: 0.15, cashAfter: 498.40, equityAfter: 498.40, comment: "Rebalance — no eligible asset" },
  { id: 3, date: "2025-02-11 09:00", type: "BUY",  asset: "BTC-USD", qty: 0.00398, price: 75500, notional: 300.49, fee: 1.80, slippage: 0.15, cashAfter: 199.56, equityAfter: 502.21, comment: "Rebalance — BTC > MA200" },
  { id: 4, date: "2025-01-28 09:01", type: "SELL", asset: "ETH-USD", qty: 0.14200, price: 2810,  notional: 399.02, fee: 2.39, slippage: 0.20, cashAfter: 500.12, equityAfter: 500.12, comment: "ETH dropped below MA200" },
  { id: 5, date: "2025-01-14 09:00", type: "BUY",  asset: "ETH-USD", qty: 0.13800, price: 2890,  notional: 398.82, fee: 2.39, slippage: 0.20, cashAfter: 101.18, equityAfter: 501.40, comment: "Rebalance — ETH best momentum" },
  { id: 6, date: "2025-01-07 09:02", type: "HOLD", asset: "—",       qty: 0,       price: 0,     notional: 0,      fee: 0,    slippage: 0,    cashAfter: 500.00, equityAfter: 500.00, comment: "No asset above MA200 — 100% cash" },
  { id: 7, date: "2024-12-31 09:00", type: "REBALANCE", asset: "BTC-USD", qty: 0.00102, price: 96200, notional: 98.12, fee: 0.59, slippage: 0.05, cashAfter: 104.40, equityAfter: 498.20, comment: "Weight adjustment — vol targeting" },
];

const MOCK_SIGNALS = {
  BTC: { price: 82340, ma200: 61200, momentum90: 18.4, vol20: 0.043, eligible: true, weight: 0.78, rank: 1 },
  ETH: { price: 1920,  ma200: 2310,  momentum90: -8.2, vol20: 0.061, eligible: false, weight: 0,    rank: null },
};

const DEFAULT_CONFIG = {
  PRODUCT_IDS: "BTC-USD, ETH-USD",
  TREND_MA_DAYS: 200,
  MOMENTUM_DAYS: 90,
  VOL_DAYS: 20,
  TOP_K: 1,
  REBALANCE_WEEKDAY_UTC: 1,
  REBALANCE_HOUR_UTC: 9,
  MIN_VOL_FLOOR: "1e-6",
  MAX_GROSS_EXPOSURE: 0.80,
  DRY_RUN: true,
  TEST_MODE: false,
  FEE_TAKER_BPS: 60,
  FEE_MAKER_BPS: 40,
  SLIPPAGE_BPS: 5,
  USE_TAKER_FEES: true,
  PAPER_START_CASH_USD: 500.0,
};

const PORTFOLIO = {
  totalEquity: 503.18,
  cashUSD: 153.25,
  invested: 349.93,
  cumulativeFees: 11.22,
  startCash: 500.0,
  lastRebalance: "2025-03-11 09:02 UTC",
  nextRebalance: "2025-03-18 09:00 UTC",
  botStatus: "RUNNING",
  dryRun: true,
  positions: [
    { asset: "BTC-USD", units: 0.00421, price: 82340, value: 346.67, pct: 68.89, pnl: 0.52, pnlPct: 0.15 }
  ],
};

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const AppCtx = createContext(null);

function AppProvider({ children }) {
  const [page, setPage]       = useState("dashboard");
  const [config, setConfig]   = useState(DEFAULT_CONFIG);
  const [sideOpen, setSideOpen] = useState(true);
  return (
    <AppCtx.Provider value={{ page, setPage, config, setConfig, sideOpen, setSideOpen }}>
      {children}
    </AppCtx.Provider>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg0:   #080c10;
    --bg1:   #0d1117;
    --bg2:   #111820;
    --bg3:   #18222e;
    --bg4:   #1e2d3d;
    --line:  #1f2d3d;
    --text0: #e6edf3;
    --text1: #8b949e;
    --text2: #484f58;
    --cyan:  #39d0d8;
    --green: #3fb950;
    --red:   #f85149;
    --amber: #e3b341;
    --blue:  #388bfd;
    --font-mono: 'Space Mono', monospace;
    --font-sans: 'DM Sans', sans-serif;
    --r: 8px;
    --r-lg: 12px;
  }

  body { background: var(--bg0); color: var(--text0); font-family: var(--font-sans); min-height: 100vh; }

  /* Layout */
  .app { display: flex; min-height: 100vh; }
  .sidebar {
    width: 220px; background: var(--bg1); border-right: 1px solid var(--line);
    display: flex; flex-direction: column; padding: 0; flex-shrink: 0;
    transition: width .2s;
  }
  .sidebar.collapsed { width: 60px; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .topbar {
    height: 56px; background: var(--bg1); border-bottom: 1px solid var(--line);
    display: flex; align-items: center; padding: 0 24px; gap: 12px; flex-shrink: 0;
  }
  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* Sidebar */
  .logo-area {
    height: 56px; display: flex; align-items: center; padding: 0 18px; gap: 10px;
    border-bottom: 1px solid var(--line); flex-shrink: 0;
  }
  .logo-icon { width: 28px; height: 28px; background: var(--cyan); border-radius: 6px;
    display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .logo-text { font-family: var(--font-mono); font-size: 13px; font-weight: 700;
    color: var(--text0); white-space: nowrap; overflow: hidden; }
  .nav { padding: 12px 8px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r);
    cursor: pointer; transition: background .15s, color .15s; color: var(--text1);
    font-size: 13.5px; font-weight: 500; white-space: nowrap; overflow: hidden;
    border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: var(--bg3); color: var(--text0); }
  .nav-item.active { background: var(--bg4); color: var(--cyan); }
  .nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
  .nav-label { overflow: hidden; }
  .sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--line); }

  /* Topbar */
  .topbar-title { font-size: 15px; font-weight: 600; flex: 1; }
  .badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
    border-radius: 20px; font-size: 11px; font-weight: 600; font-family: var(--font-mono);
    text-transform: uppercase; letter-spacing: .5px;
  }
  .badge-green  { background: rgba(63,185,80,.15);  color: var(--green); border: 1px solid rgba(63,185,80,.3); }
  .badge-red    { background: rgba(248,81,73,.15);   color: var(--red);   border: 1px solid rgba(248,81,73,.3); }
  .badge-amber  { background: rgba(227,179,65,.15);  color: var(--amber); border: 1px solid rgba(227,179,65,.3); }
  .badge-cyan   { background: rgba(57,208,216,.12);  color: var(--cyan);  border: 1px solid rgba(57,208,216,.25);}
  .badge-blue   { background: rgba(56,139,253,.15);  color: var(--blue);  border: 1px solid rgba(56,139,253,.3); }
  .badge-grey   { background: var(--bg3); color: var(--text1); border: 1px solid var(--line); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block; }
  .dot.pulse { animation: pulse 1.8s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* Cards */
  .card {
    background: var(--bg2); border: 1px solid var(--line); border-radius: var(--r-lg);
    padding: 20px; transition: border-color .2s;
  }
  .card:hover { border-color: var(--bg4); }
  .card-sm { padding: 16px; }
  .card-label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 6px; }
  .card-value { font-family: var(--font-mono); font-size: 22px; font-weight: 700; color: var(--text0); line-height: 1.1; }
  .card-value-sm { font-family: var(--font-mono); font-size: 15px; font-weight: 700; }
  .card-sub { font-size: 12px; color: var(--text1); margin-top: 4px; }

  /* Grid helpers */
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .grid-12 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media(max-width: 900px) {
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .grid-12 { grid-template-columns: 1fr; }
  }
  @media(max-width: 600px) {
    .grid-4 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr; }
  }

  /* Section */
  .section-title { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .section-title::after { content:''; flex:1; height:1px; background:var(--line); }
  .page-gap { display: flex; flex-direction: column; gap: 24px; }

  /* Table */
  .tbl-wrap { overflow-x: auto; border-radius: var(--r-lg); border: 1px solid var(--line); }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead th {
    background: var(--bg3); padding: 10px 14px; text-align: left;
    font-size: 10.5px; font-weight: 700; color: var(--text2); text-transform: uppercase;
    letter-spacing: .6px; white-space: nowrap; border-bottom: 1px solid var(--line);
  }
  tbody tr { border-bottom: 1px solid var(--line); transition: background .1s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg3); }
  tbody td { padding: 10px 14px; color: var(--text0); white-space: nowrap; }
  .mono { font-family: var(--font-mono); }
  .text-right { text-align: right; }
  .text-muted { color: var(--text1); }
  .green { color: var(--green); }
  .red   { color: var(--red); }
  .cyan  { color: var(--cyan); }
  .amber { color: var(--amber); }

  /* Chart */
  .chart-wrap { height: 220px; margin-top: 8px; }
  .chart-wrap-lg { height: 280px; margin-top: 8px; }

  /* Config form */
  .config-section { display: flex; flex-direction: column; gap: 14px; }
  .field-group { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media(max-width: 700px){ .field-group { grid-template-columns: 1fr; } }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 11.5px; font-weight: 600; color: var(--text1); }
  .field .hint { font-size: 10.5px; color: var(--text2); margin-top: 2px; }
  .field input, .field select {
    background: var(--bg3); border: 1px solid var(--line); border-radius: var(--r);
    color: var(--text0); padding: 8px 12px; font-size: 13px; font-family: var(--font-mono);
    outline: none; transition: border-color .2s;
  }
  .field input:focus, .field select:focus { border-color: var(--cyan); }
  .toggle-wrap { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
  .toggle {
    width: 40px; height: 22px; border-radius: 11px; cursor: pointer; position: relative;
    transition: background .2s; border: none; flex-shrink: 0;
  }
  .toggle.on  { background: var(--cyan); }
  .toggle.off { background: var(--bg4); }
  .toggle::after {
    content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; top: 3px; transition: left .2s;
  }
  .toggle.on::after  { left: 21px; }
  .toggle.off::after { left: 3px; }
  .toggle-label { font-size: 13px; color: var(--text0); }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 7px; padding: 8px 18px;
    border-radius: var(--r); font-size: 13px; font-weight: 600; cursor: pointer;
    transition: opacity .15s, transform .1s; border: none;
  }
  .btn:active { transform: scale(.98); }
  .btn-primary { background: var(--cyan); color: #000; }
  .btn-secondary { background: var(--bg4); color: var(--text0); border: 1px solid var(--line); }
  .btn-danger { background: rgba(248,81,73,.2); color: var(--red); border: 1px solid rgba(248,81,73,.3); }
  .btn:hover { opacity: .88; }
  .btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

  /* Signal cards */
  .signal-card { background: var(--bg2); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px; }
  .signal-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .signal-row:last-child { border-bottom: none; }
  .signal-key { font-size: 12px; color: var(--text1); }
  .signal-val { font-family: var(--font-mono); font-size: 13px; font-weight: 700; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg1); }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

  /* Tooltip */
  .recharts-tooltip-wrapper .custom-tt {
    background: var(--bg3); border: 1px solid var(--line); border-radius: var(--r);
    padding: 10px 14px; font-family: var(--font-mono); font-size: 12px;
  }

  /* Filter bar */
  .filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .search-input {
    background: var(--bg3); border: 1px solid var(--line); border-radius: var(--r);
    color: var(--text0); padding: 7px 12px; font-size: 13px; outline: none;
    transition: border-color .2s; font-family: var(--font-sans);
  }
  .search-input:focus { border-color: var(--cyan); }
  .filter-btn {
    padding: 6px 12px; border-radius: var(--r); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: background .15s; border: 1px solid var(--line);
    background: var(--bg3); color: var(--text1);
  }
  .filter-btn.active { background: var(--bg4); color: var(--cyan); border-color: var(--cyan); }

  /* Progress bar */
  .prog-bar { height: 5px; background: var(--bg4); border-radius: 3px; overflow: hidden; }
  .prog-fill { height: 100%; border-radius: 3px; transition: width .4s; }

  /* Alloc ring placeholder */
  .alloc-ring { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
  .alloc-legend { display: flex; flex-direction: column; gap: 10px; }
  .alloc-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .alloc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  /* Divider */
  .divider { height: 1px; background: var(--line); margin: 8px 0; }

  /* Status pill */
  .status-pill { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
    padding: 4px 10px; border-radius: 20px; width: fit-content; }

  /* Save toast */
  .toast {
    position: fixed; bottom: 24px; right: 24px; background: var(--bg3);
    border: 1px solid var(--green); border-radius: var(--r); padding: 12px 20px;
    font-size: 13px; color: var(--green); font-weight: 600; z-index: 999;
    animation: slideup .3s ease; display: flex; align-items: center; gap: 8px;
  }
  @keyframes slideup { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Badge({ type = "grey", children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

function KpiCard({ label, value, sub, accent, children }) {
  return (
    <div className="card card-sm">
      <div className="card-label">{label}</div>
      <div className="card-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="section-title"><span>{children}</span></div>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tt">
      <div style={{ color: "var(--text1)", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || "var(--cyan)" }}>
          {p.name}: ${p.value?.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button className={`toggle ${on ? "on" : "off"}`} onClick={onToggle} />
  );
}

function Toast({ msg }) {
  return <div className="toast"><span>✓</span>{msg}</div>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", icon: "◈", label: "Dashboard" },
  { id: "signals",   icon: "⊡", label: "Signals" },
  { id: "history",   icon: "≋", label: "History" },
  { id: "config",    icon: "⊞", label: "Configuration" },
  { id: "logs",      icon: "⊟", label: "Logs" },
];

function Sidebar() {
  const { page, setPage, sideOpen, setSideOpen } = useContext(AppCtx);
  return (
    <nav className={`sidebar ${sideOpen ? "" : "collapsed"}`}>
      <div className="logo-area">
        <div className="logo-icon">⚡</div>
        {sideOpen && <div className="logo-text">CryptoBot</div>}
      </div>
      <div className="nav">
        {NAV_ITEMS.map(n => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? "active" : ""}`}
            onClick={() => setPage(n.id)}
            title={!sideOpen ? n.label : undefined}
          >
            <span className="nav-icon">{n.icon}</span>
            {sideOpen && <span className="nav-label">{n.label}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="nav-item" onClick={() => setSideOpen(o => !o)}>
          <span className="nav-icon">{sideOpen ? "←" : "→"}</span>
          {sideOpen && <span className="nav-label">Collapse</span>}
        </button>
      </div>
    </nav>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────────────────────

const PAGE_TITLES = {
  dashboard: "Dashboard",
  signals:   "Signals & Strategy",
  history:   "Trade History",
  config:    "Configuration",
  logs:      "System Logs",
};

function Topbar() {
  const { page } = useContext(AppCtx);
  const now = new Date().toLocaleString("en-GB", { hour12: false });
  return (
    <div className="topbar">
      <div className="topbar-title">{PAGE_TITLES[page]}</div>
      <Badge type="green"><span className="dot pulse" />RUNNING</Badge>
      <Badge type="amber">DRY RUN</Badge>
      <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>{now}</span>
    </div>
  );
}

// ─── DASHBOARD PAGE ──────────────────────────────────────────────────────────

function Dashboard() {
  const pnl = PORTFOLIO.totalEquity - PORTFOLIO.startCash;
  const pnlPct = (pnl / PORTFOLIO.startCash * 100).toFixed(2);
  const positive = pnl >= 0;

  return (
    <div className="page-gap">
      {/* KPI Row */}
      <div className="grid-4">
        <KpiCard
          label="Total Equity"
          value={`$${PORTFOLIO.totalEquity.toFixed(2)}`}
          sub={<span className={positive ? "green" : "red"}>{positive ? "+" : ""}{pnl.toFixed(2)} ({pnlPct}%)</span>}
        />
        <KpiCard label="Cash Available" value={`$${PORTFOLIO.cashUSD.toFixed(2)}`}
          sub={`${((PORTFOLIO.cashUSD / PORTFOLIO.totalEquity) * 100).toFixed(1)}% of portfolio`} />
        <KpiCard label="Invested" value={`$${PORTFOLIO.invested.toFixed(2)}`}
          sub={`${((PORTFOLIO.invested / PORTFOLIO.totalEquity) * 100).toFixed(1)}% of portfolio`} />
        <KpiCard label="Cumul. Fees" value={`$${PORTFOLIO.cumulativeFees.toFixed(2)}`}
          sub="Taker 0.60% + slippage 0.05%" />
      </div>

      {/* Chart + Allocation */}
      <div className="grid-12">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-label">Equity Curve</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["var(--cyan)", "Equity"], ["var(--green)", "BTC"], ["#8b5cf6", "ETH"]].map(([c, l]) => (
                <span key={l} style={{ fontSize: 11, color: c, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 2, background: c, display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>
          <div className="chart-wrap-lg">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_PORTFOLIO_HISTORY} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--text2)", fontSize: 10 }} tickLine={false} axisLine={false} interval={9} />
                <YAxis tick={{ fill: "var(--text2)", fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto","auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={500} stroke="var(--line)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="equity" stroke="var(--cyan)" strokeWidth={2} fill="url(#gEq)" name="Equity" dot={false} />
                <Line type="monotone" dataKey="btc" stroke="var(--green)" strokeWidth={1.5} dot={false} name="BTC val" connectNulls={false} />
                <Line type="monotone" dataKey="eth" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="ETH val" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Allocation */}
          <div className="card">
            <div className="card-label">Portfolio Allocation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {[
                { label: "BTC-USD", pct: 68.9, color: "var(--cyan)" },
                { label: "Cash USD", pct: 30.4, color: "var(--text2)" },
                { label: "Buffer", pct: 0.7, color: "var(--line)" },
              ].map(a => (
                <div key={a.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text1)" }}>{a.label}</span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text0)" }}>{a.pct}%</span>
                  </div>
                  <div className="prog-bar">
                    <div className="prog-fill" style={{ width: `${a.pct}%`, background: a.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bot Status */}
          <div className="card">
            <div className="card-label">Bot Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {[
                ["Status", <Badge type="green"><span className="dot pulse"/>RUNNING</Badge>],
                ["Mode", <Badge type="amber">DRY RUN</Badge>],
                ["Last Rebalance", <span className="mono" style={{fontSize:11,color:"var(--text1)"}}>2025-03-11 09:02</span>],
                ["Next Rebalance", <span className="mono" style={{fontSize:11,color:"var(--cyan)"}}>2025-03-18 09:00</span>],
                ["Assets", <span className="mono" style={{fontSize:12}}>BTC-USD · ETH-USD</span>],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{k}</span>
                  {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Positions */}
      <div>
        <SectionTitle>Open Positions</SectionTitle>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {["Asset", "Units", "Price", "Value", "% Portfolio", "P&L", "P&L %"].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO.positions.map(p => (
                <tr key={p.asset}>
                  <td><span className="badge badge-cyan">{p.asset}</span></td>
                  <td className="mono">{p.units.toFixed(5)}</td>
                  <td className="mono">${p.price.toLocaleString()}</td>
                  <td className="mono">${p.value.toFixed(2)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="prog-bar" style={{ width: 60 }}>
                        <div className="prog-fill" style={{ width: `${p.pct}%`, background: "var(--cyan)" }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11 }}>{p.pct}%</span>
                    </div>
                  </td>
                  <td className={`mono ${p.pnl >= 0 ? "green" : "red"}`}>{p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}</td>
                  <td className={`mono ${p.pnlPct >= 0 ? "green" : "red"}`}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</td>
                </tr>
              ))}
              <tr>
                <td><span className="badge badge-grey">USD Cash</span></td>
                <td className="mono">{PORTFOLIO.cashUSD.toFixed(2)}</td>
                <td className="mono">$1.00</td>
                <td className="mono">${PORTFOLIO.cashUSD.toFixed(2)}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="prog-bar" style={{ width: 60 }}>
                      <div className="prog-fill" style={{ width: `${((PORTFOLIO.cashUSD / PORTFOLIO.totalEquity) * 100).toFixed(0)}%`, background: "var(--text2)" }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{((PORTFOLIO.cashUSD / PORTFOLIO.totalEquity) * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td className="mono text-muted">—</td>
                <td className="mono text-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent trades mini */}
      <div>
        <SectionTitle>Recent Activity</SectionTitle>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>{["Date", "Type", "Asset", "Notional", "Fee", "Equity After", "Comment"].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {MOCK_TRADES.slice(0, 4).map(t => (
                <tr key={t.id}>
                  <td className="mono text-muted" style={{ fontSize: 11 }}>{t.date}</td>
                  <td><TradeBadge type={t.type} /></td>
                  <td className="mono">{t.asset}</td>
                  <td className="mono">{t.notional > 0 ? `$${t.notional.toFixed(2)}` : "—"}</td>
                  <td className="mono text-muted">{t.fee > 0 ? `$${t.fee.toFixed(2)}` : "—"}</td>
                  <td className="mono">${t.equityAfter.toFixed(2)}</td>
                  <td style={{ color: "var(--text1)", fontSize: 11 }}>{t.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SIGNALS PAGE ─────────────────────────────────────────────────────────────

function Signals() {
  const momentumData = [
    { day: "-90", btc: 0, eth: 0 },
    { day: "-75", btc: 3.2, eth: -1.1 },
    { day: "-60", btc: 7.8, eth: 2.3 },
    { day: "-45", btc: 11.2, eth: -3.4 },
    { day: "-30", btc: 9.8, eth: -6.1 },
    { day: "-15", btc: 15.1, eth: -7.9 },
    { day: "0",   btc: 18.4, eth: -8.2 },
  ];

  return (
    <div className="page-gap">
      <div className="grid-2">
        {Object.entries(MOCK_SIGNALS).map(([asset, s]) => (
          <div key={asset} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div className="card-label">{asset}-USD</div>
                <div className="card-value mono">${s.price.toLocaleString()}</div>
              </div>
              <Badge type={s.eligible ? "green" : "red"}>{s.eligible ? "ELIGIBLE" : "EXCLUDED"}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                ["Current Price", `$${s.price.toLocaleString()}`, "var(--text0)"],
                ["MA-200", `$${s.ma200.toLocaleString()}`, "var(--text1)"],
                ["Price > MA200", s.price > s.ma200 ? "✓ YES" : "✗ NO", s.price > s.ma200 ? "var(--green)" : "var(--red)"],
                ["Momentum 90d", `${s.momentum90 > 0 ? "+" : ""}${s.momentum90}%`, s.momentum90 > 0 ? "var(--green)" : "var(--red)"],
                ["Volatility 20d", `${(s.vol20 * 100).toFixed(2)}%`, "var(--amber)"],
                ["Target Weight", s.weight > 0 ? `${(s.weight * 100).toFixed(0)}%` : "0%", s.weight > 0 ? "var(--cyan)" : "var(--text2)"],
                ["Rank", s.rank !== null ? `#${s.rank}` : "—", "var(--text1)"],
              ].map(([k, v, c]) => (
                <div key={k} className="signal-row">
                  <span className="signal-key">{k}</span>
                  <span className="signal-val" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-label" style={{ marginBottom: 16 }}>Momentum Trend (90 days)</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={momentumData} margin={{ top: 5, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--text2)", fontSize: 10 }} tickLine={false} axisLine={false}
                label={{ value: "days ago", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--text2)" }} />
              <YAxis tick={{ fill: "var(--text2)", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8 }} />
              <ReferenceLine y={0} stroke="var(--line)" />
              <Line type="monotone" dataKey="btc" stroke="var(--cyan)" strokeWidth={2} dot={false} name="BTC" />
              <Line type="monotone" dataKey="eth" stroke="var(--red)" strokeWidth={2} dot={false} name="ETH" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-label" style={{ marginBottom: 12 }}>Strategy Logic</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { step: "01", title: "Trend Filter", icon: "↗", desc: "Asset must be above its 200-day moving average to be eligible.", ok: true },
            { step: "02", title: "Momentum Rank", icon: "⚡", desc: `Top ${DEFAULT_CONFIG.TOP_K} asset by 90-day momentum selected for allocation.`, ok: true },
            { step: "03", title: "Vol Targeting", icon: "⊿", desc: "Weights inversely proportional to 20-day realized volatility.", ok: true },
          ].map(s => (
            <div key={s.step} style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text2)" }}>STEP {s.step}</span>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text1)", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--bg3)", borderRadius: "var(--r)", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>Exposure Cap</div>
          <div style={{ fontSize: 13, color: "var(--text1)" }}>
            Maximum gross exposure capped at <span className="mono cyan">{(DEFAULT_CONFIG.MAX_GROSS_EXPOSURE * 100).toFixed(0)}%</span> of total equity.
            Always keeps at least <span className="mono cyan">{((1 - DEFAULT_CONFIG.MAX_GROSS_EXPOSURE) * 100).toFixed(0)}%</span> in cash. No stop-loss or take-profit — exits are signal-driven only.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

function TradeBadge({ type }) {
  const map = {
    BUY: "green", SELL: "red", HOLD: "grey",
    REBALANCE: "blue", SKIP: "amber"
  };
  return <Badge type={map[type] || "grey"}>{type}</Badge>;
}

function History() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const types = ["ALL", "BUY", "SELL", "HOLD", "REBALANCE"];
  const filtered = MOCK_TRADES.filter(t => {
    const matchType = filter === "ALL" || t.type === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.asset.toLowerCase().includes(q) || t.comment.toLowerCase().includes(q) || t.type.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  return (
    <div className="page-gap">
      <div className="filter-bar">
        <input className="search-input" placeholder="Search asset, type, comment…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
        {types.map(t => (
          <button key={t} className={`filter-btn ${filter === t ? "active" : ""}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text2)" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {["Date / Time", "Type", "Asset", "Qty", "Price", "Notional", "Fee", "Slippage", "Cash After", "Equity After", "Comment"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td className="mono" style={{ fontSize: 11, color: "var(--text1)" }}>{t.date}</td>
                <td><TradeBadge type={t.type} /></td>
                <td className="mono">{t.asset !== "—" ? <Badge type="cyan">{t.asset}</Badge> : <span className="text-muted">—</span>}</td>
                <td className="mono text-right">{t.qty > 0 ? t.qty.toFixed(5) : "—"}</td>
                <td className="mono text-right">{t.price > 0 ? `$${t.price.toLocaleString()}` : "—"}</td>
                <td className="mono text-right">{t.notional > 0 ? `$${t.notional.toFixed(2)}` : "—"}</td>
                <td className="mono text-right" style={{ color: t.fee > 0 ? "var(--amber)" : "var(--text2)" }}>{t.fee > 0 ? `$${t.fee.toFixed(2)}` : "—"}</td>
                <td className="mono text-right text-muted">{t.slippage > 0 ? `$${t.slippage.toFixed(2)}` : "—"}</td>
                <td className="mono text-right">${t.cashAfter.toFixed(2)}</td>
                <td className="mono text-right">${t.equityAfter.toFixed(2)}</td>
                <td style={{ color: "var(--text1)", fontSize: 11, maxWidth: 200 }}>{t.comment}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: "var(--text2)" }}>No results found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONFIG PAGE ──────────────────────────────────────────────────────────────

function ConfigField({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function Config() {
  const { config, setConfig } = useContext(AppCtx);
  const [local, setLocal] = useState({ ...config });
  const [saved, setSaved] = useState(false);

  function upd(k, v) { setLocal(c => ({ ...c, [k]: v })); }
  function save() { setConfig(local); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  function reset() { setLocal({ ...config }); }

  const NumberField = ({ k, hint, step = 1, min }) => (
    <ConfigField label={k.replace(/_/g, " ")} hint={hint}>
      <input type="number" value={local[k]} step={step} min={min}
        onChange={e => upd(k, parseFloat(e.target.value))} />
    </ConfigField>
  );

  const ToggleField = ({ k, label, hint }) => (
    <div className="field">
      <label>{label || k.replace(/_/g, " ")}</label>
      <div className="toggle-wrap">
        <Toggle on={local[k]} onToggle={() => upd(k, !local[k])} />
        <span className="toggle-label">{local[k] ? "Enabled" : "Disabled"}</span>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );

  return (
    <div className="page-gap">
      {/* Assets */}
      <div className="card">
        <SectionTitle>Assets & Universe</SectionTitle>
        <div className="config-section">
          <div className="field-group">
            <ConfigField label="Product IDs" hint="Comma-separated. e.g. BTC-USD, ETH-USD">
              <input value={local.PRODUCT_IDS} onChange={e => upd("PRODUCT_IDS", e.target.value)} />
            </ConfigField>
            <NumberField k="TOP_K" hint="Number of top-ranked assets to hold simultaneously." min={1} />
          </div>
        </div>
      </div>

      {/* Strategy */}
      <div className="card">
        <SectionTitle>Strategy Parameters</SectionTitle>
        <div className="config-section">
          <div className="field-group">
            <NumberField k="TREND_MA_DAYS" hint="Moving average window for trend filter (days)." min={10} />
            <NumberField k="MOMENTUM_DAYS" hint="Lookback period for momentum ranking (days)." min={10} />
            <NumberField k="VOL_DAYS" hint="Window for realized volatility computation (days)." min={5} />
            <NumberField k="MAX_GROSS_EXPOSURE" hint="Max % of equity that can be invested (0.0–1.0)." step={0.01} min={0} />
          </div>
          <ConfigField label="MIN_VOL_FLOOR" hint="Minimum vol to avoid division by zero in weight calc.">
            <input value={local.MIN_VOL_FLOOR} onChange={e => upd("MIN_VOL_FLOOR", e.target.value)} />
          </ConfigField>
        </div>
      </div>

      {/* Rebalance schedule */}
      <div className="card">
        <SectionTitle>Rebalance Schedule</SectionTitle>
        <div className="config-section">
          <div className="field-group">
            <ConfigField label="Rebalance Weekday (UTC)" hint="0=Mon, 1=Tue, …, 6=Sun. Next: Tuesday (1).">
              <select value={local.REBALANCE_WEEKDAY_UTC} onChange={e => upd("REBALANCE_WEEKDAY_UTC", parseInt(e.target.value))}>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </ConfigField>
            <NumberField k="REBALANCE_HOUR_UTC" hint="Hour of day to trigger rebalance (UTC, 0–23)." min={0} step={1} />
          </div>
        </div>
      </div>

      {/* Fees & Execution */}
      <div className="card">
        <SectionTitle>Fees & Execution</SectionTitle>
        <div className="config-section">
          <div className="field-group">
            <NumberField k="FEE_TAKER_BPS" hint="Taker fee in basis points. 60 bps = 0.60%." min={0} />
            <NumberField k="FEE_MAKER_BPS" hint="Maker fee in basis points. 40 bps = 0.40%." min={0} />
            <NumberField k="SLIPPAGE_BPS" hint="Simulated slippage in basis points. 5 bps = 0.05%." min={0} />
            <ToggleField k="USE_TAKER_FEES" label="Use Taker Fees" hint="If enabled, applies taker fees (market orders). Else maker." />
          </div>
        </div>
      </div>

      {/* Mode */}
      <div className="card">
        <SectionTitle>Execution Mode</SectionTitle>
        <div className="config-section">
          <div className="field-group">
            <ToggleField k="DRY_RUN" label="Dry Run (Paper Trading)" hint="When ON, no real orders are sent to Coinbase." />
            <ToggleField k="TEST_MODE" label="Test Mode" hint="Forces rebalance every run. For dev/debug only." />
            <NumberField k="PAPER_START_CASH_USD" hint="Starting cash for paper portfolio simulation ($)." min={0} step={10} />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={save}>✓ Save Configuration</button>
        <button className="btn btn-secondary" onClick={reset}>↺ Reset Changes</button>
        <button className="btn btn-danger">⚠ Force Rebalance Now</button>
      </div>

      {saved && <Toast msg="Configuration saved successfully" />}
    </div>
  );
}

// ─── LOGS PAGE ────────────────────────────────────────────────────────────────

const MOCK_LOGS = [
  { ts: "2025-03-11 09:02:14", level: "INFO",  msg: "Rebalance triggered — weekday 1, 09:00 UTC" },
  { ts: "2025-03-11 09:02:15", level: "INFO",  msg: "Fetching candles for BTC-USD (200 days)" },
  { ts: "2025-03-11 09:02:16", level: "INFO",  msg: "Fetching candles for ETH-USD (200 days)" },
  { ts: "2025-03-11 09:02:17", level: "INFO",  msg: "BTC-USD price=82340 MA200=61200 → ELIGIBLE" },
  { ts: "2025-03-11 09:02:17", level: "INFO",  msg: "ETH-USD price=1920 MA200=2310 → EXCLUDED (below MA200)" },
  { ts: "2025-03-11 09:02:17", level: "INFO",  msg: "Momentum rank: BTC=+18.4% ETH=-8.2%" },
  { ts: "2025-03-11 09:02:17", level: "INFO",  msg: "Top-1 selection: BTC-USD (weight raw=1.0)" },
  { ts: "2025-03-11 09:02:18", level: "INFO",  msg: "Applying exposure cap MAX_GROSS=0.80 → weight_btc=0.78" },
  { ts: "2025-03-11 09:02:18", level: "INFO",  msg: "Target: BTC-USD 0.00421 units ($346.67), Cash $153.25" },
  { ts: "2025-03-11 09:02:18", level: "INFO",  msg: "Simulating BUY BTC-USD qty=0.00421 notional=346.67 fee=2.08 slip=0.17" },
  { ts: "2025-03-11 09:02:18", level: "INFO",  msg: "Paper portfolio updated — equity=$503.18" },
  { ts: "2025-03-11 09:02:18", level: "INFO",  msg: "State saved to state/paper_portfolio.json" },
  { ts: "2025-03-04 09:01:55", level: "WARN",  msg: "No eligible asset found — portfolio moved to 100% cash" },
  { ts: "2025-02-25 14:33:01", level: "ERROR", msg: "Coinbase API timeout on BTC-USD candles (retry 1/3)" },
  { ts: "2025-02-25 14:33:04", level: "INFO",  msg: "Retry successful — candles received" },
];

function Logs() {
  const [levelFilter, setLevelFilter] = useState("ALL");
  const levelColors = { INFO: "var(--cyan)", WARN: "var(--amber)", ERROR: "var(--red)" };
  const filtered = MOCK_LOGS.filter(l => levelFilter === "ALL" || l.level === levelFilter);

  return (
    <div className="page-gap">
      <div className="filter-bar">
        {["ALL", "INFO", "WARN", "ERROR"].map(l => (
          <button key={l} className={`filter-btn ${levelFilter === l ? "active" : ""}`} onClick={() => setLevelFilter(l)}>{l}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text2)" }}>
          {filtered.length} entries · logs/agent.log
        </span>
      </div>

      <div style={{ background: "var(--bg1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 4, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {filtered.map((l, i) => (
          <div key={i} style={{
            padding: "6px 14px", borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
            display: "flex", gap: 14, alignItems: "flex-start",
            background: l.level === "ERROR" ? "rgba(248,81,73,.05)" : l.level === "WARN" ? "rgba(227,179,65,.05)" : "transparent"
          }}>
            <span style={{ color: "var(--text2)", whiteSpace: "nowrap", fontSize: 11 }}>{l.ts}</span>
            <span style={{ color: levelColors[l.level] || "var(--text1)", fontWeight: 700, minWidth: 44 }}>{l.level}</span>
            <span style={{ color: "var(--text0)", lineHeight: 1.5 }}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────


function PageContent() {
  const { page } = useContext(AppCtx);
  switch (page) {
    case "dashboard": return <Dashboard />;
    case "signals":   return <Signals />;
    case "history":   return <History />;
    case "config":    return <Config />;
    case "logs":      return <Logs />;
    default:          return <Dashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <style>{css}</style>
      <div className="app">
        <Sidebar />
        <div className="main">
          <Topbar />
          <div className="content">
            <PageContent />
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
