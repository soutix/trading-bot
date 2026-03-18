import React, { useState, useEffect } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg0:       "#060d1a",
  bg1:       "#0d1422",
  bg2:       "#080e1a",
  border:    "#1a2744",
  borderMid: "#243555",
  text:      "#cbd5e1",
  textMuted: "#3b5278",
  textDim:   "#2a3a52",
  cyan:      "#38bdf8",
  green:     "#4ade80",
  greenDark: "#14532d",
  greenBg:   "#052e16",
  red:       "#f87171",
  redDark:   "#5c1010",
  redBg:     "#2d0606",
  amber:     "#f59e0b",
  amberDark: "#92400e",
  amberBg:   "#422a0a",
  white:     "#f1f5f9",
  blue:      "#2563eb",
  blueBg:    "#0d1f47",
  blueMid:   "#0c2d4a",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes pulse-live {
    0%   { box-shadow: 0 0 0 0   rgba(74,222,128,0.7); }
    70%  { box-shadow: 0 0 0 7px rgba(74,222,128,0); }
    100% { box-shadow: 0 0 0 0   rgba(74,222,128,0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .cb-live-dot {
    width: 9px; height: 9px;
    background: ${C.green}; border-radius: 50%;
    animation: pulse-live 2s infinite;
    flex-shrink: 0;
  }
  .cb-tab {
    padding: 6px 14px;
    background: transparent; color: ${C.textMuted};
    border: 1px solid transparent; border-bottom: none;
    border-radius: 5px 5px 0 0;
    font-size: 11px; font-family: 'IBM Plex Mono', monospace;
    cursor: pointer; transition: color 0.15s, background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .cb-tab:hover  { color: ${C.cyan}; }
  .cb-tab.active { color: ${C.cyan}; background: ${C.blueBg}; border-color: ${C.blue}; }

  .cb-kpi {
    background: ${C.bg1}; border: 1px solid ${C.border};
    border-radius: 8px; padding: 12px 14px;
    transition: border-color 0.15s;
  }
  .cb-kpi:hover { border-color: ${C.borderMid}; }

  .cb-btn-primary {
    background: ${C.amberDark}; border: none; color: #fef3c7;
    padding: 7px 13px; border-radius: 6px;
    font-size: 11px; font-weight: 600;
    font-family: 'IBM Plex Mono', monospace;
    cursor: pointer; transition: opacity 0.15s;
  }
  .cb-btn-primary:hover  { opacity: 0.85; }
  .cb-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .cb-btn-ghost {
    background: ${C.blueBg}; border: 1px solid ${C.borderMid}; color: ${C.cyan};
    padding: 7px 11px; border-radius: 6px;
    font-size: 13px; font-family: 'IBM Plex Mono', monospace;
    cursor: pointer; transition: opacity 0.15s;
  }
  .cb-btn-ghost:hover { opacity: 0.85; }

  .cb-filter {
    background: transparent; color: ${C.text};
    border: 1px solid ${C.border};
    padding: 3px 10px; border-radius: 4px;
    font-size: 9px; font-family: 'IBM Plex Mono', monospace;
    cursor: pointer; transition: all 0.15s;
  }
  .cb-filter:hover { border-color: ${C.borderMid}; }
  .cb-filter.active-analysis { background: ${C.blueBg};  color: ${C.cyan};  border-color: ${C.blue}; }
  .cb-filter.active-trade    { background: ${C.greenBg}; color: ${C.green}; border-color: ${C.greenDark}; }
  .cb-filter.active-error    { background: ${C.redBg};   color: ${C.red};   border-color: ${C.redDark}; }
  .cb-filter.active-info     { background: #1e1040;      color: #a78bfa;    border-color: #4c1d95; }
  .cb-filter.active-all      { background: ${C.bg2};     color: ${C.white}; border-color: ${C.borderMid}; }

  .cb-log-row { transition: background 0.1s; }
  .cb-log-row:hover { background: ${C.bg2}; }

  .cb-param {
    background: ${C.bg2}; border-radius: 6px; padding: 10px;
    transition: background 0.15s;
  }
  .cb-param:hover { background: #0d1625; }

  .cb-tr:hover td { background: #0a0f1c; }
  .cb-tr td { transition: background 0.1s; }

  .cb-spinning { animation: spin 1s linear infinite; display: inline-block; }

  .cb-badge-long  { background: ${C.greenBg}; color: ${C.green}; border: 1px solid ${C.greenDark}; }
  .cb-badge-short { background: ${C.redBg};   color: ${C.red};   border: 1px solid ${C.redDark}; }
  .cb-badge-cash  { background: #1e293b;       color: #94a3b8;   border: 1px solid #334155; }

  .cb-progress-bg { background: ${C.bg2}; border-radius: 3px; height: 5px; }
  .cb-scrollable  { overflow-y: auto; max-height: 420px; }
  .cb-scrollable::-webkit-scrollbar { width: 4px; }
  .cb-scrollable::-webkit-scrollbar-track { background: transparent; }
  .cb-scrollable::-webkit-scrollbar-thumb { background: ${C.borderMid}; border-radius: 2px; }
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt  = (n, d = 2) => n != null && !isNaN(n) ? parseFloat(n).toFixed(d) : "-";
const fmtK = (n) => {
  if (n == null || isNaN(n)) return "-";
  const v = parseFloat(n);
  return v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(2);
};
const fmtDate = (s) => {
  if (!s) return "-";
  try { return new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }); }
  catch { return s; }
};
const fmtTime = (s) => {
  if (!s) return "-";
  try { return new Date(s).toLocaleTimeString("fr-FR"); }
  catch { return s; }
};
const modeLabel = (m) => (m === "LONG" ? "▲ LONG" : m === "SHORT" ? "▼ SHORT" : "— CASH");

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{ fontSize: 8, color: C.textMuted, letterSpacing: "1.5px", marginBottom: 5, fontFamily: "IBM Plex Mono, monospace" }}>
      {children}
    </div>
  );
}

function BigValue({ children, color = C.white }) {
  return (
    <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.2 }}>
      {children}
    </div>
  );
}

function Sub({ children, color = C.textMuted }) {
  return (
    <div style={{ fontSize: 9, color, marginTop: 4, fontFamily: "IBM Plex Mono, monospace" }}>
      {children}
    </div>
  );
}

function ModeBadge({ mode }) {
  const cls = mode === "LONG" ? "cb-badge-long" : mode === "SHORT" ? "cb-badge-short" : "cb-badge-cash";
  return (
    <span className={cls} style={{ padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "1.5px" }}>
      {modeLabel(mode)}
    </span>
  );
}

function Chip({ ok, label }) {
  return (
    <span style={{
      background: ok ? C.greenBg : C.redBg,
      color:      ok ? C.green   : C.red,
      border:    `1px solid ${ok ? C.greenDark : C.redDark}`,
      fontSize: 8, padding: "2px 7px", borderRadius: 3,
      fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.5px",
    }}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function LogBadge({ type }) {
  const map = {
    ANALYSIS: { bg: C.blueMid,  color: C.cyan,  text: "ANALYSIS" },
    TRADE:    { bg: C.greenBg,  color: C.green, text: "TRADE" },
    ERROR:    { bg: C.redBg,    color: C.red,   text: "ERROR" },
    INFO:     { bg: "#1e1040",  color: "#a78bfa", text: "INFO" },
  };
  const s = map[type] || { bg: C.bg2, color: C.text, text: type };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 8, padding: "1px 6px", borderRadius: 3,
      minWidth: 58, textAlign: "center", flexShrink: 0, alignSelf: "flex-start",
      fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.5px",
    }}>
      {s.text}
    </span>
  );
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg0, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "IBM Plex Mono, monospace" }}>
      <div className="cb-spinning" style={{ width: 28, height: 28, border: `2px solid ${C.borderMid}`, borderTopColor: C.cyan, borderRadius: "50%" }} />
      <span style={{ fontSize: 12, color: C.textMuted, letterSpacing: "2px" }}>INITIALISATION...</span>
    </div>
  );
}

// ─── TAB: DASHBOARD ──────────────────────────────────────────────────────────
function TabDashboard({ botState, portfolio, logs }) {
  const latestAnalysis = logs.find((l) => l.log_type === "ANALYSIS" || l.log_type === "INFO") || logs[0];

  // P&L ouvert calculé
  const entryPrice   = parseFloat(botState.entry_price)   || 0;
  const trailStop    = parseFloat(botState.trailing_stop_level) || 0;
  const posSize      = parseFloat(botState.position_size) || 0;
  const currentPrice = parseFloat(portfolio?.currentPrice) || 0;
  const balance      = parseFloat(portfolio?.balance)      || 0;
  const atr          = parseFloat(portfolio?.atr14)        || 0;

  let pnlUsd = 0, pnlPct = 0;
  if (entryPrice > 0 && currentPrice > 0 && posSize > 0) {
    if (botState.current_mode === "LONG")  { pnlUsd = (currentPrice - entryPrice) * posSize; }
    if (botState.current_mode === "SHORT") { pnlUsd = (entryPrice - currentPrice) * posSize; }
    pnlPct = (pnlUsd / (entryPrice * posSize)) * 100;
  }
  const pnlPositive = pnlUsd >= 0;
  const positionUsd = entryPrice * posSize;

  // Ranking depuis le portfolio
  const ranking = portfolio?.ranking || [];

  // Conditions SHORT actives
  const conds = portfolio?.conditions || {};

  const trailDeltaPct = entryPrice > 0 && trailStop > 0
    ? ((trailStop - (currentPrice || entryPrice)) / (currentPrice || entryPrice)) * 100
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ROW 1 — 6 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>

        <div className="cb-kpi">
          <Label>SOLDE USDC</Label>
          <BigValue>{balance > 0 ? `$${fmt(balance)}` : "—"}</BigValue>
          <Sub color={C.green}>● Testnet actif</Sub>
        </div>

        <div className="cb-kpi" style={{ borderColor: pnlUsd >= 0 ? "#14422a" : C.redDark }}>
          <Label>P&L OUVERT</Label>
          <BigValue color={botState.current_mode === "CASH" ? C.textMuted : pnlPositive ? C.green : C.red}>
            {botState.current_mode === "CASH" ? "—" : `${pnlPositive ? "+" : ""}$${fmt(Math.abs(pnlUsd))}`}
          </BigValue>
          <Sub color={botState.current_mode === "CASH" ? C.textMuted : pnlPositive ? C.green : C.red}>
            {botState.current_mode === "CASH" ? "Aucune position" : `${pnlPositive ? "+" : ""}${fmt(pnlPct)}% depuis entrée`}
          </Sub>
        </div>

        <div className="cb-kpi">
          <Label>POSITION</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.white, fontFamily: "IBM Plex Mono, monospace" }}>
              {botState.current_mode === "CASH" ? "—" : (botState.active_asset || "—")}
            </span>
            <ModeBadge mode={botState.current_mode} />
          </div>
          <Sub>{posSize > 0 ? `${fmt(posSize, 4)} ${botState.active_asset} · $${fmt(positionUsd)}` : "Aucune position ouverte"}</Sub>
        </div>

        <div className="cb-kpi">
          <Label>PRIX D'ENTRÉE</Label>
          <BigValue>{entryPrice > 0 ? `$${fmt(entryPrice)}` : "—"}</BigValue>
          <Sub>{currentPrice > 0 ? `Actuel : $${fmt(currentPrice)}` : ""}</Sub>
        </div>

        <div className="cb-kpi" style={{ borderColor: trailStop > 0 ? C.amberBg : C.border }}>
          <Label>TRAILING STOP</Label>
          <BigValue color={trailStop > 0 ? C.amber : C.textMuted}>
            {trailStop > 0 ? `$${fmt(trailStop)}` : "—"}
          </BigValue>
          <Sub color={C.amber}>
            {trailDeltaPct != null ? `${trailDeltaPct > 0 ? "+" : ""}${fmt(trailDeltaPct)}% vs cours actuel` : ""}
          </Sub>
        </div>

        <div className="cb-kpi">
          <Label>ATR (14)</Label>
          <BigValue>{atr > 0 ? `$${fmt(atr)}` : "—"}</BigValue>
          <Sub>{atr > 0 && entryPrice > 0 ? `Stop init : $${fmt(botState.current_mode === "SHORT" ? entryPrice + 1.5 * atr : entryPrice - 1.5 * atr)}` : ""}</Sub>
        </div>
      </div>

      {/* ROW 2 — Ranking + Analyse */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.5fr)", gap: 8 }}>

        {/* RANKING */}
        <div className="cb-kpi">
          <Label>RANKING MOMENTUM</Label>
          {ranking.length > 0 ? ranking.map((asset, i) => (
            <div key={asset.symbol} style={{ marginBottom: i < ranking.length - 1 ? 12 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? C.white : C.textMuted, fontFamily: "IBM Plex Mono, monospace" }}>
                  {asset.symbol}
                </span>
                <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: i === 0 ? C.red : C.textMuted }}>
                  {fmt(asset.score, 2)}
                  <span style={{
                    marginLeft: 5, fontSize: 8, padding: "1px 5px", borderRadius: 3,
                    background: i === 0 ? C.redBg   : C.bg2,
                    color:      i === 0 ? C.red      : C.textMuted,
                    border:    `1px solid ${i === 0 ? C.redDark : C.border}`,
                  }}>
                    {i === 0 ? botState.current_mode : "inactif"}
                  </span>
                </span>
              </div>
              <div className="cb-progress-bg">
                <div style={{
                  width: `${Math.min(100, Math.abs(asset.score) * 20)}%`, height: "100%",
                  background: i === 0 ? "#dc2626" : C.border, borderRadius: 3,
                }} />
              </div>
            </div>
          )) : (
            /* fallback hardcodé si pas de ranking dans portfolio */
            <div style={{ color: C.textMuted, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}>
              Données de ranking non disponibles.
            </div>
          )}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: C.textMuted, letterSpacing: "1px", fontFamily: "IBM Plex Mono, monospace" }}>BTC LIGHTHOUSE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: portfolio?.btcBullish ? C.green : C.red }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: portfolio?.btcBullish ? C.green : C.red, fontFamily: "IBM Plex Mono, monospace" }}>
                {portfolio?.btcBullish ? "HAUSSIER" : "BAISSIER"}
              </span>
            </div>
          </div>
        </div>

        {/* DERNIÈRE ANALYSE */}
        <div className="cb-kpi" style={{ borderColor: C.blueMid }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>DERNIÈRE ANALYSE</Label>
            <span style={{ fontSize: 8, color: C.textDim, fontFamily: "IBM Plex Mono, monospace" }}>
              {latestAnalysis?.timestamp ? fmtDate(latestAnalysis.timestamp) : "—"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.8, fontFamily: "IBM Plex Mono, monospace", marginBottom: 10 }}>
            {latestAnalysis ? latestAnalysis.message : "Aucune analyse disponible. Forcez un rebalance."}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Chip ok={conds.prixSousMA200  ?? (botState.current_mode === "SHORT")} label="Prix < MA200" />
            <Chip ok={conds.slopeNegatif   ?? (botState.current_mode === "SHORT")} label="Slope < 0" />
            <Chip ok={conds.btcBaissier    ?? !(portfolio?.btcBullish)}           label="BTC Bear" />
            <Chip ok={conds.fundingOk      ?? true}                               label="Funding OK" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: STRATÉGIE V2 ────────────────────────────────────────────────────────
function TabStrategy({ botState, portfolio }) {
  const isShort = botState.current_mode === "SHORT";
  const isLong  = botState.current_mode === "LONG";

  const params = [
    { label: "FENÊTRE ETH",    value: "90 bougies" },
    { label: "FENÊTRE SOL",    value: "60 bougies" },
    { label: "FENÊTRE BTC",    value: "120 bougies" },
    { label: "STOP INITIAL",   value: "1.5 × ATR" },
    { label: "TRAILING ACT.",  value: "≥ 2 × ATR" },
    { label: "TRAILING DIST.", value: "1.5 × ATR" },
    { label: "SIZING LONG",    value: "80% capital" },
    { label: "SIZING SHORT",   value: "40% capital" },
    { label: "RÉSEAU",         value: "Testnet", highlight: C.amber },
  ];

  const condLong = [
    { label: "Prix > MA200 + 1%", ok: isLong },
    { label: "Slope MA200 > 0",   ok: isLong },
    { label: "Ranking positif",   ok: isLong },
  ];
  const condShort = [
    { label: "Prix < MA200 − 1%",     ok: isShort },
    { label: "Slope MA200 < 0",       ok: isShort },
    { label: "BTC < BTC MA200",       ok: isShort },
    { label: "Funding Rate > −0.03%", ok: isShort },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* LONG / SHORT conditions */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
        <div className="cb-kpi" style={{ borderColor: isLong ? C.greenDark : C.border }}>
          <Label>CONDITIONS LONG · {isLong ? <span style={{ color: C.green }}>ACTIVE ✓</span> : <span style={{ color: C.textDim }}>inactives</span>}</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {condLong.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: c.ok ? "#86efac" : C.textDim, fontFamily: "IBM Plex Mono, monospace" }}>
                <span style={{ color: c.ok ? C.green : C.redDark }}>{c.ok ? "✓" : "✗"}</span>
                {c.label}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 8, color: C.textMuted, fontFamily: "IBM Plex Mono, monospace" }}>Sizing : 80% capital</div>
        </div>

        <div className="cb-kpi" style={{ borderColor: isShort ? C.redDark : C.border }}>
          <Label>CONDITIONS SHORT · {isShort ? <span style={{ color: C.green }}>ACTIVES ✓</span> : <span style={{ color: C.textDim }}>inactives</span>}</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {condShort.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: c.ok ? "#86efac" : C.textDim, fontFamily: "IBM Plex Mono, monospace" }}>
                <span style={{ color: c.ok ? C.green : C.redDark }}>{c.ok ? "✓" : "✗"}</span>
                {c.label}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 8, color: C.amber, fontFamily: "IBM Plex Mono, monospace" }}>Sizing : 40% capital</div>
        </div>
      </div>

      {/* PARAMS GRID */}
      <div className="cb-kpi">
        <Label>PARAMÈTRES STRATÉGIE</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 7, marginTop: 8 }}>
          {params.map((p) => (
            <div key={p.label} className="cb-param">
              <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", marginBottom: 4, fontFamily: "IBM Plex Mono, monospace" }}>{p.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.highlight || C.white, fontFamily: "IBM Plex Mono, monospace" }}>{p.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: HISTORIQUE TRADES ──────────────────────────────────────────────────
function TabTrades({ trades }) {
  const closed = trades.filter((t) => t.close_date || t.pnl_percentage != null);

  const winCount  = closed.filter((t) => parseFloat(t.pnl_percentage) > 0).length;
  const loseCount = closed.length - winCount;
  const winRate   = closed.length > 0 ? ((winCount / closed.length) * 100).toFixed(0) : null;
  const totalPnl  = closed.reduce((sum, t) => sum + (parseFloat(t.pnl_percentage) || 0), 0);
  const avgPnl    = closed.length > 0 ? (totalPnl / closed.length).toFixed(2) : null;

  const stats = [
    { label: "TRADES CLÔTURÉS", value: closed.length || "0" },
    { label: "WIN RATE",        value: winRate != null ? `${winRate}%` : "—",
      color: winRate >= 50 ? C.green : C.red },
    { label: "P&L TOTAL",       value: avgPnl != null ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "—",
      color: totalPnl >= 0 ? C.green : C.red },
    { label: "MOY. / TRADE",    value: avgPnl != null ? `${avgPnl > 0 ? "+" : ""}${avgPnl}%` : "—",
      color: parseFloat(avgPnl) >= 0 ? C.green : C.red },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} className="cb-kpi" style={{ textAlign: "center" }}>
            <Label>{s.label}</Label>
            <div style={{ fontSize: 18, fontWeight: 600, color: s.color || C.white, fontFamily: "IBM Plex Mono, monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="cb-kpi" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
              {["DATE CLÔTURE", "ACTIF", "DIR.", "ENTRÉE", "SORTIE", "P&L %"].map((h, i) => (
                <th key={h} style={{ padding: "9px 12px", textAlign: i >= 3 ? "right" : "left", color: C.textMuted, fontSize: 8, letterSpacing: "1px", fontWeight: 400, fontFamily: "IBM Plex Mono, monospace" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closed.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "28px", textAlign: "center", color: C.textDim, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}>
                  Aucun trade clôturé · position en cours le cas échéant
                </td>
              </tr>
            ) : (
              closed.map((t, i) => {
                const pnl = parseFloat(t.pnl_percentage);
                const pnlColor = isNaN(pnl) ? C.text : pnl >= 0 ? C.green : C.red;
                return (
                  <tr key={i} className="cb-tr" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 12px", color: C.text,     fontFamily: "IBM Plex Mono, monospace" }}>{fmtDate(t.close_date)}</td>
                    <td style={{ padding: "9px 12px", color: C.white,    fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>{t.asset}</td>
                    <td style={{ padding: "9px 12px", color: t.direction === "LONG" ? C.green : C.red, fontFamily: "IBM Plex Mono, monospace" }}>
                      {t.direction === "LONG" ? "▲" : "▼"} {t.direction}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.text, fontFamily: "IBM Plex Mono, monospace" }}>
                      {t.entry_price ? `$${fmt(t.entry_price)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.text, fontFamily: "IBM Plex Mono, monospace" }}>
                      {t.exit_price ? `$${fmt(t.exit_price)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: pnlColor, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>
                      {isNaN(pnl) ? "—" : `${pnl >= 0 ? "+" : ""}${fmt(pnl)}%`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: LOGS SYSTÈME ────────────────────────────────────────────────────────
function TabLogs({ logs }) {
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filters = [
    { key: "ALL",      label: "ALL",      cls: "active-all" },
    { key: "ANALYSIS", label: "ANALYSIS", cls: "active-analysis" },
    { key: "TRADE",    label: "TRADE",    cls: "active-trade" },
    { key: "ERROR",    label: "ERROR",    cls: "active-error" },
    { key: "INFO",     label: "INFO",     cls: "active-info" },
  ];

  const visible = activeFilter === "ALL" ? logs : logs.filter((l) => l.log_type === activeFilter);

  const msgColor = (type) => {
    if (type === "ERROR") return C.red;
    if (type === "ANALYSIS") return "#94a3b8";
    if (type === "TRADE") return C.green;
    if (type === "INFO") return "#a78bfa";
    return C.text;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <button
            key={f.key}
            className={`cb-filter ${activeFilter === f.key ? f.cls : ""}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
            {f.key !== "ALL" && (
              <span style={{ marginLeft: 5, opacity: 0.6 }}>
                ({logs.filter((l) => l.log_type === f.key).length})
              </span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 8, color: C.textDim, fontFamily: "IBM Plex Mono, monospace", alignSelf: "center" }}>
          {visible.length} entrée{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Terminal */}
      <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }} className="cb-scrollable">
        {visible.length === 0 ? (
          <div style={{ color: C.textDim, textAlign: "center", padding: "24px 0", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}>
            En attente de la première exécution du bot...
          </div>
        ) : (
          visible.map((log, i) => (
            <div
              key={i}
              className="cb-log-row"
              style={{ padding: "5px 4px", borderBottom: i < visible.length - 1 ? `1px solid ${C.bg1}` : "none", display: "flex", gap: 10, fontSize: 10 }}
            >
              <span style={{ color: C.textDim, minWidth: 72, flexShrink: 0, fontFamily: "IBM Plex Mono, monospace" }}>
                [{fmtTime(log.timestamp)}]
              </span>
              <LogBadge type={log.log_type} />
              <span style={{ color: msgColor(log.log_type), fontFamily: "IBM Plex Mono, monospace", wordBreak: "break-word" }}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("Dashboard");
  const [data, setData]             = useState({ portfolio: null, trades: [], logs: [] });
  const [loading, setLoading]       = useState(true);
  const [timeToNext, setTimeToNext] = useState("");
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [lastRefresh, setLastRefresh]     = useState(null);

  // ── DATA FETCH ──
  const fetchAll = async () => {
    try {
      const [portfolioRes, tradesRes, logsRes] = await Promise.all([
        fetch("/api/portfolio").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/trades").then((r)    => (r.ok ? r.json() : [])),
        fetch("/api/logs").then((r)      => (r.ok ? r.json() : [])),
      ]);
      setData({ portfolio: portfolioRes, trades: tradesRes || [], logs: logsRes || [] });
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── COUNTDOWN ──
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h   = now.getUTCHours();
      let nextH = 8;
      if (h >= 8  && h < 16) nextH = 16;
      else if (h >= 16)      nextH = 24;
      const next = new Date(now);
      next.setUTCHours(nextH, 0, 0, 0);
      const d   = next - now;
      const pad = (n) => String(n).padStart(2, "0");
      setTimeToNext(`${pad(Math.floor(d / 3600000))}h ${pad(Math.floor((d % 3600000) / 60000))}m ${pad(Math.floor((d % 60000) / 1000))}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── REBALANCE ──
  const handleForceRebalance = async () => {
    if (!window.confirm("Forcer une analyse du marché maintenant ?")) return;
    setIsRebalancing(true);
    try {
      await fetch("/api/rebalance", { method: "POST" });
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du rebalance. Consultez la console.");
    } finally {
      setIsRebalancing(false);
    }
  };

  // ── DERIVED STATE ──
  const botState = data.portfolio?.botState || {
    current_mode: "CASH", active_asset: "-", entry_price: 0, trailing_stop_level: 0, position_size: 0,
  };
  const logs   = Array.isArray(data.logs)   ? data.logs   : [];
  const trades = Array.isArray(data.trades) ? data.trades : [];

  const TABS = ["Dashboard", "Stratégie V2", "Historique Trades", "Logs Système"];

  if (loading) return <><style>{STYLES}</style><LoadingScreen /></>;

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ minHeight: "100vh", backgroundColor: C.bg0, color: C.text, fontFamily: "IBM Plex Mono, monospace", display: "flex", flexDirection: "column" }}>

        {/* ── HEADER ── */}
        <div style={{ background: C.bg1, padding: "11px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>

          {/* Left: branding */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="cb-live-dot" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, letterSpacing: "1px" }}>CRYPTOBOT V2</div>
              <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: "1.5px", marginTop: 1 }}>HYPERLIQUID · SUPABASE · TESTNET</div>
            </div>
          </div>

          {/* Center: countdown */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: C.textMuted, letterSpacing: "2px", marginBottom: 2 }}>PROCHAIN CYCLE</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.cyan, letterSpacing: "2px" }}>{timeToNext}</div>
          </div>

          {/* Right: mode badge + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ModeBadge mode={botState.current_mode} />
            <button className="cb-btn-primary" onClick={handleForceRebalance} disabled={isRebalancing}>
              {isRebalancing ? <><span className="cb-spinning">↻</span> Analyse...</> : "⚡ REBALANCE"}
            </button>
            <button className="cb-btn-ghost" onClick={fetchAll} title="Rafraîchir les données">↻</button>
          </div>
        </div>

        {/* ── TABS BAR ── */}
        <div style={{ display: "flex", gap: 2, padding: "10px 20px 0", background: C.bg1, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t} className={`cb-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          {lastRefresh && (
            <span style={{ marginLeft: "auto", fontSize: 8, color: C.textDim, alignSelf: "center", paddingBottom: 8, paddingRight: 4, whiteSpace: "nowrap" }}>
              Rafraîchi à {lastRefresh.toLocaleTimeString("fr-FR")}
            </span>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
          {tab === "Dashboard"         && <TabDashboard  botState={botState} portfolio={data.portfolio} logs={logs} />}
          {tab === "Stratégie V2"      && <TabStrategy   botState={botState} portfolio={data.portfolio} />}
          {tab === "Historique Trades" && <TabTrades     trades={trades} />}
          {tab === "Logs Système"      && <TabLogs       logs={logs} />}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: C.bg1, borderTop: `1px solid ${C.border}`, padding: "5px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 8, color: C.textDim }}>CryptoBot V2 · bot-trading-rust.vercel.app</span>
          <span style={{ fontSize: 8, color: C.textDim }}>
            {logs.length} logs · {trades.length} trades
          </span>
        </div>
      </div>
    </>
  );
}