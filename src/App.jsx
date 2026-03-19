import React, { useState, useEffect, useRef } from "react";

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

  .cb-login-input {
    background: ${C.bg2}; border: 1px solid ${C.borderMid}; color: ${C.white};
    padding: 10px 14px; border-radius: 6px; width: 100%;
    font-size: 13px; font-family: 'IBM Plex Mono', monospace;
    outline: none; transition: border-color 0.15s;
  }
  .cb-login-input:focus { border-color: ${C.cyan}; }
  .cb-login-input::placeholder { color: ${C.textMuted}; }
  .cb-login-btn {
    background: ${C.blue}; border: none; color: ${C.white};
    padding: 10px; border-radius: 6px; width: 100%;
    font-size: 12px; font-weight: 600; font-family: 'IBM Plex Mono', monospace;
    cursor: pointer; transition: opacity 0.15s; letter-spacing: 1px;
  }
  .cb-login-btn:hover { opacity: 0.85; }
  .cb-login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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



// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pwd, setPwd]       = React.useState("");
  const [error, setError]   = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const mono = "IBM Plex Mono, monospace";

  const handleSubmit = async () => {
    if (!pwd) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (res.ok) {
        const { token } = await res.json();
        sessionStorage.setItem("cb_token", token);
        onLogin(token);
      } else {
        setError("Mot de passe incorrect.");
        setPwd("");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono }}>
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 9, height: 9, background: "#4ade80", borderRadius: "50%", boxShadow: "0 0 0 3px rgba(74,222,128,0.2)" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "2px" }}>CRYPTOBOT V2</span>
          </div>
          <div style={{ fontSize: 9, color: "#3b5278", letterSpacing: "2px" }}>HYPERLIQUID · SUPABASE · TESTNET</div>
        </div>

        {/* Card */}
        <div style={{ background: "#0d1422", border: "1px solid #1a2744", borderRadius: 10, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 9, color: "#3b5278", letterSpacing: "2px", textAlign: "center" }}>ACCÈS SÉCURISÉ</div>

          <input
            className="cb-login-input"
            type="password"
            placeholder="Mot de passe"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError(""); }}
            onKeyDown={handleKey}
            autoFocus
          />

          {error && (
            <div style={{ fontSize: 10, color: "#f87171", textAlign: "center", padding: "6px", background: "#2d0606", borderRadius: 4, border: "1px solid #5c1010" }}>
              {error}
            </div>
          )}

          <button className="cb-login-btn" onClick={handleSubmit} disabled={loading || !pwd}>
            {loading ? "VÉRIFICATION..." : "SE CONNECTER"}
          </button>
        </div>

        <div style={{ fontSize: 8, color: "#2a3a52", textAlign: "center" }}>
          Session valable 24h · Mot de passe via variable DASHBOARD_PASSWORD
        </div>
      </div>
    </div>
  );
}

// ─── CHART: PRICE + MA200 + STOPS ────────────────────────────────────────────
function PriceChart({ candles, entryPrice, stopLevel, ma200, mode, currentPrice }) {
  const mono = "IBM Plex Mono, monospace";
  if (!candles || candles.length < 5) {
    return (
      <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 10, fontFamily: mono }}>
        Chargement des données de marché...
      </div>
    );
  }
  const closes  = candles.map(c => parseFloat(c.close));
  const W = 560, H = 170, PL = 8, PR = 56, PT = 12, PB = 18;
  const plotW   = W - PL - PR;
  const plotH   = H - PT - PB;

  const refs    = [entryPrice, stopLevel, ma200, currentPrice].filter(v => v > 0);
  const allVals = [...closes, ...refs];
  const minV    = Math.min(...allVals) * 0.997;
  const maxV    = Math.max(...allVals) * 1.003;
  const range   = maxV - minV || 1;

  const xS = i  => (PL + (i / (closes.length - 1)) * plotW).toFixed(1);
  const yS = v  => (PT + plotH * (1 - (v - minV) / range)).toFixed(1);

  const pricePath = closes.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i)},${yS(p)}`).join(" ");
  const fillPath  = `${pricePath} L${xS(closes.length - 1)},${PT + plotH} L${PL},${PT + plotH} Z`;

  const nTicks   = 4;
  const ticks    = Array.from({ length: nTicks }, (_, i) => minV + (i / (nTicks - 1)) * range);
  const dateIdxs = [0, Math.floor(closes.length * 0.25), Math.floor(closes.length * 0.5), Math.floor(closes.length * 0.75), closes.length - 1];

  const lastX  = parseFloat(xS(closes.length - 1));
  const lastY  = parseFloat(yS(closes[closes.length - 1]));
  const lineC  = mode === "SHORT" ? C.red : mode === "LONG" ? C.green : C.cyan;

  // Ref lines sorted by Y, clamped to avoid overlap
  const refLines = [
    ma200       > 0 ? { y: parseFloat(yS(ma200)),       color: "#a78bfa", label: `MA200 $${ma200.toFixed(0)}`,       dash: "5 3" } : null,
    entryPrice  > 0 ? { y: parseFloat(yS(entryPrice)),  color: C.red,     label: `Entrée $${entryPrice.toFixed(0)}`, dash: "3 2" } : null,
    stopLevel   > 0 ? { y: parseFloat(yS(stopLevel)),   color: C.amber,   label: `Stop $${stopLevel.toFixed(0)}`,    dash: "3 2" } : null,
  ].filter(Boolean).sort((a, b) => a.y - b.y);

  // Ensure 16px min gap between labels
  for (let i = 1; i < refLines.length; i++) {
    if (refLines[i].y - refLines[i - 1].y < 16) refLines[i].y = refLines[i - 1].y + 16;
  }
  // Clamp to viewbox
  refLines.forEach(r => { r.labelY = Math.max(PT + 8, Math.min(H - PB, r.y + 4)); });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      {ticks.map((t, i) => (
        <line key={i} x1={PL} y1={yS(t)} x2={W - PR} y2={yS(t)} stroke="#1a2744" strokeWidth="0.5" />
      ))}
      <path d={fillPath} fill={`${lineC}07`} />
      {refLines.map((r, i) => (
        <g key={i}>
          <line x1={PL} y1={r.y} x2={W - PR} y2={r.y} stroke={r.color} strokeWidth="0.8" strokeDasharray={r.dash} />
          <text x={W - PR + 4} y={r.labelY} fill={r.color} fontSize="7" fontFamily={mono}>{r.label}</text>
        </g>
      ))}
      <path d={pricePath} fill="none" stroke={lineC} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={lineC} />
      {dateIdxs.map((idx) => {
        const d = new Date(Date.now() - (closes.length - 1 - idx) * 8 * 3600000);
        const label = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
        return <text key={idx} x={xS(idx)} y={H - 3} fill="#2a3a52" fontSize="7" fontFamily={mono} textAnchor="middle">{label}</text>;
      })}
    </svg>
  );
}

// ─── CHART: P&L GAUGE (CANVAS) ───────────────────────────────────────────────
function PnlGauge({ pnlUsd, pnlPct, entryPrice, stopLevel, posSize, mode }) {
  const canvasRef = useRef(null);
  const mono      = "IBM Plex Mono, monospace";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gc = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H - 8, r = Math.min(W / 2 - 14, H - 16);

    gc.clearRect(0, 0, W, H);

    // Risk/reward
    const stopDist   = mode === "SHORT"
      ? Math.abs((stopLevel - entryPrice) * posSize)
      : Math.abs((entryPrice - stopLevel) * posSize);
    const targetDist = stopDist * 2;
    const totalRange = stopDist + targetDist || 1;
    const pct        = Math.min(1, Math.max(0, (pnlUsd + stopDist) / totalRange));

    const SA = Math.PI, EA = 2 * Math.PI;

    // Track background
    gc.beginPath(); gc.arc(cx, cy, r, SA, EA);
    gc.strokeStyle = "#1a2744"; gc.lineWidth = 13; gc.stroke();

    // Loss half (left = red)
    gc.beginPath(); gc.arc(cx, cy, r, SA, SA + (EA - SA) * 0.5);
    gc.strokeStyle = "#2d0606"; gc.lineWidth = 13; gc.stroke();

    // Profit half (right = green)
    gc.beginPath(); gc.arc(cx, cy, r, SA + (EA - SA) * 0.5, EA);
    gc.strokeStyle = "#052e16"; gc.lineWidth = 13; gc.stroke();

    // Fill to current P&L
    const fillEnd = SA + pct * (EA - SA);
    gc.beginPath(); gc.arc(cx, cy, r, SA, fillEnd);
    gc.strokeStyle = pnlUsd >= 0 ? "#4ade80" : "#f87171";
    gc.lineWidth = 13; gc.lineCap = "round"; gc.stroke();

    // Entry midpoint tick
    const midX = cx + r * Math.cos(SA + (EA - SA) * 0.5);
    const midY = cy + r * Math.sin(SA + (EA - SA) * 0.5);
    gc.beginPath(); gc.arc(midX, midY, 3, 0, 2 * Math.PI);
    gc.fillStyle = "#3b5278"; gc.fill();

    // Current position needle tip
    const tipX = cx + r * Math.cos(fillEnd);
    const tipY = cy + r * Math.sin(fillEnd);
    gc.beginPath(); gc.arc(tipX, tipY, 4, 0, 2 * Math.PI);
    gc.fillStyle = "#f1f5f9"; gc.fill();

    // Labels
    gc.font = `8px ${mono}`;
    gc.fillStyle = "#f87171"; gc.textAlign = "left";
    gc.fillText(`-$${stopDist.toFixed(1)}`, 4, H - 10);
    gc.fillStyle = "#4ade80"; gc.textAlign = "right";
    gc.fillText(`+$${targetDist.toFixed(1)}`, W - 4, H - 10);
    gc.fillStyle = "#3b5278"; gc.textAlign = "center";
    gc.fillText("Entrée", cx, H - 10);
  }, [pnlUsd, entryPrice, stopLevel, posSize, mode]);

  const isPos = pnlUsd >= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <canvas ref={canvasRef} width={200} height={110} style={{ display: "block" }} />
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: isPos ? C.green : C.red, fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.1 }}>
          {isPos ? "+" : ""}${pnlUsd.toFixed(2)}
        </div>
        <div style={{ fontSize: 9, color: isPos ? C.green : C.red, fontFamily: "IBM Plex Mono, monospace", marginTop: 2 }}>
          {isPos ? "+" : ""}{pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── CHART: SPARKLINE (helper) ───────────────────────────────────────────────
function Sparkline({ candles, color }) {
  if (!candles || candles.length < 2) {
    return <div style={{ height: 48, background: C.bg2, borderRadius: 4 }} />;
  }
  const closes = candles.map(c => parseFloat(c.close)).slice(-40);
  const minV   = Math.min(...closes);
  const maxV   = Math.max(...closes);
  const range  = maxV - minV || 1;
  const W = 300, H = 48;
  const pts    = closes.map((v, i) => `${(i / (closes.length - 1) * W).toFixed(1)},${(H - ((v - minV) / range * H * 0.88 + H * 0.06)).toFixed(1)}`).join(" ");
  const fill   = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} preserveAspectRatio="none">
      <polygon points={fill} fill={`${color}12`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── CHART: ACTIVITY HEATMAP ─────────────────────────────────────────────────
function ActivityHeatmap({ logs, trades, botState }) {
  const today = new Date();
  const days  = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (34 - i));
    return d;
  });

  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // Build state map from ANALYSIS logs (latest per day)
  const stateMap = {};
  [...logs].reverse().forEach(l => {
    if (l.log_type !== "ANALYSIS" || !l.timestamp) return;
    const k = dayKey(new Date(l.timestamp));
    if (!stateMap[k]) {
      const msg = l.message || "";
      if (msg.includes("LONG"))  stateMap[k] = "LONG";
      else if (msg.includes("SHORT")) stateMap[k] = "SHORT";
      else stateMap[k] = "CASH";
    }
  });

  // Build P&L map from trades
  const pnlMap = {};
  trades.forEach(t => {
    if (!t.close_date) return;
    const k = dayKey(new Date(t.close_date));
    pnlMap[k] = (pnlMap[k] || 0) + (parseFloat(t.pnl_percentage) || 0);
  });

  // Today = current bot state
  stateMap[dayKey(today)] = botState.current_mode || "CASH";

  const getColor = (day) => {
    const k    = dayKey(day);
    const mode = stateMap[k];
    const pnl  = pnlMap[k];
    if (!mode || mode === "CASH") return "#0a101e";
    if (mode === "LONG")  return pnl > 0 ? "#14532d" : pnl < 0 ? "#450a0a" : "#1a4d2e";
    if (mode === "SHORT") return pnl > 0 ? "#7f1d1d" : pnl < 0 ? "#1a0606" : "#450a0a";
    return "#0a101e";
  };

  const isToday = d => dayKey(d) === dayKey(today);

  const rows = Array.from({ length: 5 }, (_, r) => days.slice(r * 7, r * 7 + 7));
  const mono = "IBM Plex Mono, monospace";

  // Week day labels
  const weekDays = ["L","M","M","J","V","S","D"];

  // Month labels at start of rows
  const monthLabel = (row) => {
    const d = row[0];
    return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit" });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        <div style={{ width: 28, flexShrink: 0 }} />
        {weekDays.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7, color: C.textDim, fontFamily: mono }}>{d}</div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 3, marginBottom: ri < 4 ? 3 : 0, alignItems: "center" }}>
          <div style={{ width: 28, fontSize: 7, color: C.textDim, fontFamily: mono, flexShrink: 0 }}>{monthLabel(row)}</div>
          {row.map((day, ci) => {
            const k    = dayKey(day);
            const mode = stateMap[k] || "CASH";
            const pnl  = pnlMap[k];
            const title = `${day.toLocaleDateString("fr-FR")} — ${mode}${pnl != null ? ` (${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%)` : ""}`;
            return (
              <div key={ci} style={{
                flex: 1, height: 22, borderRadius: 3,
                background: getColor(day),
                border: isToday(day) ? `1px solid ${C.cyan}` : "1px solid #0d1422",
                minWidth: 0, cursor: "default",
              }} title={title} />
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { color: "#14532d", label: "LONG profitable" },
          { color: "#7f1d1d", label: "SHORT profitable" },
          { color: "#450a0a", label: "SHORT/LONG en cours" },
          { color: "#0a101e", label: "CASH" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: C.textDim, fontFamily: mono }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: DASHBOARD ──────────────────────────────────────────────────────────
function TabDashboard({ botState, portfolio, logs, signals, trades }) {
  const mono = "IBM Plex Mono, monospace";
  const latestAnalysis = logs.find((l) => l.log_type === "ANALYSIS" || l.log_type === "INFO") || logs[0];

  const entryPrice   = parseFloat(botState.entry_price)         || 0;
  const trailStop    = parseFloat(botState.trailing_stop_level) || 0;
  const posSize      = parseFloat(botState.position_size)       || 0;
  const currentPrice = parseFloat(portfolio?.currentPrice)       || 0;
  const balance      = parseFloat(portfolio?.balance)            || 0;
  const atr          = parseFloat(portfolio?.atr14)              || 0;

  let pnlUsd = 0, pnlPct = 0;
  if (entryPrice > 0 && currentPrice > 0 && posSize > 0) {
    if (botState.current_mode === "LONG")  { pnlUsd = (currentPrice - entryPrice) * posSize; }
    if (botState.current_mode === "SHORT") { pnlUsd = (entryPrice - currentPrice) * posSize; }
    pnlPct = (pnlUsd / (entryPrice * posSize)) * 100;
  }
  const pnlPositive = pnlUsd >= 0;
  const positionUsd = entryPrice * posSize;

  const ranking    = signals?.ranking    || [];
  const atrByAsset = signals?.atrByAsset || {};
  const btcBullish = signals?.btcBullish ?? portfolio?.btcBullish;
  const conds      = portfolio?.conditions || {};
  const activeAtr  = botState.active_asset ? (atrByAsset[botState.active_asset] || atr) : atr;
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
            <span style={{ fontSize: 18, fontWeight: 600, color: C.white, fontFamily: mono }}>
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
          <BigValue>{activeAtr > 0 ? `$${fmt(activeAtr)}` : "—"}</BigValue>
          <Sub>{activeAtr > 0 && entryPrice > 0 ? `Stop init : $${fmt(botState.current_mode === "SHORT" ? entryPrice + 1.5 * activeAtr : entryPrice - 1.5 * activeAtr)}` : ""}</Sub>
        </div>
      </div>

      {/* ROW 2 — Ranking + Dernière analyse */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.5fr)", gap: 8 }}>
        <div className="cb-kpi">
          <Label>RANKING MOMENTUM</Label>
          {ranking.length > 0 ? ranking.map((asset, i) => (
            <div key={asset.symbol} style={{ marginBottom: i < ranking.length - 1 ? 12 : 0, marginTop: i === 0 ? 6 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? C.white : C.textMuted, fontFamily: mono }}>{asset.symbol}</span>
                <span style={{ fontSize: 11, fontFamily: mono, color: i === 0 ? C.red : C.textMuted }}>
                  {fmt(asset.score, 2)}
                  <span style={{ marginLeft: 5, fontSize: 8, padding: "1px 5px", borderRadius: 3, background: i === 0 ? C.redBg : C.bg2, color: i === 0 ? C.red : C.textMuted, border: `1px solid ${i === 0 ? C.redDark : C.border}` }}>
                    {i === 0 ? botState.current_mode : "inactif"}
                  </span>
                </span>
              </div>
              <div className="cb-progress-bg">
                <div style={{ width: `${Math.min(100, Math.abs(asset.score) * 20)}%`, height: "100%", background: i === 0 ? "#dc2626" : C.border, borderRadius: 3 }} />
              </div>
            </div>
          )) : (
            <div style={{ color: C.textMuted, fontSize: 10, fontFamily: mono, marginTop: 6 }}>Données de ranking non disponibles.</div>
          )}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: C.textMuted, letterSpacing: "1px", fontFamily: mono }}>BTC LIGHTHOUSE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: btcBullish ? C.green : C.red }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: btcBullish ? C.green : C.red, fontFamily: mono }}>
                {btcBullish ? "HAUSSIER" : "BAISSIER"}
              </span>
            </div>
          </div>
        </div>
        <div className="cb-kpi" style={{ borderColor: C.blueMid }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>DERNIÈRE ANALYSE</Label>
            <span style={{ fontSize: 8, color: C.textDim, fontFamily: mono }}>
              {latestAnalysis?.timestamp ? fmtDate(latestAnalysis.timestamp) : "—"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.8, fontFamily: mono, marginBottom: 10 }}>
            {latestAnalysis ? latestAnalysis.message : "Aucune analyse disponible. Forcez un rebalance."}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Chip ok={conds.prixSousMA200 ?? (botState.current_mode === "SHORT")} label="Prix < MA200" />
            <Chip ok={conds.slopeNegatif  ?? (botState.current_mode === "SHORT")} label="Slope < 0" />
            <Chip ok={conds.btcBaissier   ?? !(portfolio?.btcBullish)}            label="BTC Bear" />
            <Chip ok={conds.fundingOk     ?? true}                                label="Funding OK" />
          </div>
        </div>
      </div>

      {/* ROW 3 — Graphique prix + Jauge P&L */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 8 }}>
        <div className="cb-kpi" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Label>{(botState.active_asset || "ETH")}/USDT — BOUGIES 8H</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[{ color: C.cyan, label: "Prix" }, { color: "#a78bfa", label: "MA200" }, { color: C.red, label: "Entrée" }, { color: C.amber, label: "Stop" }].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 14, height: 1.5, background: item.color }} />
                  <span style={{ fontSize: 7, color: C.textDim, fontFamily: mono }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <PriceChart
            candles={botState.active_asset === "SOL" ? signals?.candlesSOL : signals?.candlesETH}
            entryPrice={entryPrice}
            stopLevel={trailStop}
            ma200={ranking.find(r => r.symbol === (botState.active_asset || "ETH"))?.ma200 || 0}
            mode={botState.current_mode}
            currentPrice={currentPrice}
          />
        </div>
        <div className="cb-kpi" style={{ padding: "12px 14px" }}>
          <Label>JAUGE P&L POSITION</Label>
          {botState.current_mode !== "CASH" && entryPrice > 0 ? (
            <PnlGauge
              pnlUsd={pnlUsd}
              pnlPct={pnlPct}
              entryPrice={entryPrice}
              stopLevel={trailStop || entryPrice * 0.95}
              posSize={posSize}
              mode={botState.current_mode}
            />
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 10, fontFamily: mono }}>
              Aucune position ouverte
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 — Sparklines + Heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)", gap: 8 }}>
        <div className="cb-kpi">
          <Label>SPARKLINES MOMENTUM — 40 BOUGIES 8H</Label>
          <div style={{ marginTop: 8 }}>
            {[
              { symbol: "ETH", candles: signals?.candlesETH, rankData: ranking.find(r => r.symbol === "ETH") },
              { symbol: "SOL", candles: signals?.candlesSOL, rankData: ranking.find(r => r.symbol === "SOL") },
            ].map(({ symbol, candles, rankData }, i) => {
              const isActive   = botState.active_asset === symbol;
              const sparkColor = isActive ? (botState.current_mode === "SHORT" ? C.red : C.green) : C.textMuted;
              return (
                <div key={symbol} style={{ marginBottom: i === 0 ? 12 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? C.white : C.textMuted, fontFamily: mono }}>{symbol}</span>
                    <span style={{ fontSize: 9, color: sparkColor, fontFamily: mono }}>
                      {rankData ? fmt(rankData.score, 2) : "---"}
                      <span style={{ marginLeft: 5, fontSize: 8, background: isActive ? (botState.current_mode === "SHORT" ? C.redBg : C.greenBg) : C.bg2, color: isActive ? (botState.current_mode === "SHORT" ? C.red : C.green) : C.textMuted, padding: "1px 5px", borderRadius: 3 }}>
                        {isActive ? botState.current_mode : "inactif"}
                      </span>
                    </span>
                  </div>
                  <Sparkline candles={candles} color={sparkColor} />
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: C.textMuted, letterSpacing: "1px", fontFamily: mono }}>BTC LIGHTHOUSE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: btcBullish ? C.green : C.red }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: btcBullish ? C.green : C.red, fontFamily: mono }}>
                {btcBullish ? "HAUSSIER" : "BAISSIER"}
              </span>
            </div>
          </div>
        </div>
        <div className="cb-kpi">
          <Label>ACTIVITÉ BOT — 35 DERNIERS JOURS</Label>
          <ActivityHeatmap logs={logs} trades={trades} botState={botState} />
        </div>
      </div>

    </div>
  );
}

// ─── TAB: STRATÉGIE V2 ────────────────────────────────────────────────────────
function TabStrategy({ botState, portfolio }) {
  const isShort = botState.current_mode === "SHORT";
  const isLong  = botState.current_mode === "LONG";
  const isCash  = botState.current_mode === "CASH";
  const mono    = "IBM Plex Mono, monospace";

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

  // Rendu d'une condition — neutre si CASH, ✓/✗ sinon
  const CondRow = ({ label, ok }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontFamily: mono,
      color: isCash ? C.textMuted : ok ? "#86efac" : C.textDim }}>
      <span style={{ fontSize: 11, color: isCash ? C.textMuted : ok ? C.green : C.redDark }}>
        {isCash ? "·" : ok ? "✓" : "✗"}
      </span>
      {label}
    </div>
  );

  // Badge de statut de la card
  const StatusBadge = ({ active, labelActive, labelInactive }) => {
    if (isCash) return <span style={{ color: C.textMuted, fontSize: 9, fontFamily: mono }}>en veille</span>;
    return active
      ? <span style={{ color: C.green,    fontSize: 9, fontFamily: mono }}>{labelActive} ✓</span>
      : <span style={{ color: C.textDim,  fontSize: 9, fontFamily: mono }}>{labelInactive}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Bannière CASH */}
      {isCash && (
        <div style={{
          background: "#0d1220", border: `1px solid ${C.borderMid}`,
          borderRadius: 8, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: C.textMuted, flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 11, color: C.text, fontFamily: mono, fontWeight: 600 }}>
              Bot en veille — aucune condition LONG ni SHORT n'est réunie
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, marginTop: 3 }}>
              Les conditions ci-dessous sont affichées à titre indicatif. Le bot réévaluera au prochain cycle.
            </div>
          </div>
        </div>
      )}

      {/* LONG / SHORT conditions */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>

        <div className="cb-kpi" style={{ borderColor: isLong ? C.greenDark : C.border, opacity: isCash ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>CONDITIONS LONG</Label>
            <StatusBadge active={isLong} labelActive="ACTIVE" labelInactive="inactives" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {condLong.map((c) => <CondRow key={c.label} {...c} />)}
          </div>
          <div style={{ marginTop: 12, fontSize: 8, color: C.textMuted, fontFamily: mono }}>Sizing : 80% capital</div>
        </div>

        <div className="cb-kpi" style={{ borderColor: isShort ? C.redDark : C.border, opacity: isCash ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>CONDITIONS SHORT</Label>
            <StatusBadge active={isShort} labelActive="ACTIVES" labelInactive="inactives" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {condShort.map((c) => <CondRow key={c.label} {...c} />)}
          </div>
          <div style={{ marginTop: 12, fontSize: 8, color: C.amber, fontFamily: mono }}>Sizing : 40% capital</div>
        </div>
      </div>

      {/* PARAMS GRID */}
      <div className="cb-kpi">
        <Label>PARAMÈTRES STRATÉGIE</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 7, marginTop: 8 }}>
          {params.map((p) => (
            <div key={p.label} className="cb-param">
              <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", marginBottom: 4, fontFamily: mono }}>{p.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.highlight || C.white, fontFamily: mono }}>{p.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: HISTORIQUE TRADES ──────────────────────────────────────────────────
function TabTrades({ trades, botState, portfolio }) {
  const closed = trades.filter((t) => t.close_date || t.pnl_percentage != null);

  // Position ouverte courante
  const hasOpenPosition = botState.current_mode === "LONG" || botState.current_mode === "SHORT";
  const entryPrice      = parseFloat(botState.entry_price)   || 0;
  const posSize         = parseFloat(botState.position_size) || 0;
  const currentPrice    = parseFloat(portfolio?.currentPrice) || 0;

  let openPnlUsd = 0, openPnlPct = 0;
  if (hasOpenPosition && entryPrice > 0 && currentPrice > 0 && posSize > 0) {
    openPnlUsd = botState.current_mode === "LONG"
      ? (currentPrice - entryPrice) * posSize
      : (entryPrice - currentPrice) * posSize;
    openPnlPct = (openPnlUsd / (entryPrice * posSize)) * 100;
  }

  const winCount = closed.filter((t) => parseFloat(t.pnl_percentage) > 0).length;
  const winRate  = closed.length > 0 ? ((winCount / closed.length) * 100).toFixed(0) : null;
  const totalPnl = closed.reduce((sum, t) => sum + (parseFloat(t.pnl_percentage) || 0), 0);
  const avgPnl   = closed.length > 0 ? (totalPnl / closed.length).toFixed(2) : null;

  const stats = [
    { label: "TRADES CLÔTURÉS", value: closed.length || "0" },
    { label: "WIN RATE",        value: winRate != null ? `${winRate}%` : "—",
      color: winRate >= 50 ? C.green : C.red },
    { label: "P&L TOTAL",       value: avgPnl != null ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "—",
      color: totalPnl >= 0 ? C.green : C.red },
    { label: "MOY. / TRADE",    value: avgPnl != null ? `${avgPnl > 0 ? "+" : ""}${avgPnl}%` : "—",
      color: parseFloat(avgPnl) >= 0 ? C.green : C.red },
  ];

  const mono = "IBM Plex Mono, monospace";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Position ouverte en cours */}
      {hasOpenPosition && (
        <div className="cb-kpi" style={{
          borderColor: botState.current_mode === "LONG" ? C.greenDark : C.redDark,
          background: botState.current_mode === "LONG" ? "#040f08" : "#0a0404",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            {/* Gauche : badge EN COURS + infos position */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                background: "#1a3a1a", color: C.green,
                border: `1px solid ${C.greenDark}`,
                fontSize: 8, padding: "3px 8px", borderRadius: 3,
                fontFamily: mono, letterSpacing: "1.5px", fontWeight: 600,
              }}>
                ● EN COURS
              </span>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.white, fontFamily: mono }}>
                  {botState.active_asset}
                </span>
                <span style={{
                  marginLeft: 8, fontSize: 9,
                  color: botState.current_mode === "LONG" ? C.green : C.red,
                  fontFamily: mono,
                }}>
                  {botState.current_mode === "LONG" ? "▲" : "▼"} {botState.current_mode}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", fontFamily: mono, marginBottom: 2 }}>ENTRÉE</div>
                  <div style={{ fontSize: 11, color: C.white, fontFamily: mono }}>${fmt(entryPrice)}</div>
                </div>
                {currentPrice > 0 && (
                  <div>
                    <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", fontFamily: mono, marginBottom: 2 }}>COURS ACTUEL</div>
                    <div style={{ fontSize: 11, color: C.text, fontFamily: mono }}>${fmt(currentPrice)}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", fontFamily: mono, marginBottom: 2 }}>TAILLE</div>
                  <div style={{ fontSize: 11, color: C.text, fontFamily: mono }}>{fmt(posSize, 4)} {botState.active_asset}</div>
                </div>
              </div>
            </div>
            {/* Droite : P&L flottant */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 7, color: C.textMuted, letterSpacing: "1px", fontFamily: mono, marginBottom: 2 }}>P&L FLOTTANT</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: openPnlUsd >= 0 ? C.green : C.red, fontFamily: mono }}>
                {openPnlUsd >= 0 ? "+" : ""}${fmt(Math.abs(openPnlUsd))}
              </div>
              <div style={{ fontSize: 9, color: openPnlUsd >= 0 ? C.green : C.red, fontFamily: mono }}>
                {openPnlPct >= 0 ? "+" : ""}{fmt(openPnlPct)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats clôturés */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} className="cb-kpi" style={{ textAlign: "center" }}>
            <Label>{s.label}</Label>
            <div style={{ fontSize: 18, fontWeight: 600, color: s.color || C.white, fontFamily: mono }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table trades clôturés */}
      <div className="cb-kpi" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
              {["DATE CLÔTURE", "ACTIF", "DIR.", "ENTRÉE", "SORTIE", "P&L %"].map((h, i) => (
                <th key={h} style={{ padding: "9px 12px", textAlign: i >= 3 ? "right" : "left", color: C.textMuted, fontSize: 8, letterSpacing: "1px", fontWeight: 400, fontFamily: mono }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closed.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "28px", textAlign: "center", color: C.textDim, fontSize: 10, fontFamily: mono }}>
                  {hasOpenPosition ? "Aucun trade clôturé pour le moment." : "Aucun trade enregistré."}
                </td>
              </tr>
            ) : (
              closed.map((t, i) => {
                const pnl = parseFloat(t.pnl_percentage);
                const pnlColor = isNaN(pnl) ? C.text : pnl >= 0 ? C.green : C.red;
                return (
                  <tr key={i} className="cb-tr" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 12px", color: C.text,  fontFamily: mono }}>{fmtDate(t.close_date)}</td>
                    <td style={{ padding: "9px 12px", color: C.white, fontFamily: mono, fontWeight: 600 }}>{t.asset}</td>
                    <td style={{ padding: "9px 12px", color: t.direction === "LONG" ? C.green : C.red, fontFamily: mono }}>
                      {t.direction === "LONG" ? "▲" : "▼"} {t.direction}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.text, fontFamily: mono }}>
                      {t.entry_price ? `$${fmt(t.entry_price)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.text, fontFamily: mono }}>
                      {t.exit_price ? `$${fmt(t.exit_price)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: pnlColor, fontFamily: mono, fontWeight: 600 }}>
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
  const [signals, setSignals]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [timeToNext, setTimeToNext] = useState("");
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [lastRefresh, setLastRefresh]     = useState(null);
  const [authToken, setAuthToken]         = useState(() => sessionStorage.getItem("cb_token") || null);
  const [authChecked, setAuthChecked]     = useState(false);

  // ── AUTH CHECK on mount ──
  useEffect(() => {
    const token = sessionStorage.getItem("cb_token");
    if (!token) { setAuthChecked(true); return; }
    fetch("/api/auth", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) { sessionStorage.removeItem("cb_token"); setAuthToken(null); }
        else setAuthToken(token);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(false));
  }, []);

  // DATA FETCH (rapide : Supabase only)
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

  // SIGNALS FETCH (plus lent : ATR + ranking via Binance)
  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/signals");
      if (res.ok) setSignals(await res.json());
    } catch (err) {
      console.error("Signals fetch error:", err);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchSignals();
    const ivFast = setInterval(fetchAll,    60000);   // 60s
    const ivSlow = setInterval(fetchSignals, 300000); // 5min
    return () => { clearInterval(ivFast); clearInterval(ivSlow); };
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
      await Promise.all([fetchAll(), fetchSignals()]);
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

  if (!authToken) return <><style>{STYLES}</style><LoginScreen onLogin={setAuthToken} /></>;
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
            <button className="cb-btn-ghost" onClick={() => { sessionStorage.removeItem("cb_token"); setAuthToken(null); }} title="Se déconnecter" style={{ fontSize: 11, padding: "7px 10px" }}>⏻</button>
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
          {tab === "Dashboard"         && <TabDashboard  botState={botState} portfolio={data.portfolio} logs={logs} signals={signals} trades={trades} />}
          {tab === "Stratégie V2"      && <TabStrategy   botState={botState} portfolio={data.portfolio} />}
          {tab === "Historique Trades" && <TabTrades     trades={trades} botState={botState} portfolio={data.portfolio} />}
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