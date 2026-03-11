import { useState, useContext, createContext, useEffect, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const AppCtx = createContext(null);

function AppProvider({ children }) {
  const [page,        setPage]        = useState("dashboard");
  const [sideOpen,    setSideOpen]    = useState(true);
  const [portfolio,   setPortfolio]   = useState(null);
  const [signals,     setSignals]     = useState([]);
  const [trades,      setTrades]      = useState([]);
  const [logs,        setLogs]        = useState([]);
  const [config,      setConfig]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, t, l, c] = await Promise.all([
        fetch("/api/portfolio").then(r => r.json()),
        fetch("/api/signals").then(r => r.json()),
        fetch("/api/trades").then(r => r.json()),
        fetch("/api/logs").then(r => r.json()),
        fetch("/api/config").then(r => r.json()),
      ]);
      setPortfolio(p);
      setSignals(s.signals || []);
      setTrades(t.trades || []);
      setLogs(l.logs || []);
      setConfig(c);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <AppCtx.Provider value={{
      page, setPage, sideOpen, setSideOpen,
      portfolio, signals, trades, logs, config,
      loading, lastRefresh, refresh: fetchAll,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg0:#080c10;--bg1:#0d1117;--bg2:#111820;--bg3:#18222e;--bg4:#1e2d3d;
    --line:#1f2d3d;--text0:#e6edf3;--text1:#8b949e;--text2:#484f58;
    --cyan:#39d0d8;--green:#3fb950;--red:#f85149;--amber:#e3b341;--blue:#388bfd;
    --font-mono:'Space Mono',monospace;--font-sans:'DM Sans',sans-serif;
    --r:8px;--r-lg:12px;
  }
  body{background:var(--bg0);color:var(--text0);font-family:var(--font-sans);min-height:100vh;}
  .app{display:flex;min-height:100vh;}
  .sidebar{width:220px;background:var(--bg1);border-right:1px solid var(--line);display:flex;flex-direction:column;flex-shrink:0;transition:width .2s;}
  .sidebar.collapsed{width:60px;}
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
  .topbar{height:56px;background:var(--bg1);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 24px;gap:12px;flex-shrink:0;}
  .content{flex:1;overflow-y:auto;padding:24px;}
  .logo-area{height:56px;display:flex;align-items:center;padding:0 18px;gap:10px;border-bottom:1px solid var(--line);}
  .logo-icon{width:28px;height:28px;background:var(--cyan);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .logo-text{font-family:var(--font-mono);font-size:13px;font-weight:700;white-space:nowrap;}
  .nav{padding:12px 8px;flex:1;display:flex;flex-direction:column;gap:2px;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r);cursor:pointer;transition:background .15s,color .15s;color:var(--text1);font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;border:none;background:none;width:100%;text-align:left;}
  .nav-item:hover{background:var(--bg3);color:var(--text0);}
  .nav-item.active{background:var(--bg4);color:var(--cyan);}
  .nav-icon{font-size:16px;flex-shrink:0;width:20px;text-align:center;}
  .sidebar-footer{padding:12px 8px;border-top:1px solid var(--line);}
  .topbar-title{font-size:15px;font-weight:600;flex:1;}
  .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.5px;}
  .badge-green{background:rgba(63,185,80,.15);color:var(--green);border:1px solid rgba(63,185,80,.3);}
  .badge-red{background:rgba(248,81,73,.15);color:var(--red);border:1px solid rgba(248,81,73,.3);}
  .badge-amber{background:rgba(227,179,65,.15);color:var(--amber);border:1px solid rgba(227,179,65,.3);}
  .badge-cyan{background:rgba(57,208,216,.12);color:var(--cyan);border:1px solid rgba(57,208,216,.25);}
  .badge-blue{background:rgba(56,139,253,.15);color:var(--blue);border:1px solid rgba(56,139,253,.3);}
  .badge-grey{background:var(--bg3);color:var(--text1);border:1px solid var(--line);}
  .dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;}
  .dot.pulse{animation:pulse 1.8s infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .card{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;transition:border-color .2s;}
  .card-sm{padding:16px;}
  .card-label{font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
  .card-value{font-family:var(--font-mono);font-size:22px;font-weight:700;line-height:1.1;}
  .card-sub{font-size:12px;color:var(--text1);margin-top:4px;}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
  .grid-12{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  @media(max-width:900px){.grid-4{grid-template-columns:repeat(2,1fr);}.grid-12{grid-template-columns:1fr;}}
  @media(max-width:600px){.grid-4{grid-template-columns:1fr;}}
  .section-title{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .section-title::after{content:'';flex:1;height:1px;background:var(--line);}
  .page-gap{display:flex;flex-direction:column;gap:24px;}
  .tbl-wrap{overflow-x:auto;border-radius:var(--r-lg);border:1px solid var(--line);}
  table{width:100%;border-collapse:collapse;font-size:12.5px;}
  thead th{background:var(--bg3);padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;white-space:nowrap;border-bottom:1px solid var(--line);}
  tbody tr{border-bottom:1px solid var(--line);transition:background .1s;}
  tbody tr:last-child{border-bottom:none;}
  tbody tr:hover{background:var(--bg3);}
  tbody td{padding:10px 14px;white-space:nowrap;}
  .mono{font-family:var(--font-mono);}
  .text-right{text-align:right;}
  .text-muted{color:var(--text1);}
  .green{color:var(--green);}.red{color:var(--red);}.cyan{color:var(--cyan);}.amber{color:var(--amber);}
  .chart-wrap{height:220px;margin-top:8px;}
  .chart-wrap-lg{height:280px;margin-top:8px;}
  .filter-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
  .search-input{background:var(--bg3);border:1px solid var(--line);border-radius:var(--r);color:var(--text0);padding:7px 12px;font-size:13px;outline:none;transition:border-color .2s;}
  .search-input:focus{border-color:var(--cyan);}
  .filter-btn{padding:6px 12px;border-radius:var(--r);font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;border:1px solid var(--line);background:var(--bg3);color:var(--text1);}
  .filter-btn.active{background:var(--bg4);color:var(--cyan);border-color:var(--cyan);}
  .prog-bar{height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;}
  .prog-fill{height:100%;border-radius:3px;transition:width .4s;}
  .btn{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:var(--r);font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;border:none;}
  .btn:active{transform:scale(.98);}
  .btn-primary{background:var(--cyan);color:#000;}
  .btn-secondary{background:var(--bg4);color:var(--text0);border:1px solid var(--line);}
  .btn-danger{background:rgba(248,81,73,.2);color:var(--red);border:1px solid rgba(248,81,73,.3);}
  .btn:hover{opacity:.88;}
  .btn-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
  .signal-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);}
  .signal-row:last-child{border-bottom:none;}
  .signal-key{font-size:12px;color:var(--text1);}
  .signal-val{font-family:var(--font-mono);font-size:13px;font-weight:700;}
  .field{display:flex;flex-direction:column;gap:5px;}
  .field label{font-size:11.5px;font-weight:600;color:var(--text1);}
  .field .hint{font-size:10.5px;color:var(--text2);margin-top:2px;}
  .field input,.field select{background:var(--bg3);border:1px solid var(--line);border-radius:var(--r);color:var(--text0);padding:8px 12px;font-size:13px;font-family:var(--font-mono);outline:none;transition:border-color .2s;}
  .field input:focus,.field select:focus{border-color:var(--cyan);}
  .field-group{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
  @media(max-width:700px){.field-group{grid-template-columns:1fr;}}
  .toggle{width:40px;height:22px;border-radius:11px;cursor:pointer;position:relative;transition:background .2s;border:none;flex-shrink:0;}
  .toggle.on{background:var(--cyan);}.toggle.off{background:var(--bg4);}
  .toggle::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:3px;transition:left .2s;}
  .toggle.on::after{left:21px;}.toggle.off::after{left:3px;}
  .toggle-wrap{display:flex;align-items:center;gap:10px;margin-top:2px;}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--bg3);border:1px solid var(--green);border-radius:var(--r);padding:12px 20px;font-size:13px;color:var(--green);font-weight:600;z-index:999;animation:slideup .3s ease;display:flex;align-items:center;gap:8px;}
  @keyframes slideup{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  .spinner{width:20px;height:20px;border:2px solid var(--line);border-top-color:var(--cyan);border-radius:50%;animation:spin .8s linear infinite;display:inline-block;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .connect-card{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-lg);padding:28px;display:flex;flex-direction:column;gap:20px;}
  .status-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--line);}
  .env-block{background:var(--bg1);border:1px solid var(--line);border-radius:var(--r);padding:16px;font-family:var(--font-mono);font-size:12px;line-height:1.8;color:var(--text1);}
  .env-block .key{color:var(--cyan);}.env-block .val{color:var(--amber);}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--bg1);}
  ::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:3px;}
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Badge({ type = "grey", children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}
function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="card card-sm">
      <div className="card-label">{label}</div>
      <div className="card-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}
function SectionTitle({ children }) {
  return <div className="section-title"><span>{children}</span></div>;
}
function Toggle({ on, onToggle }) {
  return <button className={`toggle ${on ? "on" : "off"}`} onClick={onToggle} />;
}
function Toast({ msg }) {
  return <div className="toast">✓ {msg}</div>;
}
function Spinner() {
  return <div className="spinner" />;
}
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div style={{ color: "var(--text1)", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => <div key={p.dataKey} style={{ color: p.color || "var(--cyan)" }}>{p.name}: ${Number(p.value).toFixed(2)}</div>)}
    </div>
  );
}
function TradeBadge({ type }) {
  const map = { BUY: "green", SELL: "red", HOLD: "grey", REBALANCE: "blue", SKIP: "amber" };
  return <Badge type={map[type] || "grey"}>{type}</Badge>;
}
function fmt$(n) { return n != null ? `$${Number(n).toFixed(2)}` : "—"; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : "—"; }

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", icon: "◈", label: "Dashboard" },
  { id: "signals",   icon: "⊡", label: "Signals" },
  { id: "history",   icon: "≋", label: "History" },
  { id: "config",    icon: "⊞", label: "Configuration" },
  { id: "connect",   icon: "⬡", label: "Connect" },
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
          <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`}
            onClick={() => setPage(n.id)} title={!sideOpen ? n.label : undefined}>
            <span className="nav-icon">{n.icon}</span>
            {sideOpen && <span>{n.label}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="nav-item" onClick={() => setSideOpen(o => !o)}>
          <span className="nav-icon">{sideOpen ? "←" : "→"}</span>
          {sideOpen && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────────────────────

const PAGE_TITLES = { dashboard:"Dashboard", signals:"Signals & Strategy", history:"Trade History", config:"Configuration", connect:"Connect to Coinbase", logs:"System Logs" };

function Topbar() {
  const { page, portfolio, config, loading, lastRefresh, refresh } = useContext(AppCtx);
  const isDryRun = portfolio?.dry_run !== false;
  const ts = lastRefresh ? lastRefresh.toLocaleTimeString() : "—";
  return (
    <div className="topbar">
      <div className="topbar-title">{PAGE_TITLES[page]}</div>
      {loading ? <Spinner /> : (
        <>
          <Badge type="green"><span className="dot pulse" />RUNNING</Badge>
          {isDryRun ? <Badge type="amber">DRY RUN</Badge> : <Badge type="red">LIVE</Badge>}
          {config?.coinbase_configured ? <Badge type="cyan">API ✓</Badge> : <Badge type="red">API ✗</Badge>}
        </>
      )}
      <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>↺ {ts}</span>
      <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={refresh}>Refresh</button>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard() {
  const { portfolio, loading, setPage } = useContext(AppCtx);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalResult, setRebalResult] = useState(null);

  async function forceRebalance() {
    setRebalancing(true);
    try {
      const r = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dashboard": "true" }
      });
      const data = await r.json();
      setRebalResult(data.action + (data.trades?.length ? ` — ${data.trades.length} trade(s)` : ""));
      setTimeout(() => setRebalResult(null), 4000);
    } catch (e) {
      setRebalResult("Error: " + e.message);
    } finally {
      setRebalancing(false);
    }
  }

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}><Spinner /><span style={{ color: "var(--text1)" }}>Loading portfolio…</span></div>;

  if (!portfolio?.initialized) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Bot not initialized yet</div>
        <div style={{ color: "var(--text1)", marginBottom: 24 }}>Configure your Coinbase API keys first, then trigger an initial rebalance.</div>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={() => setPage("connect")}>→ Connect API</button>
          <button className="btn btn-primary" onClick={forceRebalance} disabled={rebalancing}>
            {rebalancing ? <Spinner /> : "▶ Run First Rebalance"}
          </button>
        </div>
      </div>
    );
  }

  const p       = portfolio;
  const positive = p.pnl >= 0;

  return (
    <div className="page-gap">
      <div className="grid-4">
        <KpiCard label="Total Equity" value={fmt$(p.total_equity)}
          sub={<span className={positive ? "green" : "red"}>{positive ? "+" : ""}{fmt$(p.pnl)} ({fmtPct(p.pnl_pct)})</span>} />
        <KpiCard label="Cash Available" value={fmt$(p.cash_usd)} sub={`${fmtPct(p.cash_usd / p.total_equity * 100)} of portfolio`} />
        <KpiCard label="Invested" value={fmt$(p.invested)} sub={`${fmtPct(p.invested / p.total_equity * 100)} of portfolio`} />
        <KpiCard label="Cumul. Fees" value={fmt$(p.cumulative_fees)} sub="Taker + slippage (simulated)" />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-label">Portfolio Allocation</div>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>Last rebalance: {p.last_rebalance || "—"}</span>
        </div>
        {Object.entries(p.positions || {}).map(([asset, pos]) => (
          <div key={asset} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}><Badge type="cyan">{asset}</Badge></span>
              <span className="mono" style={{ fontSize: 12 }}>{pos.units?.toFixed(6)} units · {fmtPct(pos.weight * 100)}</span>
            </div>
            <div className="prog-bar"><div className="prog-fill" style={{ width: `${(pos.weight || 0) * 100}%`, background: "var(--cyan)" }} /></div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text1)" }}>USD Cash</span>
            <span className="mono" style={{ fontSize: 12 }}>{fmtPct(p.cash_usd / p.total_equity * 100)}</span>
          </div>
          <div className="prog-bar"><div className="prog-fill" style={{ width: `${p.cash_usd / p.total_equity * 100}%`, background: "var(--text2)" }} /></div>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={forceRebalance} disabled={rebalancing} style={{ minWidth: 180 }}>
          {rebalancing ? <><Spinner /> Running…</> : "⚡ Force Rebalance Now"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text1)" }}>Auto-check every 8h via GitHub Actions</span>
        {rebalResult && <Badge type="green">{rebalResult}</Badge>}
      </div>

      {rebalResult && <Toast msg={rebalResult} />}
    </div>
  );
}

// ─── SIGNALS ─────────────────────────────────────────────────────────────────

function Signals() {
  const { signals, loading } = useContext(AppCtx);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner /></div>;
  if (!signals.length) return <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text1)" }}>No signals yet — run a rebalance first.</div>;

  return (
    <div className="page-gap">
      <div className="grid-2">
        {signals.map(s => (
          <div key={s.asset} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div className="card-label">{s.asset}</div>
                <div className="card-value mono">${Number(s.price).toLocaleString()}</div>
              </div>
              <Badge type={s.eligible ? "green" : "red"}>{s.eligible ? "ELIGIBLE" : "EXCLUDED"}</Badge>
            </div>
            {[
              ["MA-200", `$${Number(s.ma200).toLocaleString()}`, "var(--text1)"],
              ["Price > MA200", s.price > s.ma200 ? "✓ YES" : "✗ NO", s.price > s.ma200 ? "var(--green)" : "var(--red)"],
              ["Momentum 90d", s.momentum !== null ? `${Number(s.momentum).toFixed(2)}%` : "—", Number(s.momentum) > 0 ? "var(--green)" : "var(--red)"],
              ["Volatility 20d", s.vol !== null ? `${Number(s.vol).toFixed(2)}%` : "—", "var(--amber)"],
              ["Target Weight", s.adjWeight ? fmtPct(s.adjWeight * 100) : "0%", s.adjWeight > 0 ? "var(--cyan)" : "var(--text2)"],
              ["Selected", s.selected ? "✓ YES" : "NO", s.selected ? "var(--green)" : "var(--text2)"],
            ].map(([k, v, c]) => (
              <div key={k} className="signal-row">
                <span className="signal-key">{k}</span>
                <span className="signal-val" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-label" style={{ marginBottom: 12 }}>Strategy Pipeline</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { step: "01", title: "Trend Filter", icon: "↗", desc: `Asset price must be above MA-200 to be eligible.` },
            { step: "02", title: "Momentum Rank", icon: "⚡", desc: `Top-1 asset by 90-day return selected.` },
            { step: "03", title: "Vol Targeting", icon: "⊿", desc: `Weight = 1/vol, capped at 80% exposure.` },
          ].map(s => (
            <div key={s.step} style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text2)" }}>STEP {s.step}</span>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text1)", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────

function History() {
  const { trades, loading } = useContext(AppCtx);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const filtered = trades.filter(t => {
    const matchType = filter === "ALL" || t.type === filter;
    const q = search.toLowerCase();
    return matchType && (!q || JSON.stringify(t).toLowerCase().includes(q));
  });

  return (
    <div className="page-gap">
      <div className="filter-bar">
        <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        {["ALL","BUY","SELL","HOLD","REBALANCE"].map(t => (
          <button key={t} className={`filter-btn ${filter===t?"active":""}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text2)" }}>{loading ? "Loading…" : `${filtered.length} result(s)`}</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr>{["Date","Type","Asset","Qty","Price","Notional","Fee","Slippage","Cash After","Equity After","P&L","Comment"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign:"center", padding:32, color:"var(--text2)" }}>{loading ? "Loading…" : "No trades yet."}</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={i}>
                <td className="mono text-muted" style={{fontSize:11}}>{t.timestamp}</td>
                <td><TradeBadge type={t.type} /></td>
                <td className="mono">{t.asset && t.asset !== "—" ? <Badge type="cyan">{t.asset}</Badge> : "—"}</td>
                <td className="mono text-right">{t.quantity > 0 ? Number(t.quantity).toFixed(6) : "—"}</td>
                <td className="mono text-right">{t.price > 0 ? `$${Number(t.price).toLocaleString()}` : "—"}</td>
                <td className="mono text-right">{t.notional > 0 ? fmt$(t.notional) : "—"}</td>
                <td className="mono text-right amber">{t.fee > 0 ? fmt$(t.fee) : "—"}</td>
                <td className="mono text-right text-muted">{t.slippage > 0 ? fmt$(t.slippage) : "—"}</td>
                <td className="mono text-right">{fmt$(t.cash_after)}</td>
                <td className="mono text-right">{fmt$(t.equity_after)}</td>
                <td className={`mono text-right ${t.pnl >= 0 ? "green" : "red"}`}>{t.pnl != null ? fmt$(t.pnl) : "—"}</td>
                <td style={{color:"var(--text1)",fontSize:11,maxWidth:180}}>{t.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONNECT PAGE ─────────────────────────────────────────────────────────────

function Connect() {
  const { config, refresh } = useContext(AppCtx);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function testConn() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testConnection" })
      });
      const d = await r.json();
      setTestResult(d);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  }

  const isConfigured = config?.coinbase_configured;

  return (
    <div className="page-gap">
      {/* Status */}
      <div className="card">
        <SectionTitle>Connection Status</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="status-row">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Coinbase API Keys</span>
            {isConfigured ? <Badge type="green">✓ Configured</Badge> : <Badge type="red">✗ Missing</Badge>}
          </div>
          <div className="status-row">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Google Sheets</span>
            <Badge type="green">✓ Connected</Badge>
          </div>
          <div className="status-row">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Trading Mode</span>
            {config?.DRY_RUN !== "false" ? <Badge type="amber">DRY RUN (Paper)</Badge> : <Badge type="red">LIVE TRADING</Badge>}
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={testConn} disabled={testing}>
            {testing ? <><Spinner /> Testing…</> : "⟳ Test Coinbase Connection"}
          </button>
          {testResult && (
            testResult.ok
              ? <Badge type="green">✓ Connected — {testResult.accountCount} account(s)</Badge>
              : <Badge type="red">✗ {testResult.error}</Badge>
          )}
        </div>
      </div>

      {/* Setup instructions */}
      <div className="card">
        <SectionTitle>Setup — Vercel Environment Variables</SectionTitle>
        <p style={{ fontSize: 13, color: "var(--text1)", marginBottom: 16, lineHeight: 1.6 }}>
          Your Coinbase API keys are stored securely as <strong style={{ color: "var(--text0)" }}>Vercel Environment Variables</strong> — they never appear in your code or in the browser.
        </p>
        <p style={{ fontSize: 13, color: "var(--text1)", marginBottom: 16, lineHeight: 1.6 }}>
          Go to <strong style={{ color: "var(--cyan)" }}>vercel.com → Your Project → Settings → Environment Variables</strong> and add these:
        </p>
        <div className="env-block">
          <div><span className="key">COINBASE_KEY_NAME</span> = <span className="val">organizations/xxx/apiKeys/yyy</span> &nbsp;<span style={{ color: "var(--text2)", fontSize: 11 }}>← "name" field from your JSON key file</span></div>
          <div><span className="key">COINBASE_PRIVATE_KEY</span> = <span className="val">-----BEGIN EC PRIVATE KEY-----\n...</span> &nbsp;<span style={{ color: "var(--text2)", fontSize: 11 }}>← "privateKey" field (keep newlines as \n)</span></div>
          <div style={{ marginTop: 8 }}><span className="key">CRON_SECRET</span> = <span className="val">a-random-secret-string</span> &nbsp;<span style={{ color: "var(--text2)", fontSize: 11 }}>← protects /api/rebalance from random callers</span></div>
          <div><span className="key">DRY_RUN</span> = <span className="val">true</span> &nbsp;<span style={{ color: "var(--text2)", fontSize: 11 }}>← set to false to enable live trading</span></div>
          <div><span className="key">PRODUCT_IDS</span> = <span className="val">BTC-USD,ETH-USD</span></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 12 }}>After adding variables → click <strong>Save</strong> → Vercel will redeploy automatically.</p>
      </div>

      {/* GitHub Actions setup */}
      <div className="card">
        <SectionTitle>Setup — GitHub Actions Cron (Auto-check every 8h)</SectionTitle>
        <p style={{ fontSize: 13, color: "var(--text1)", marginBottom: 16, lineHeight: 1.6 }}>
          The file <code style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 4, color: "var(--cyan)" }}>.github/workflows/cron.yml</code> is already in your repo. Add these <strong style={{ color: "var(--text0)" }}>GitHub Secrets</strong>:
        </p>
        <div className="env-block">
          <div><span className="key">VERCEL_APP_URL</span> = <span className="val">https://your-app.vercel.app</span></div>
          <div><span className="key">CRON_SECRET</span> = <span className="val">same value as in Vercel</span></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 12 }}>
          GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret
        </p>
      </div>

      {/* Live trading warning */}
      <div className="card" style={{ borderColor: "rgba(248,81,73,.3)" }}>
        <SectionTitle>⚠ Enabling Live Trading</SectionTitle>
        <p style={{ fontSize: 13, color: "var(--text1)", lineHeight: 1.6 }}>
          When you're ready to go live, change <code style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 4, color: "var(--red)" }}>DRY_RUN</code> to <code style={{ background: "var(--bg3)", padding: "2px 6px", borderRadius: 4, color: "var(--red)" }}>false</code> in Vercel Environment Variables. Real orders will be placed on Coinbase using your API key. Make sure your Coinbase API key has <strong style={{ color: "var(--text0)" }}>trade permissions</strong> enabled.
        </p>
      </div>
    </div>
  );
}

// ─── CONFIG PAGE ─────────────────────────────────────────────────────────────

function Config() {
  const { config } = useContext(AppCtx);
  const [saved, setSaved] = useState(false);

  if (!config) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner /></div>;

  return (
    <div className="page-gap">
      <div className="card">
        <p style={{ fontSize: 13, color: "var(--text1)", lineHeight: 1.6 }}>
          Configuration is managed via <strong style={{ color: "var(--cyan)" }}>Vercel Environment Variables</strong>. The values below are read-only — they reflect what's currently active. To change them, update the env vars in your Vercel project settings and redeploy.
        </p>
      </div>

      {[
        ["Assets & Universe",
          [["PRODUCT_IDS","Traded pairs (comma-separated)"], ["TOP_K","Max assets held simultaneously"]]
        ],
        ["Strategy Parameters",
          [["TREND_MA_DAYS","MA trend filter (days)"], ["MOMENTUM_DAYS","Momentum lookback (days)"],
           ["VOL_DAYS","Volatility window (days)"], ["MAX_GROSS_EXPOSURE","Max invested fraction (0–1)"],
           ["MIN_VOL_FLOOR","Min vol floor (avoid div/0)"]]
        ],
        ["Fees & Execution",
          [["FEE_TAKER_BPS","Taker fee (bps, 60=0.60%)"], ["FEE_MAKER_BPS","Maker fee (bps)"],
           ["SLIPPAGE_BPS","Slippage (bps)"], ["USE_TAKER_FEES","Use taker fee model"]]
        ],
        ["Execution Mode",
          [["DRY_RUN","Paper trading (no real orders)"], ["PAPER_START_CASH_USD","Starting cash ($)"]]
        ],
      ].map(([section, fields]) => (
        <div key={section} className="card">
          <SectionTitle>{section}</SectionTitle>
          <div className="field-group">
            {fields.map(([k, desc]) => (
              <div key={k} className="field">
                <label>{k}</label>
                <input value={config[k] ?? "—"} readOnly style={{ opacity: .8 }} />
                <div className="hint">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LOGS ─────────────────────────────────────────────────────────────────────

function Logs() {
  const { logs, loading } = useContext(AppCtx);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const levelColors = { INFO: "var(--cyan)", WARN: "var(--amber)", ERROR: "var(--red)", SCRIPT: "var(--text1)" };

  const filtered = logs.filter(l => levelFilter === "ALL" || l.level === levelFilter);

  return (
    <div className="page-gap">
      <div className="filter-bar">
        {["ALL","INFO","WARN","ERROR"].map(l => (
          <button key={l} className={`filter-btn ${levelFilter===l?"active":""}`} onClick={() => setLevelFilter(l)}>{l}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text2)" }}>
          {loading ? "Loading…" : `${filtered.length} entries`}
        </span>
      </div>
      <div style={{ background: "var(--bg1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 4, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text2)" }}>No logs yet — run a rebalance first.</div>
        ) : filtered.map((l, i) => (
          <div key={i} style={{
            padding: "6px 14px",
            borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
            display: "flex", gap: 14, alignItems: "flex-start",
            background: l.level === "ERROR" ? "rgba(248,81,73,.05)" : l.level === "WARN" ? "rgba(227,179,65,.05)" : "transparent"
          }}>
            <span style={{ color: "var(--text2)", whiteSpace: "nowrap", fontSize: 11, minWidth: 170 }}>{l.timestamp}</span>
            <span style={{ color: levelColors[l.level] || "var(--text1)", fontWeight: 700, minWidth: 50 }}>{l.level}</span>
            {l.run_id && <span style={{ color: "var(--text2)", fontSize: 10, minWidth: 60 }}>[{l.run_id}]</span>}
            <span style={{ color: "var(--text0)", lineHeight: 1.5 }}>{l.message}</span>
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
    case "connect":   return <Connect />;
    case "logs":      return <Logs />;
    default:          return <Dashboard />;
  }
}


// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

const LOGIN_CSS = `
  .login-wrap{min-height:100vh;background:var(--bg0);display:flex;align-items:center;justify-content:center;}
  .login-box{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-lg);padding:48px 40px;width:100%;max-width:380px;display:flex;flex-direction:column;align-items:center;gap:22px;}
  .login-logo{width:52px;height:52px;background:var(--cyan);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:4px;}
  .login-title{font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--text0);text-align:center;}
  .login-sub{font-size:13px;color:var(--text1);text-align:center;margin-top:-14px;}
  .login-input{width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:var(--r);color:var(--text0);padding:12px 16px;font-size:14px;font-family:var(--font-mono);outline:none;transition:border-color .2s;letter-spacing:.15em;}
  .login-input:focus{border-color:var(--cyan);}
  .login-input.error{border-color:var(--red);}
  .login-btn{width:100%;background:var(--cyan);color:#000;border:none;border-radius:var(--r);padding:12px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s;font-family:var(--font-sans);}
  .login-btn:hover{opacity:.88;}
  .login-btn:disabled{opacity:.5;cursor:not-allowed;}
  .login-error{font-size:12px;color:var(--red);text-align:center;font-family:var(--font-mono);min-height:18px;}
  .login-footer{font-size:11px;color:var(--text2);text-align:center;}
`;

const SESSION_KEY = "cb_bot_auth";

function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ password }),
      });
      const d = await r.json();
      if (d.ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        onSuccess();
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <style>{LOGIN_CSS}</style>
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="login-logo">&#x26A1;</div>
        <div className="login-title">CryptoBot Dashboard</div>
        <div className="login-sub">Enter your password to continue</div>
        <input
          className={`login-input ${error ? "error" : ""}`}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(""); }}
          autoFocus
        />
        <div className="login-error">{error}</div>
        <button className="login-btn" type="submit" disabled={loading || !password}>
          {loading ? "Verifying..." : "Enter"}
        </button>
        <div className="login-footer">Protected dashboard — authorized access only</div>
      </form>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "1"
  );

  if (!authed) return (
    <>
      <style>{css}</style>
      <LoginScreen onSuccess={() => setAuthed(true)} />
    </>
  );

  return (
    <AppProvider>
      <style>{css}</style>
      <div className="app">
        <Sidebar />
        <div className="main">
          <Topbar />
          <div className="content"><PageContent /></div>
        </div>
      </div>
    </AppProvider>
  );
}
