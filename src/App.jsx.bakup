import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";

// ─── VERSION ─────────────────────────────────────────────────────────────────
const APP_VERSION = "1.1.1";
const CHANGELOG = [
  {
    version: "1.0.0",
    date: "2025-03-13",
    label: "Version initiale",
    changes: [
      "Stop-loss dynamique ATR (2× ATR14 depuis l'entrée) — remplace le stop fixe −8%",
      "Trailing stop (+20% activation, −10% depuis le plus haut) pour sécuriser les gains",
      "Momentum calibré par asset : BTC=120j, ETH=90j, SOL=60j",
      "Filtre de volume minimum (volume 5j > 80% de la moyenne 20j)",
      "Frais simulés à 40bps (équivalent maker) — rappel : implémenter ordres limite maker sur Coinbase",
      "Dashboard : onglet Stratégie avec explications complètes + liens Wikipedia/YouTube",
      "Dashboard : onglet Backtest avec nouveaux paramètres ATR, trailing stop, momentum par asset",
      "Dashboard : note de rappel frais maker dans la navigation avec guide étape par étape",
      "SOL-USD ajouté comme 3ème asset",
      "Anti-whipsaw 24h entre deux trades sur le même asset",
      "Drawdown tracking (max drawdown, current drawdown)",
      "Alertes Telegram (trades, stop-loss, erreurs)",
      "Historique equity dans Google Sheets (onglet Equity History)",
      "Paper trading / DRY RUN mode",
    ],
  },
  {
    version: "1.1.0",
    date: "2025-03-13",
    label: "Dashboard redesign",
    changes: [
      "Dashboard entièrement redesigné : layout 2 colonnes, sections distinctes",
      "Bloc Position active : P&L live, prix entrée, ATR stop, trailing stop, plus haut",
      "Bloc Marché : prix live BTC/ETH/SOL, statut MA200 (en tendance / hors tendance)",
      "Score de momentum et signal actuel pour chaque asset",
      "Graphique allocation : donut CSS cash vs investi",
      "État vide amélioré avec checklist de démarrage",
      "Prochain rebalance estimé affiché dans le bandeau top",
      "Nombre de trades affiché dans les KPIs",
    ],
  },
  {
    version: "1.1.1",
    date: "2025-03-13",
    label: "Fix UI changelog",
    changes: [
      "Changelog accordéon : détail replié par défaut, dépliable au clic",
      "Flèche animée indiquant l'état ouvert/fermé de chaque version",
      "Version courante mise en évidence en teal",
    ],
  },
];

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    const r = await fetch("/api/auth", { method:"POST",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify({password:pw}) });
    if (r.ok) { sessionStorage.setItem("auth","1"); onLogin(); }
    else setErr("Wrong password");
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a"}}>
      <div style={{background:"#1e293b",padding:"2.5rem",borderRadius:"1rem",width:"320px",textAlign:"center"}}>
        <div style={{fontSize:"2.5rem",marginBottom:"0.5rem"}}>🤖</div>
        <h2 style={{color:"#f1f5f9",margin:"0 0 1.5rem"}}>CryptoBot</h2>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Password"
          style={{width:"100%",padding:"0.75rem",borderRadius:"0.5rem",border:"1px solid #334155",
            background:"#0f172a",color:"#f1f5f9",fontSize:"1rem",boxSizing:"border-box",marginBottom:"0.75rem"}} />
        {err && <p style={{color:"#f87171",margin:"0 0 0.75rem",fontSize:"0.875rem"}}>{err}</p>}
        <button onClick={submit}
          style={{width:"100%",padding:"0.75rem",background:"#14b8a6",border:"none",borderRadius:"0.5rem",
            color:"white",fontSize:"1rem",fontWeight:"600",cursor:"pointer"}}>Login</button>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (n, d=2) => n == null ? "—" : Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtP = (n) => n == null ? "—" : `${n >= 0 ? "+" : ""}${fmt(n)}%`;
const clr  = (n) => n >= 0 ? "#4ade80" : "#f87171";

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function Card({ label, value, sub, color }) {
  return (
    <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem",flex:"1",minWidth:"140px"}}>
      <div style={{color:"#94a3b8",fontSize:"0.75rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.4rem"}}>{label}</div>
      <div style={{color: color||"#f1f5f9",fontSize:"1.4rem",fontWeight:"700"}}>{value}</div>
      {sub && <div style={{color:"#64748b",fontSize:"0.8rem",marginTop:"0.25rem"}}>{sub}</div>}
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const TABS = ["Dashboard","Signals","Backtest","Stratégie","History","Logs","Config"];

function Nav({ tab, setTab }) {
  const makerUrl = "https://claude.ai/new?q=" + encodeURIComponent("Je développe un crypto trading bot sur Vercel avec Node.js 20. Mon fichier lib/coinbase.js crée des ordres market avec market_market_ioc (frais taker 0.4%). Je veux passer aux ordres limite post-only (maker) pour payer des frais réduits (0.25%). Explique-moi étape par étape comment modifier la fonction createMarketOrder() pour : 1) créer des ordres limite post-only sur Coinbase Advanced Trade API, 2) poller le statut de l ordre jusqu au fill, 3) gérer les ordres partiels, 4) gérer les timeouts et annulations. Contexte : Vercel serverless functions, CommonJS (require), Node.js 20. Attends ma validation explicite entre chaque étape avant de continuer.");
  return (
    <div style={{width:"220px",minHeight:"100vh",background:"#1e293b",padding:"1.5rem 1rem",
      display:"flex",flexDirection:"column",gap:"0.25rem",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1.5rem",paddingLeft:"0.5rem"}}>
        <span style={{fontSize:"1.5rem"}}>🤖</span>
        <span style={{color:"#f1f5f9",fontWeight:"700",fontSize:"1.1rem"}}>CryptoBot</span>
      </div>
      {TABS.map(t => (
        <button key={t} onClick={()=>setTab(t)}
          style={{textAlign:"left",padding:"0.6rem 0.75rem",borderRadius:"0.5rem",border:"none",cursor:"pointer",
            background: tab===t ? "#0f172a" : "transparent",
            color: tab===t ? "#14b8a6" : "#94a3b8", fontWeight: tab===t ? "600" : "400", fontSize:"0.9rem"}}>
          {t}
        </button>
      ))}
      {/* Version */}
      <div style={{marginTop:"auto",paddingBottom:"0.5rem",textAlign:"center"}}>
        <span style={{color:"#475569",fontSize:"0.7rem"}}>v{APP_VERSION}</span>
      </div>
      {/* Rappel maker fees */}
      <div style={{paddingTop:"0.75rem",borderTop:"1px solid #334155"}}>
        <div style={{background:"#422006",border:"1px solid #92400e",borderRadius:"0.5rem",padding:"0.65rem 0.75rem"}}>
          <div style={{color:"#fbbf24",fontSize:"0.7rem",fontWeight:"700",marginBottom:"0.3rem"}}>⚠️ FRAIS MAKER</div>
          <div style={{color:"#fde68a",fontSize:"0.7rem",lineHeight:"1.4",marginBottom:"0.4rem"}}>
            Frais simulés à 0.4%. Penser à implémenter les vrais ordres limite maker (0.25%) sur Coinbase.
          </div>
          <a href={makerUrl} target="_blank" rel="noopener noreferrer"
            style={{color:"#14b8a6",fontSize:"0.7rem",textDecoration:"underline"}}>
            → Guide étape par étape ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function AllocationDonut({ cashPct, investedPct }) {
  const r = 36, cx = 44, cy = 44, circ = 2 * Math.PI * r;
  const investedDash = circ * Math.min(investedPct / 100, 1);
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#14b8a6" strokeWidth="10"
        strokeDasharray={`${investedDash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{transition:"stroke-dasharray 0.6s ease"}} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="700">{Math.round(investedPct)}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize="9">investi</text>
    </svg>
  );
}

function DashboardTab({ portfolio, equityHistory, signals, trades, onRebalance, rebalancing }) {
  if (!portfolio?.initialized) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
      <div style={{background:"#1e293b",padding:"2.5rem",borderRadius:"1rem",maxWidth:"500px",width:"100%"}}>
        <div style={{fontSize:"2.5rem",marginBottom:"0.75rem",textAlign:"center"}}>🚀</div>
        <h3 style={{color:"#f1f5f9",margin:"0 0 0.5rem",textAlign:"center"}}>Bot non initialisé</h3>
        <p style={{color:"#64748b",fontSize:"0.875rem",textAlign:"center",marginBottom:"1.5rem"}}>
          Lance un premier rebalance pour initialiser le portefeuille.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"1.5rem"}}>
          {[
            ["COINBASE_KEY_NAME + COINBASE_PRIVATE_KEY","Variables Coinbase"],
            ["APPS_SCRIPT_URL","URL du Google Apps Script"],
            ["DASHBOARD_PASSWORD","Mot de passe dashboard"],
          ].map(([key, label]) => (
            <div key={key} style={{display:"flex",alignItems:"center",gap:"0.5rem",
              background:"#0f172a",borderRadius:"0.5rem",padding:"0.5rem 0.75rem"}}>
              <span style={{color:"#4ade80",fontSize:"0.75rem"}}>✓</span>
              <span style={{color:"#94a3b8",fontSize:"0.8rem"}}>{label}</span>
              <span style={{color:"#475569",fontSize:"0.75rem",marginLeft:"auto",fontFamily:"monospace"}}>{key}</span>
            </div>
          ))}
        </div>
        <button onClick={onRebalance} disabled={rebalancing}
          style={{width:"100%",padding:"0.875rem",background:"#14b8a6",border:"none",borderRadius:"0.75rem",
            color:"white",fontSize:"1rem",fontWeight:"600",cursor:"pointer",opacity:rebalancing?0.6:1}}>
          {rebalancing ? "⏳ Initialisation..." : "⚡ Lancer le premier rebalance"}
        </button>
      </div>
    </div>
  );

  const pnl      = portfolio.pnl || 0;
  const dd       = (portfolio.current_drawdown || 0) * 100;
  const maxDD    = (portfolio.max_drawdown_ever || 0) * 100;
  const cashPct  = portfolio.total_equity > 0 ? portfolio.cash_usd / portfolio.total_equity * 100 : 100;
  const invPct   = 100 - cashPct;
  const numTrades = trades?.length || 0;
  const positions = Object.entries(portfolio.positions || {});
  const topSignal = signals?.find(s => s.selected);

  // Last rebalance → estimate next (8h cycle)
  const lastReb = portfolio.last_rebalance;
  let nextRebIn = null;
  if (lastReb) {
    const diffH = (Date.now() - new Date(lastReb).getTime()) / 3600000;
    const remH  = Math.max(0, 8 - (diffH % 8));
    nextRebIn   = remH < 1 ? `${Math.round(remH * 60)}min` : `${remH.toFixed(1)}h`;
  }

  const section = (children, style={}) => (
    <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem",...style}}>{children}</div>
  );
  const secTitle = (t) => (
    <div style={{color:"#64748b",fontSize:"0.7rem",fontWeight:"700",textTransform:"uppercase",
      letterSpacing:"0.08em",marginBottom:"0.75rem"}}>{t}</div>
  );

  return (
    <div style={{flex:1,padding:"1.25rem",display:"flex",flexDirection:"column",gap:"1rem",overflowY:"auto"}}>

      {/* ── ROW 1 : KPIs ─────────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"0.75rem"}}>
        {[
          ["TOTAL EQUITY",   `$${fmt(portfolio.total_equity)}`,      null,                    null],
          ["P&L",            `$${fmt(pnl)}`,                         fmtP(portfolio.pnl_pct), clr(pnl)],
          ["CASH",           `$${fmt(portfolio.cash_usd)}`,          `${fmt(cashPct,1)}%`,    null],
          ["INVESTI",        `$${fmt(portfolio.invested)}`,          `${fmt(invPct,1)}%`,     "#14b8a6"],
          ["MAX DRAWDOWN",   `${fmt(Math.abs(maxDD),1)}%`,           null,                    maxDD < -5 ? "#f87171" : "#94a3b8"],
          ["CURR. DRAWDOWN", `${fmt(Math.abs(dd),1)}%`,              null,                    dd < -3 ? "#f87171" : "#4ade80"],
          ["FRAIS PAYÉS",    `$${fmt(portfolio.cumulative_fees,4)}`, null,                    null],
          ["TRADES",         numTrades,                               null,                    null],
        ].map(([label, value, sub, color]) => (
          <div key={label} style={{background:"#0f172a",borderRadius:"0.65rem",padding:"0.9rem 1rem"}}>
            <div style={{color:"#475569",fontSize:"0.65rem",fontWeight:"700",textTransform:"uppercase",
              letterSpacing:"0.07em",marginBottom:"0.3rem"}}>{label}</div>
            <div style={{color:color||"#f1f5f9",fontSize:"1.2rem",fontWeight:"700",lineHeight:1}}>{value}</div>
            {sub && <div style={{color:"#64748b",fontSize:"0.75rem",marginTop:"0.2rem"}}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── ROW 2 : POSITION + MARCHÉ ─────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>

        {/* Position active */}
        {section(<>
          {secTitle("Position active")}
          {positions.length === 0 ? (
            <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
              <AllocationDonut cashPct={100} investedPct={0} />
              <div>
                <div style={{color:"#f59e0b",fontWeight:"700",fontSize:"1rem"}}>100% CASH</div>
                <div style={{color:"#64748b",fontSize:"0.8rem",marginTop:"0.25rem"}}>
                  {topSignal ? `Signal actuel : ${topSignal.asset}` : "Aucun signal éligible"}
                </div>
              </div>
            </div>
          ) : positions.map(([asset, pos]) => {
            const sig        = signals?.find(s => s.asset === asset);
            const livePrice  = sig?.price || pos.avg_price;
            const livePnl    = pos.entry_price ? (livePrice - pos.entry_price) / pos.entry_price * 100 : null;
            const atrStop    = pos.atr_at_entry ? pos.entry_price - 2 * pos.atr_at_entry : null;
            const trailActive = pos.position_high && pos.entry_price &&
              (pos.position_high - pos.entry_price) / pos.entry_price >= 0.20;
            const trailStop  = trailActive ? pos.position_high * 0.90 : null;
            return (
              <div key={asset}>
                <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"0.75rem"}}>
                  <AllocationDonut cashPct={cashPct} investedPct={invPct} />
                  <div>
                    <div style={{color:"#14b8a6",fontWeight:"700",fontSize:"1.1rem"}}>{asset}</div>
                    <div style={{color:"#f1f5f9",fontSize:"1rem",fontWeight:"600"}}>${fmt(livePrice)}</div>
                    {livePnl != null && (
                      <div style={{color:clr(livePnl),fontSize:"0.85rem",fontWeight:"600"}}>
                        {livePnl >= 0 ? "+" : ""}{fmt(livePnl,2)}% depuis entrée
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem",fontSize:"0.78rem"}}>
                  {[
                    ["Entrée",       `$${fmt(pos.entry_price)}`],
                    ["Qté",          `${fmt(pos.units,4)} unités`],
                    ["Plus haut",    pos.position_high ? `$${fmt(pos.position_high)}` : "—"],
                    ["Poids cible",  `${fmt((pos.weight||0)*100,1)}%`],
                    ["ATR stop",     atrStop ? `$${fmt(atrStop)}` : "—"],
                    ["Trailing stop",trailStop ? `$${fmt(trailStop)} ${trailActive ? "✅" : ""}` : `Inactif (< +20%)`],
                  ].map(([k,v])=>(
                    <div key={k} style={{background:"#0f172a",borderRadius:"0.4rem",padding:"0.35rem 0.5rem"}}>
                      <div style={{color:"#475569",fontSize:"0.65rem",marginBottom:"0.1rem"}}>{k}</div>
                      <div style={{color:"#e2e8f0",fontWeight:"600"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>)}

        {/* Marché */}
        {section(<>
          {secTitle("État du marché")}
          <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
            {(signals||[]).map(s => {
              const eligible = s.eligible;
              const momPct   = s.momentum != null ? s.momentum * 100 : null;
              const vsMA     = s.ma200 && s.price ? (s.price - s.ma200) / s.ma200 * 100 : null;
              return (
                <div key={s.asset} style={{background:"#0f172a",borderRadius:"0.5rem",padding:"0.6rem 0.75rem",
                  border: s.selected ? "1px solid #14b8a6" : "1px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.3rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                      <span style={{fontWeight:"700",fontSize:"0.85rem",color: s.selected ? "#14b8a6" : "#f1f5f9"}}>
                        {s.asset.replace("-USD","")}
                      </span>
                      {s.selected && <span style={{background:"#14b8a622",color:"#14b8a6",
                        fontSize:"0.65rem",padding:"0.1rem 0.4rem",borderRadius:"9999px",fontWeight:"700"}}>ACTIF</span>}
                      {!eligible && <span style={{background:"#f8717122",color:"#f87171",
                        fontSize:"0.65rem",padding:"0.1rem 0.4rem",borderRadius:"9999px"}}>HORS TENDANCE</span>}
                    </div>
                    <span style={{color:"#f1f5f9",fontWeight:"600",fontSize:"0.85rem"}}>${fmt(s.price)}</span>
                  </div>
                  <div style={{display:"flex",gap:"1rem",fontSize:"0.72rem",color:"#64748b"}}>
                    <span>MA200 : <span style={{color: eligible ? "#4ade80" : "#f87171"}}>
                      {vsMA != null ? `${vsMA >= 0 ? "+" : ""}${fmt(vsMA,1)}%` : "—"}
                    </span></span>
                    <span>Mom({s.momentumDays||90}j) : <span style={{color: momPct != null && momPct > 0 ? "#4ade80" : "#f87171"}}>
                      {momPct != null ? `${momPct >= 0 ? "+" : ""}${fmt(momPct,1)}%` : "—"}
                    </span></span>
                    <span>Vol : <span style={{color:"#94a3b8"}}>
                      {s.vol != null ? `${fmt(s.vol*100,0)}%/an` : "—"}
                    </span></span>
                  </div>
                </div>
              );
            })}
            {(!signals || signals.length === 0) && (
              <div style={{color:"#475569",fontSize:"0.85rem",textAlign:"center",padding:"1rem"}}>
                Lance un rebalance pour voir les signaux.
              </div>
            )}
            {nextRebIn && (
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:"0.25rem"}}>
                <span style={{color:"#475569",fontSize:"0.72rem"}}>Prochain check dans ~{nextRebIn}</span>
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* ── ROW 3 : GRAPHIQUES ────────────────────────────────── */}
      {equityHistory.length > 1 ? (<>
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
          {secTitle("Equity vs BTC Buy & Hold")}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{fill:"#475569",fontSize:10}} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{fill:"#475569",fontSize:10}} tickFormatter={v=>`$${v}`} width={55} />
              <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"0.5rem",fontSize:"0.8rem"}}
                labelStyle={{color:"#94a3b8"}} formatter={v=>`$${fmt(v)}`} />
              <Legend wrapperStyle={{fontSize:"0.8rem"}} />
              <Line type="monotone" dataKey="equity" name="Bot" stroke="#14b8a6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="btcBH"  name="BTC B&H" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
          {secTitle("Drawdown")}
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={equityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{fill:"#475569",fontSize:10}} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{fill:"#475569",fontSize:10}} tickFormatter={v=>`${v}%`} width={40} />
              <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #334155",fontSize:"0.8rem"}}
                formatter={v=>`${fmt(v,1)}%`} />
              <ReferenceLine y={0} stroke="#334155" />
              <Line type="monotone" dataKey="drawdown" name="DD%" stroke="#f87171" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>) : (
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"2rem",textAlign:"center"}}>
          <div style={{color:"#334155",fontSize:"2rem",marginBottom:"0.5rem"}}>📈</div>
          <div style={{color:"#475569",fontSize:"0.875rem"}}>
            Les graphiques apparaîtront après plusieurs rebalancements.
          </div>
        </div>
      )}

      {/* ── ROW 4 : BOUTON ───────────────────────────────────── */}
      <button onClick={onRebalance} disabled={rebalancing}
        style={{padding:"0.875rem 2rem",background:"#14b8a6",border:"none",borderRadius:"0.75rem",
          color:"white",fontSize:"0.95rem",fontWeight:"600",cursor:"pointer",
          opacity:rebalancing?0.6:1,alignSelf:"flex-start"}}>
        {rebalancing ? "⏳ Rebalance en cours..." : "⚡ Force Rebalance Now"}
      </button>
    </div>
  );
}

// ─── SIGNALS TAB ─────────────────────────────────────────────────────────────
function SignalsTab({ signals }) {
  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto"}}>
      <h2 style={{color:"#f1f5f9",margin:"0 0 1.5rem"}}>📊 Current Signals</h2>
      <div style={{background:"#1e293b",borderRadius:"0.75rem",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.875rem"}}>
          <thead>
            <tr style={{background:"#0f172a"}}>
              {["Asset","Price","MA200","Eligible","Momentum","Vol","Weight","Status"].map(h=>(
                <th key={h} style={{padding:"0.75rem 1rem",textAlign:"left",color:"#94a3b8",fontWeight:"600",fontSize:"0.75rem",textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(signals||[]).map(s => (
              <tr key={s.asset} style={{borderTop:"1px solid #334155",background:s.selected?"#0f4c3a":"transparent"}}>
                <td style={{padding:"0.75rem 1rem",color:"#f1f5f9",fontWeight:"600"}}>{s.asset}</td>
                <td style={{padding:"0.75rem 1rem",color:"#f1f5f9"}}>${fmt(s.price)}</td>
                <td style={{padding:"0.75rem 1rem",color:"#94a3b8"}}>${fmt(s.ma200)}</td>
                <td style={{padding:"0.75rem 1rem",color:s.eligible?"#4ade80":"#f87171"}}>{s.eligible?"✅":"❌"}</td>
                <td style={{padding:"0.75rem 1rem",color:clr(s.momentum)}}>{s.momentum!=null?fmtP(s.momentum*100):"—"}</td>
                <td style={{padding:"0.75rem 1rem",color:"#94a3b8"}}>{s.vol!=null?fmt(s.vol*100,1)+"%":"—"}</td>
                <td style={{padding:"0.75rem 1rem",color:"#14b8a6"}}>{s.adjWeight?fmt(s.adjWeight*100,1)+"%":"0%"}</td>
                <td style={{padding:"0.75rem 1rem"}}>
                  {s.selected ? <span style={{background:"#14b8a6",color:"white",padding:"0.2rem 0.6rem",borderRadius:"9999px",fontSize:"0.75rem",fontWeight:"700"}}>SELECTED</span>
                    : <span style={{color:"#64748b"}}>—</span>}
                </td>
              </tr>
            ))}
            {(!signals||signals.length===0) && (
              <tr><td colSpan="8" style={{padding:"2rem",textAlign:"center",color:"#64748b"}}>No signals yet — run a rebalance first</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── BACKTEST TAB ─────────────────────────────────────────────────────────────
// ─── STRATEGY TAB ─────────────────────────────────────────────────────────────
function StrategyTab() {
  const section = (title, children) => (
    <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.5rem",marginBottom:"1rem"}}>
      <h3 style={{color:"#14b8a6",margin:"0 0 1rem",fontSize:"1rem",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em"}}>{title}</h3>
      {children}
    </div>
  );
  const p = (text) => <p style={{color:"#cbd5e1",fontSize:"0.9rem",lineHeight:"1.7",margin:"0 0 0.75rem"}}>{text}</p>;
  const link = (url, label) => <a href={url} target="_blank" rel="noopener noreferrer" style={{color:"#14b8a6",textDecoration:"underline"}}>{label}</a>;
  const pill = (text, color="#14b8a6") => (
    <span style={{background:color+"22",color,padding:"0.15rem 0.6rem",borderRadius:"9999px",fontSize:"0.8rem",fontWeight:"600",marginRight:"0.4rem"}}>{text}</span>
  );
  const example = (children) => (
    <div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:"0.5rem",padding:"1rem",margin:"0.75rem 0",fontSize:"0.85rem",color:"#94a3b8",lineHeight:"1.6"}}>
      {children}
    </div>
  );
  const yt = (url, label, lang="🇫🇷") => (
    <div style={{marginBottom:"0.4rem"}}>
      <span style={{color:"#64748b",fontSize:"0.8rem"}}>{lang} </span>
      {link(url, label)}
    </div>
  );

  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto",maxWidth:"860px"}}>
      <h2 style={{color:"#f1f5f9",margin:"0 0 0.5rem"}}>📖 La stratégie de trading</h2>
      <p style={{color:"#64748b",fontSize:"0.875rem",marginBottom:"1.5rem"}}>Explication complète de la stratégie mise en place, avec des exemples concrets.</p>

      {section("Vue d'ensemble", <>
        {p("Ce bot utilise une stratégie de trading systématique appelée Trend Following + Rotation + Volatility Targeting. En clair : le bot investit uniquement dans les cryptos qui montent, choisit la meilleure, et ajuste la taille de la position selon le risque du marché.")}
        {p("Tout est automatique — aucune décision humaine n'est nécessaire au quotidien. Le bot tourne 3 fois par jour (0h, 8h, 16h UTC) et rebalance uniquement quand le signal change.")}
        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",margin:"0.5rem 0"}}>
          {pill("BTC-USD")} {pill("ETH-USD")} {pill("SOL-USD")} {pill("DRY RUN","#f59e0b")} {pill("Paper Trading","#f59e0b")}
        </div>
      </>)}

      {section("Étape 1 — Filtre de tendance (MA 200)", <>
        {p("Avant tout, le bot vérifie si un asset est en tendance haussière. Pour ça, il calcule la Moyenne Mobile sur 200 jours (MA200) : la moyenne des 200 derniers prix de clôture.")}
        {p("Règle simple : si le prix actuel > MA200, l'asset est éligible. Sinon, il est ignoré.")}
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Exemple concret :</strong><br/>
          BTC aujourd'hui : <span style={{color:"#4ade80"}}>$85,000</span><br/>
          MA200 de BTC : <span style={{color:"#94a3b8"}}>$72,000</span><br/>
          85,000 &gt; 72,000 → <span style={{color:"#4ade80"}}>✅ BTC éligible</span><br/><br/>
          ETH aujourd'hui : <span style={{color:"#f87171"}}>$1,800</span><br/>
          MA200 d'ETH : <span style={{color:"#94a3b8"}}>$2,400</span><br/>
          1,800 &lt; 2,400 → <span style={{color:"#f87171"}}>❌ ETH non éligible → 100% cash</span>
        </>)}
        <div style={{marginTop:"0.75rem"}}>
          {yt("https://www.youtube.com/watch?v=4R2CDbw4g88", "Les moyennes mobiles expliquées (La Bourse pour les Nuls)")}
          {yt("https://en.wikipedia.org/wiki/Moving_average", "Wikipedia : Moving Average","🌐")}
        </div>
      </>)}

      {section("Étape 2 — Score de momentum (calibré par asset)", <>
        {p("Parmi les assets éligibles, le bot classe ceux qui ont le plus progressé. C'est le momentum : la vitesse et la direction du mouvement de prix.")}
        {p("Chaque asset a sa propre période de momentum, adaptée à ses cycles naturels :")}
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Périodes par asset :</strong><br/>
          <span style={{color:"#f59e0b"}}>BTC</span> → 120 jours (cycles longs, moins de bruit)<br/>
          <span style={{color:"#94a3b8"}}>ETH</span> → 90 jours (cycles intermédiaires)<br/>
          <span style={{color:"#a78bfa"}}>SOL</span> → 60 jours (très volatile, cycles courts)<br/><br/>
          <strong style={{color:"#f1f5f9"}}>Exemple :</strong><br/>
          BTC momentum 120j : <span style={{color:"#4ade80"}}>+35%</span><br/>
          SOL momentum 60j  : <span style={{color:"#4ade80"}}>+60%</span><br/>
          SOL gagne → <span style={{color:"#14b8a6"}}>le bot investit dans SOL</span>
        </>)}
        {p("Pourquoi des périodes différentes ? Un SOL évalué sur 120j comme BTC serait toujours 'en retard' sur ses propres cycles. Un BTC évalué sur 60j génèrerait des faux signaux sur du bruit normal.")}
        <div style={{marginTop:"0.75rem"}}>
          {yt("https://www.youtube.com/watch?v=PkLm1iA3UQQ", "Momentum investing explained (anglais)","🇬🇧")}
          {yt("https://fr.wikipedia.org/wiki/Effet_de_momentum", "Wikipedia : Effet de momentum","🌐")}
        </div>
      </>)}

      {section("Étape 3 — Volatility Targeting (taille de position)", <>
        {p("Une fois l'asset sélectionné, le bot ne met pas 80% du portefeuille dedans aveuglément. Il ajuste la taille selon la volatilité récente (sur 20 jours) : plus l'asset est volatile, plus la position est petite.")}
        {p("La logique : un asset qui bouge de ±10% par jour est plus risqué qu'un qui bouge de ±3%. En pondérant par l'inverse de la volatilité, le bot prend toujours un risque constant, quelle que soit la crypto choisie.")}
        {p("Plafond maximum : 80% du portefeuille (MAX_GROSS_EXPOSURE = 0.80). Les 20% restants restent toujours en cash.")}
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Exemple :</strong><br/>
          SOL sélectionné, volatilité 20j = 85% annualisé (très volatile)<br/>
          Poids brut = 1/0.85 = 1.18 → normalisé et plafonné à <span style={{color:"#14b8a6"}}>80%</span><br/>
          Portfolio de $500 → <span style={{color:"#4ade80"}}>$400 en SOL + $100 en cash</span>
        </>)}
        <div style={{marginTop:"0.75rem"}}>
          {yt("https://www.youtube.com/watch?v=MQv2RkxEFUQ", "Volatility targeting expliqué (anglais)","🇬🇧")}
          {yt("https://fr.wikipedia.org/wiki/Volatilit%C3%A9_(finance)", "Wikipedia : Volatilité","🌐")}
        </div>
      </>)}

      {section("Étape 4 — Protections (3 mécanismes)", <>
        <div style={{marginBottom:"0.75rem"}}>
          <span style={{color:"#f87171",fontWeight:"700"}}>🔴 Stop-loss ATR dynamique</span>
          <p style={{color:"#cbd5e1",fontSize:"0.9rem",margin:"0.25rem 0 0",lineHeight:"1.6"}}>
            Le stop n'est plus un pourcentage fixe mais 2× l'ATR (Average True Range) depuis le prix d'entrée.
            L'ATR mesure la volatilité réelle des 14 derniers jours. Sur SOL très volatile, le stop s'élargit pour ne pas déclencher sur du bruit. Sur BTC plus calme, il se resserre.
          </p>
        </div>
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Exemple :</strong><br/>
          SOL acheté à $160, ATR(14) = $8<br/>
          Stop ATR = $160 − (2 × $8) = <span style={{color:"#f87171"}}>$144</span> (−10%)<br/><br/>
          BTC acheté à $80,000, ATR(14) = $2,000<br/>
          Stop ATR = $80,000 − (2 × $2,000) = <span style={{color:"#f87171"}}>$76,000</span> (−5%)<br/>
          Le stop s'adapte automatiquement à chaque crypto.
        </>)}
        <div style={{margin:"0.75rem 0"}}>
          <span style={{color:"#f59e0b",fontWeight:"700"}}>🟡 Trailing stop (+20% → −10%)</span>
          <p style={{color:"#cbd5e1",fontSize:"0.9rem",margin:"0.25rem 0 0",lineHeight:"1.6"}}>
            S'active uniquement quand la position est en profit de +20% ou plus.
            Une fois activé, il suit le plus haut atteint et vend si le prix recule de −10% depuis ce plus haut.
            Permet de laisser courir les tendances tout en sécurisant les gains.
          </p>
        </div>
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Exemple :</strong><br/>
          SOL acheté à $160 → monte à $220 (+37.5%) → trailing stop activé<br/>
          Plus haut = $220 → trailing stop = $220 × (1−10%) = <span style={{color:"#f59e0b"}}>$198</span><br/>
          SOL descend à $195 → <span style={{color:"#f87171"}}>vente automatique, profit sécurisé</span>
        </>)}
        <div style={{margin:"0.75rem 0"}}>
          <span style={{color:"#94a3b8",fontWeight:"700"}}>⬜ Anti-whipsaw (24h)</span>
          <p style={{color:"#cbd5e1",fontSize:"0.9rem",margin:"0.25rem 0 0",lineHeight:"1.6"}}>
            Après tout trade, le bot attend 24h avant de retoucher le même asset. Évite les aller-retours coûteux lors des faux signaux.
          </p>
        </div>
        <div style={{marginTop:"0.75rem"}}>
          {yt("https://www.youtube.com/watch?v=VLSsTwMKlnY", "ATR indicator explained (anglais)","🇬🇧")}
          {yt("https://fr.wikipedia.org/wiki/Average_True_Range", "Wikipedia : Average True Range","🌐")}
        </div>
      </>)}

      {section("Quand le bot rebalance-t-il ?", <>
        {p("Le bot vérifie les signaux 3 fois par jour. Mais il ne rebalance QUE si le signal change : si BTC était sélectionné et SOL devient le meilleur, il vend BTC et achète SOL. Si rien ne change, il ne fait rien (HOLD).")}
        {p("Cette approche évite de payer des frais inutilement. Sur Coinbase, les frais taker sont de 0.6% par trade — chaque aller-retour coûte 1.2%.")}
      </>)}

      {section("Paramètres actuels", <>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
          {[
            ["Assets","BTC-USD, ETH-USD, SOL-USD"],
            ["MA Trend","200 jours"],
            ["Momentum BTC","120 jours"],
            ["Momentum ETH","90 jours"],
            ["Momentum SOL","60 jours"],
            ["Volatilité","20 jours"],
            ["ATR stop","2 × ATR(14)"],
            ["Trailing stop","actif à +20%, recul −10%"],
            ["Top K","1 asset à la fois"],
            ["Exposition max","80%"],
            ["Anti-whipsaw","24h"],
            ["Frais simulés","0.4% (équivalent maker)"],
            ["Mode","Paper Trading (DRY RUN)"],
          ].map(([k,v])=>(
            <div key={k} style={{background:"#0f172a",borderRadius:"0.5rem",padding:"0.6rem 0.75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#64748b",fontSize:"0.8rem"}}>{k}</span>
              <span style={{color:"#f1f5f9",fontSize:"0.85rem",fontWeight:"600"}}>{v}</span>
            </div>
          ))}
        </div>
      </>)}

      {section("Ressources pour aller plus loin", <>
        {yt("https://www.youtube.com/watch?v=Aob9l0oIMfo", "Trend Following — la stratégie complète expliquée (français)")}
        {yt("https://www.youtube.com/watch?v=6g4mMQcCp4o", "Momentum trading pour débutants (français)")}
        {yt("https://www.youtube.com/watch?v=QhFHXKRm3qc", "Diversification et volatilité (anglais)","🇬🇧")}
        <div style={{marginTop:"0.75rem"}}>
          {link("https://fr.wikipedia.org/wiki/Gestion_du_risque_en_finance","Wikipedia : Gestion du risque")}
          {" · "}
          {link("https://fr.wikipedia.org/wiki/Ratio_de_Sharpe","Wikipedia : Ratio de Sharpe")}
          {" · "}
          {link("https://fr.wikipedia.org/wiki/Drawdown","Wikipedia : Drawdown")}
        </div>
      </>)}
    </div>
  );
}

function BacktestTab() {
  const [params, setParams] = useState({
    assets: "BTC-USD,ETH-USD,SOL-USD",
    trendMaDays:200,
    momentumDaysBtc:120, momentumDaysEth:90, momentumDaysSol:60,
    volDays:20, atrDays:14, atrMultiplier:2,
    topK:1, maxExposure:0.8, startCash:500, numDays:500,
    trailingStopActivation:0.20, trailingStopPct:0.10,
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/backtest", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...params, assets: params.assets.split(",").map(s=>s.trim()),
          momentumDaysBtc: params.momentumDaysBtc, momentumDaysEth: params.momentumDaysEth,
          momentumDaysSol: params.momentumDaysSol, atrDays: params.atrDays,
          atrMultiplier: params.atrMultiplier, trailingStopActivation: params.trailingStopActivation,
          trailingStopPct: params.trailingStopPct }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||"Backtest failed");
      setResult(d);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  };

  const inp = (key, type="number") => ({
    value: params[key],
    onChange: e => setParams(p=>({...p,[key]: type==="number"?Number(e.target.value):e.target.value})),
    style: {padding:"0.5rem",borderRadius:"0.4rem",border:"1px solid #334155",
      background:"#0f172a",color:"#f1f5f9",fontSize:"0.875rem",width:"100%",boxSizing:"border-box"},
  });

  const paramHelp = {
    assets:                "Les cryptos à analyser. Le bot choisira la meilleure parmi celles-ci.",
    trendMaDays:           "Filtre de tendance : l'asset doit être au-dessus de sa MA sur N jours. Standard : 200.",
    momentumDaysBtc:       "Momentum BTC : 120j car BTC a des cycles longs. Plus long = moins de faux signaux.",
    momentumDaysEth:       "Momentum ETH : 90j. Cycles intermédiaires entre BTC et SOL.",
    momentumDaysSol:       "Momentum SOL : 60j car SOL est très volatile avec des cycles plus courts.",
    volDays:               "Période de calcul de la volatilité pour le sizing. 20j = réactif au risque récent.",
    atrDays:               "Période de l'ATR (Average True Range) pour le stop-loss dynamique. Standard : 14.",
    atrMultiplier:         "Stop-loss = entrée - (multiplicateur × ATR). 2 = stop à 2 fois la volatilité réelle.",
    topK:                  "Nombre d'assets détenus simultanément. 1 = concentration max sur le meilleur signal.",
    maxExposure:           "Exposition maximum. 0.8 = toujours 20% en cash minimum.",
    trailingStopActivation:"Seuil de profit pour activer le trailing stop. 0.20 = s'active à +20%.",
    trailingStopPct:       "Recul maximum depuis le plus haut pour déclencher le trailing stop. 0.10 = -10%.",
    startCash:             "Capital de départ simulé pour le backtest.",
    numDays:               "Nombre de jours d'historique. 500 jours ≈ 1.5 ans.",
  };

  const s = result?.summary;

  const metricHelp = {
    "Total Return":   "Gain total en % sur toute la période. À comparer avec le BTC B&H pour savoir si la stratégie bat le marché.",
    "BTC B&H Return": "Ce qu'un simple achat et conservation de BTC aurait rapporté sur la même période.",
    "CAGR":           "Rendement annualisé. Un CAGR de 40% signifie que le portefeuille double environ tous les 2 ans.",
    "Sharpe Ratio":   "Rendement ajusté au risque. < 0 = mauvais · 0-1 = acceptable · 1-2 = bon · > 2 = excellent (rare en crypto).",
    "Max Drawdown":   "La pire perte depuis un pic. Si -45%, tu aurais perdu 45% de ton sommet à un moment. Question clé : aurais-tu tenu le coup ?",
    "# Trades":       "Nombre de trades total (rebalancements + stops). Frais simulés à 0.4%/trade (équivalent maker).",
    "Days":           "Nombre de jours dans le backtest (après la période de chauffe nécessaire au calcul des moyennes mobiles).",
    "Final Equity":   "Valeur finale du portefeuille simulé.",
  };

  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem"}}>
        <h2 style={{color:"#f1f5f9",margin:0}}>🔬 Backtest</h2>
        <button onClick={()=>setShowHelp(h=>!h)}
          style={{padding:"0.4rem 1rem",background:"#334155",border:"none",borderRadius:"0.5rem",
            color:"#94a3b8",cursor:"pointer",fontSize:"0.8rem"}}>
          {showHelp ? "Masquer l'aide" : "❓ Comment interpréter les résultats ?"}
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem",marginBottom:"1.5rem"}}>
          <h3 style={{color:"#14b8a6",margin:"0 0 1rem",fontSize:"0.95rem"}}>Comment fonctionne le backtest ?</h3>
          <p style={{color:"#cbd5e1",fontSize:"0.875rem",lineHeight:"1.7",margin:"0 0 0.75rem"}}>
            Le backtest rejoue la stratégie jour par jour dans le passé avec les vrais prix historiques de Coinbase.
            Il simule chaque décision d'achat/vente, en incluant les frais (0.6%) et le slippage (0.05%).
          </p>
          <p style={{color:"#cbd5e1",fontSize:"0.875rem",lineHeight:"1.7",margin:"0 0 1rem"}}>
            Il sert à tester des variantes de paramètres avant de les appliquer en live.
            Attention : de bonnes performances passées ne garantissent pas les performances futures.
          </p>
          <h3 style={{color:"#14b8a6",margin:"0 0 0.75rem",fontSize:"0.95rem"}}>Interprétation des métriques</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
            {Object.entries(metricHelp).map(([k,v])=>(
              <div key={k} style={{background:"#0f172a",borderRadius:"0.5rem",padding:"0.75rem"}}>
                <div style={{color:"#f1f5f9",fontSize:"0.8rem",fontWeight:"700",marginBottom:"0.25rem"}}>{k}</div>
                <div style={{color:"#94a3b8",fontSize:"0.8rem",lineHeight:"1.5"}}>{v}</div>
              </div>
            ))}
          </div>
          <h3 style={{color:"#14b8a6",margin:"1rem 0 0.75rem",fontSize:"0.95rem"}}>Les graphiques</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
            <div style={{background:"#0f172a",borderRadius:"0.5rem",padding:"0.75rem"}}>
              <div style={{color:"#14b8a6",fontSize:"0.8rem",fontWeight:"700",marginBottom:"0.25rem"}}>📈 Equity vs BTC B&H</div>
              <div style={{color:"#94a3b8",fontSize:"0.8rem",lineHeight:"1.5"}}>Ligne verte = ton bot. Ligne orange = BTC simple. Si la verte est au-dessus, ta stratégie bat le marché.</div>
            </div>
            <div style={{background:"#0f172a",borderRadius:"0.5rem",padding:"0.75rem"}}>
              <div style={{color:"#f87171",fontSize:"0.8rem",fontWeight:"700",marginBottom:"0.25rem"}}>📉 Drawdown</div>
              <div style={{color:"#94a3b8",fontSize:"0.8rem",lineHeight:"1.5"}}>Les creux = pertes depuis le dernier sommet. Une bonne stratégie a des creux peu profonds et récupère vite.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
        {/* Params */}
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.5rem",minWidth:"280px",flex:"0 0 auto"}}>
          <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>Paramètres</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
            {[
              ["Assets (séparés par virgule)", "assets", "text"],
              ["MA Trend (jours)",          "trendMaDays"],
              ["Momentum BTC (jours)",       "momentumDaysBtc"],
              ["Momentum ETH (jours)",       "momentumDaysEth"],
              ["Momentum SOL (jours)",       "momentumDaysSol"],
              ["Volatilité (jours)",         "volDays"],
              ["ATR (jours)",                "atrDays"],
              ["ATR multiplicateur",         "atrMultiplier"],
              ["Top K",                      "topK"],
              ["Exposition max",             "maxExposure"],
              ["Trailing stop activation",   "trailingStopActivation"],
              ["Trailing stop recul",        "trailingStopPct"],
              ["Capital de départ ($)",      "startCash"],
              ["Historique (jours)",         "numDays"],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label style={{color:"#94a3b8",fontSize:"0.75rem",display:"block",marginBottom:"0.15rem"}}>{label}</label>
                {paramHelp[key] && <div style={{color:"#475569",fontSize:"0.7rem",marginBottom:"0.25rem",lineHeight:"1.4"}}>{paramHelp[key]}</div>}
                <input {...inp(key, type||"number")} />
              </div>
            ))}
            <button onClick={run} disabled={loading}
              style={{padding:"0.75rem",background:"#14b8a6",border:"none",borderRadius:"0.5rem",
                color:"white",fontWeight:"600",cursor:"pointer",opacity:loading?0.6:1,marginTop:"0.5rem"}}>
              {loading ? "⏳ Calcul en cours (~30s)..." : "▶ Lancer le backtest"}
            </button>
          </div>
          {error && <p style={{color:"#f87171",fontSize:"0.875rem",marginTop:"0.75rem"}}>{error}</p>}
        </div>

        {/* Results */}
        {s && (
          <div style={{flex:1,minWidth:"300px",display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div style={{display:"flex",gap:"1rem",flexWrap:"wrap"}}>
              <Card label="Total Return"    value={fmtP(s.totalReturn)}   color={clr(s.totalReturn)} />
              <Card label="BTC B&H Return"  value={fmtP(s.btcReturn)}     color={clr(s.btcReturn)} />
              <Card label="CAGR"            value={fmtP(s.cagr)}          color={clr(s.cagr)} />
              <Card label="Sharpe Ratio"    value={fmt(s.sharpe)}         color={s.sharpe>1?"#4ade80":s.sharpe>0?"#f59e0b":"#f87171"} />
              <Card label="Max Drawdown"    value={`${fmt(s.maxDrawdown,1)}%`} color={s.maxDrawdown<-20?"#f87171":"#94a3b8"} />
              <Card label="# Trades"        value={s.numTrades} />
              <Card label="Jours"           value={s.days} />
              <Card label="Final Equity"    value={`$${fmt(s.finalEquity)}`} />
            </div>

            <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
              <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>Equity vs BTC Buy&Hold</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:10}} tickFormatter={d=>d?.slice(2)} interval="preserveStartEnd" />
                  <YAxis tick={{fill:"#64748b",fontSize:11}} tickFormatter={v=>`$${v}`} />
                  <Tooltip contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:"0.5rem"}}
                    formatter={v=>`$${fmt(v)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="equity" name="Stratégie" stroke="#14b8a6" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="btcBH"  name="BTC B&H"   stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
              <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>Drawdown</h3>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:10}} tickFormatter={d=>d?.slice(2)} interval="preserveStartEnd" />
                  <YAxis tick={{fill:"#64748b",fontSize:11}} tickFormatter={v=>`${v}%`} />
                  <Tooltip formatter={v=>`${fmt(v,1)}%`} contentStyle={{background:"#1e293b",border:"1px solid #334155"}} />
                  <ReferenceLine y={0} stroke="#334155" />
                  <Line type="monotone" dataKey="drawdown" name="Drawdown" stroke="#f87171" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────
function HistoryTab({ trades }) {
  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto"}}>
      <h2 style={{color:"#f1f5f9",margin:"0 0 1.5rem"}}>📜 Trade History</h2>
      <div style={{background:"#1e293b",borderRadius:"0.75rem",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem",whiteSpace:"nowrap"}}>
          <thead>
            <tr style={{background:"#0f172a"}}>
              {["Time","Type","Asset","Qty","Price","Notional","Fee","PnL","Comment"].map(h=>(
                <th key={h} style={{padding:"0.7rem 0.8rem",textAlign:"left",color:"#94a3b8",fontWeight:"600",fontSize:"0.7rem",textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(trades||[]).map((t,i)=>(
              <tr key={i} style={{borderTop:"1px solid #334155"}}>
                <td style={{padding:"0.65rem 0.8rem",color:"#64748b"}}>{t.timestamp?.slice(0,16)}</td>
                <td style={{padding:"0.65rem 0.8rem",color:t.type==="BUY"?"#4ade80":"#f87171",fontWeight:"700"}}>{t.type}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#f1f5f9",fontWeight:"600"}}>{t.asset}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#94a3b8"}}>{fmt(t.quantity,6)}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#f1f5f9"}}>${fmt(t.price)}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#f1f5f9"}}>${fmt(t.notional)}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#94a3b8"}}>${fmt(t.fee,4)}</td>
                <td style={{padding:"0.65rem 0.8rem",color:clr(t.pnl)}}>{t.pnl!=0?`$${fmt(t.pnl)}`:"—"}</td>
                <td style={{padding:"0.65rem 0.8rem",color:"#64748b"}}>{t.comment||"—"}</td>
              </tr>
            ))}
            {(!trades||trades.length===0)&&(
              <tr><td colSpan="9" style={{padding:"2rem",textAlign:"center",color:"#64748b"}}>No trades yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LOGS TAB ─────────────────────────────────────────────────────────────────
function LogsTab({ logs }) {
  const color = { ERROR:"#f87171", WARN:"#f59e0b", INFO:"#4ade80" };
  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto"}}>
      <h2 style={{color:"#f1f5f9",margin:"0 0 1.5rem"}}>📋 System Logs</h2>
      <div style={{background:"#0f172a",borderRadius:"0.75rem",padding:"1rem",fontFamily:"monospace",fontSize:"0.8rem"}}>
        {(logs||[]).slice().reverse().map((l,i)=>(
          <div key={i} style={{padding:"0.25rem 0",borderBottom:"1px solid #1e293b"}}>
            <span style={{color:"#475569"}}>{l.timestamp} </span>
            <span style={{color:color[l.level]||"#94a3b8",fontWeight:"700"}}>[{l.level}] </span>
            <span style={{color:"#cbd5e1"}}>{l.message}</span>
            {l.run_id && <span style={{color:"#475569"}}> [{l.run_id}]</span>}
          </div>
        ))}
        {(!logs||logs.length===0)&&<div style={{color:"#64748b",textAlign:"center",padding:"1rem"}}>No logs yet</div>}
      </div>
    </div>
  );
}

// ─── CONFIG TAB ─────────────────────────────────────────────────────────────
function ChangelogSection() {
  const [open, setOpen] = useState(null);
  // Most recent first
  const entries = [...CHANGELOG].reverse();
  return (
    <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem",maxWidth:"600px",marginTop:"1rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.9rem"}}>
        <span style={{color:"#f1f5f9",fontWeight:"700",fontSize:"0.95rem"}}>📋 Changelog</span>
        <span style={{background:"#14b8a622",color:"#14b8a6",fontSize:"0.72rem",
          padding:"0.15rem 0.5rem",borderRadius:"9999px",fontWeight:"700"}}>v{APP_VERSION}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {entries.map((entry, idx) => {
          const isOpen    = open === entry.version;
          const isCurrent = entry.version === APP_VERSION;
          return (
            <div key={entry.version} style={{borderRadius:"0.5rem",overflow:"hidden",
              border:`1px solid ${isCurrent ? "#14b8a633" : "#1e293b"}`}}>
              {/* Row */}
              <button onClick={() => setOpen(isOpen ? null : entry.version)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"0.75rem",
                  padding:"0.55rem 0.75rem",background: isOpen ? "#0f172a" : "transparent",
                  border:"none",cursor:"pointer",textAlign:"left"}}>
                <span style={{color: isCurrent ? "#14b8a6" : "#64748b",fontWeight:"700",
                  fontSize:"0.82rem",minWidth:"52px"}}>v{entry.version}</span>
                <span style={{color:"#475569",fontSize:"0.75rem",minWidth:"80px"}}>{entry.date}</span>
                <span style={{color:"#64748b",fontSize:"0.75rem",fontStyle:"italic",flex:1}}>{entry.label}</span>
                <span style={{color:"#475569",fontSize:"0.75rem",transition:"transform 0.2s",
                  display:"inline-block",transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"}}>▶</span>
              </button>
              {/* Detail */}
              {isOpen && (
                <div style={{background:"#0f172a",padding:"0.6rem 0.75rem 0.75rem",
                  borderTop:"1px solid #1e293b"}}>
                  <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:"0.25rem"}}>
                    {entry.changes.map((c, i) => (
                      <li key={i} style={{display:"flex",gap:"0.5rem",alignItems:"flex-start"}}>
                        <span style={{color:"#334155",fontSize:"0.7rem",marginTop:"0.2rem",flexShrink:0}}>▸</span>
                        <span style={{color:"#94a3b8",fontSize:"0.78rem",lineHeight:"1.6"}}>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigTab({ config }) {
  const fields = [
    ["Product IDs","PRODUCT_IDS"],["MA Trend Days","TREND_MA_DAYS"],
    ["Momentum BTC (j)","MOMENTUM_DAYS_BTC"],["Momentum ETH (j)","MOMENTUM_DAYS_ETH"],
    ["Momentum SOL (j)","MOMENTUM_DAYS_SOL"],["Vol Days","VOL_DAYS"],
    ["ATR Days","ATR_DAYS"],["ATR Multiplier","ATR_MULTIPLIER"],
    ["Trailing Activation","TRAILING_STOP_ACTIVATION"],["Trailing Stop %","TRAILING_STOP_PCT"],
    ["Top K","TOP_K"],["Max Exposure","MAX_GROSS_EXPOSURE"],
    ["Fee Taker (bps)","FEE_TAKER_BPS"],["Slippage (bps)","SLIPPAGE_BPS"],
    ["Stop Loss %","STOP_LOSS_PCT"],["Anti-Whipsaw Hours","ANTI_WHIPSAW_HOURS"],
    ["Start Cash","PAPER_START_CASH_USD"],["Mode","DRY_RUN"],
  ];
  return (
    <div style={{flex:1,padding:"1.5rem",overflowY:"auto"}}>
      <h2 style={{color:"#f1f5f9",margin:"0 0 1.5rem"}}>⚙️ Configuration</h2>
      <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.5rem",maxWidth:"600px"}}>
        {fields.map(([label, key])=>(
          <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"0.6rem 0",
            borderBottom:"1px solid #334155",fontSize:"0.875rem"}}>
            <span style={{color:"#94a3b8"}}>{label}</span>
            <span style={{color:"#f1f5f9",fontWeight:"600"}}>{config?.[key] ?? "—"}</span>
          </div>
        ))}
        <p style={{color:"#475569",fontSize:"0.8rem",marginTop:"1rem"}}>
          Pour modifier ces valeurs, mettre à jour les variables d'environnement Vercel et redéployer.
        </p>
      </div>

      {/* Changelog */}
      <ChangelogSection />
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed]           = useState(!!sessionStorage.getItem("auth"));
  const [tab, setTab]                 = useState("Dashboard");
  const [portfolio, setPortfolio]     = useState(null);
  const [signals, setSignals]         = useState([]);
  const [trades, setTrades]           = useState([]);
  const [logs, setLogs]               = useState([]);
  const [config, setConfig]           = useState(null);
  const [equityHistory, setEquityHist]= useState([]);
  const [rebalancing, setRebalancing] = useState(false);
  const [lastUpdate, setLastUpdate]   = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, t, l, c] = await Promise.all([
        fetch("/api/portfolio").then(r=>r.json()).catch(()=>null),
        fetch("/api/signals").then(r=>r.json()).catch(()=>null),
        fetch("/api/trades").then(r=>r.json()).catch(()=>null),
        fetch("/api/logs").then(r=>r.json()).catch(()=>null),
        fetch("/api/config").then(r=>r.json()).catch(()=>null),
      ]);
      if (p) setPortfolio(p);
      if (s?.signals) setSignals(s.signals);
      if (t?.trades)  setTrades(t.trades);
      if (l?.logs)    setLogs(l.logs);
      if (c)          setConfig(c);

      // Build BTC benchmark for equity history from signals
      // (live equity history via Google Sheets not yet plumbed here — use portfolio snapshots)
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll, authed]);

  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      await fetch("/api/rebalance", { method:"POST",
        headers:{"Content-Type":"application/json","x-dashboard":"true"} });
      await fetchAll();
    } catch(e) { console.error(e); }
    setRebalancing(false);
  };

  if (!authed) return <LoginScreen onLogin={()=>setAuthed(true)} />;

  const isRunning = !!portfolio?.initialized;
  const dryRun    = portfolio?.dry_run !== false;

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",fontFamily:"system-ui,sans-serif",color:"#f1f5f9"}}>
      <Nav tab={tab} setTab={setTab} />
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.75rem 1.5rem",
          background:"#1e293b",borderBottom:"1px solid #334155",gap:"1rem"}}>
          <h1 style={{margin:0,fontSize:"1.1rem",fontWeight:"700",color:"#f1f5f9"}}>{tab}</h1>
          <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
            {isRunning && <span style={{background:"#052e16",color:"#4ade80",padding:"0.25rem 0.75rem",borderRadius:"9999px",fontSize:"0.75rem",fontWeight:"700"}}>● RUNNING</span>}
            {dryRun    && <span style={{background:"#1e3a5f",color:"#60a5fa",padding:"0.25rem 0.75rem",borderRadius:"9999px",fontSize:"0.75rem",fontWeight:"700"}}>DRY RUN</span>}
            {config?.coinbase_configured && <span style={{background:"#052e16",color:"#4ade80",padding:"0.25rem 0.75rem",borderRadius:"9999px",fontSize:"0.75rem"}}>API ✓</span>}
            <span style={{color:"#64748b",fontSize:"0.8rem"}}>🕐 {lastUpdate}</span>
            <button onClick={fetchAll}
              style={{padding:"0.4rem 1rem",background:"#334155",border:"none",borderRadius:"0.5rem",
                color:"#f1f5f9",cursor:"pointer",fontSize:"0.875rem"}}>Refresh</button>
          </div>
        </div>

        {/* Page content */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          {tab==="Dashboard"  && <DashboardTab portfolio={portfolio} equityHistory={equityHistory} signals={signals} trades={trades} onRebalance={handleRebalance} rebalancing={rebalancing} />}
          {tab==="Signals"    && <SignalsTab   signals={signals} />}
          {tab==="Backtest"   && <BacktestTab />}
          {tab==="Stratégie"  && <StrategyTab />}
          {tab==="History"    && <HistoryTab   trades={trades} />}
          {tab==="Logs"       && <LogsTab      logs={logs} />}
          {tab==="Config"     && <ConfigTab    config={config} />}
        </div>
      </div>
    </div>
  );
}
