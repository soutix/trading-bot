import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";

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
  return (
    <div style={{width:"200px",minHeight:"100vh",background:"#1e293b",padding:"1.5rem 1rem",
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
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ portfolio, equityHistory, onRebalance, rebalancing }) {
  if (!portfolio?.initialized) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",background:"#1e293b",padding:"3rem",borderRadius:"1rem",maxWidth:"480px"}}>
        <div style={{fontSize:"3rem",marginBottom:"1rem"}}>⚡</div>
        <h3 style={{color:"#f1f5f9",margin:"0 0 0.75rem"}}>Bot not initialized yet</h3>
        <p style={{color:"#94a3b8",marginBottom:"2rem"}}>Configure your Coinbase API keys first, then trigger an initial rebalance.</p>
        <button onClick={onRebalance} disabled={rebalancing}
          style={{padding:"0.875rem 2rem",background:"#14b8a6",border:"none",borderRadius:"0.75rem",
            color:"white",fontSize:"1rem",fontWeight:"600",cursor:"pointer",opacity:rebalancing?0.6:1}}>
          {rebalancing ? "⏳ Running..." : "▶ Run First Rebalance"}
        </button>
      </div>
    </div>
  );

  const pnl = portfolio.pnl || 0;
  const dd  = portfolio.current_drawdown != null ? portfolio.current_drawdown * 100 : null;
  const maxDD = portfolio.max_drawdown_ever != null ? portfolio.max_drawdown_ever * 100 : null;

  return (
    <div style={{flex:1,padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1.25rem",overflowY:"auto"}}>
      {/* Metrics row */}
      <div style={{display:"flex",gap:"1rem",flexWrap:"wrap"}}>
        <Card label="Total Equity"  value={`$${fmt(portfolio.total_equity)}`} />
        <Card label="Cash"          value={`$${fmt(portfolio.cash_usd)}`} sub={`${fmt(portfolio.cash_usd/portfolio.total_equity*100,1)}%`} />
        <Card label="Invested"      value={`$${fmt(portfolio.invested)}`}  sub={`${fmt(portfolio.invested/portfolio.total_equity*100,1)}%`} />
        <Card label="P&L"           value={`$${fmt(pnl)}`}   sub={fmtP(portfolio.pnl_pct)}   color={clr(pnl)} />
        <Card label="Max Drawdown"  value={maxDD != null ? `${fmt(maxDD,1)}%` : "—"} color={maxDD < -5 ? "#f87171" : "#94a3b8"} />
        <Card label="Curr. Drawdown" value={dd != null ? `${fmt(dd,1)}%` : "—"} color={dd < -3 ? "#f87171" : "#4ade80"} />
        <Card label="Fees Paid"     value={`$${fmt(portfolio.cumulative_fees,4)}`} />
      </div>

      {/* Equity chart */}
      {equityHistory.length > 1 && (
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
          <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>📈 Equity vs BTC Buy&Hold</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={equityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:11}} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{fill:"#64748b",fontSize:11}} tickFormatter={v=>`$${v}`} />
              <Tooltip contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:"0.5rem"}}
                labelStyle={{color:"#94a3b8"}} itemStyle={{color:"#f1f5f9"}} formatter={v=>`$${fmt(v)}`} />
              <Legend />
              <Line type="monotone" dataKey="equity"   name="Bot Equity"     stroke="#14b8a6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="btcBH"    name="BTC Buy&Hold"   stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Drawdown chart */}
      {equityHistory.length > 1 && (
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
          <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>📉 Drawdown</h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={equityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:11}} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{fill:"#64748b",fontSize:11}} tickFormatter={v=>`${v}%`} />
              <Tooltip contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:"0.5rem"}}
                formatter={v=>`${fmt(v,1)}%`} />
              <ReferenceLine y={0} stroke="#334155" />
              <Line type="monotone" dataKey="drawdown" name="Drawdown %" stroke="#f87171" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Positions */}
      {Object.keys(portfolio.positions||{}).length > 0 && (
        <div style={{background:"#1e293b",borderRadius:"0.75rem",padding:"1.25rem"}}>
          <h3 style={{color:"#f1f5f9",margin:"0 0 1rem",fontSize:"1rem"}}>📦 Positions</h3>
          {Object.entries(portfolio.positions).map(([asset, pos]) => (
            <div key={asset} style={{display:"flex",justifyContent:"space-between",padding:"0.5rem 0",
              borderBottom:"1px solid #334155",color:"#f1f5f9",fontSize:"0.9rem"}}>
              <span style={{fontWeight:"600"}}>{asset}</span>
              <span>{fmt(pos.units,6)} units @ ${fmt(pos.avg_price)}</span>
              <span style={{color:"#14b8a6"}}>{fmt(pos.weight*100,1)}%</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onRebalance} disabled={rebalancing}
        style={{padding:"0.875rem",background:"#14b8a6",border:"none",borderRadius:"0.75rem",
          color:"white",fontSize:"1rem",fontWeight:"600",cursor:"pointer",opacity:rebalancing?0.6:1,alignSelf:"flex-start"}}>
        {rebalancing ? "⏳ Running..." : "⚡ Force Rebalance Now"}
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

      {section("Étape 2 — Score de momentum (90 jours)", <>
        {p("Parmi les assets éligibles, le bot classe ceux qui ont le plus progressé sur les 90 derniers jours. C'est le momentum : la vitesse et la direction du mouvement de prix.")}
        {p("Formule : (prix aujourd'hui - prix il y a 90j) / prix il y a 90j. Le score le plus élevé gagne.")}
        {example(<>
          <strong style={{color:"#f1f5f9"}}>Exemple :</strong><br/>
          BTC il y a 90j : $60,000 → aujourd'hui $85,000 → momentum = <span style={{color:"#4ade80"}}>+41.7%</span><br/>
          SOL il y a 90j : $100 → aujourd'hui $160 → momentum = <span style={{color:"#4ade80"}}>+60.0%</span><br/><br/>
          SOL gagne → <span style={{color:"#14b8a6"}}>le bot investit dans SOL</span>
        </>)}
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

      {section("Étape 4 — Protections", <>
        {p("Deux mécanismes protègent le portefeuille contre les pertes extrêmes :")}
        <div style={{marginBottom:"0.75rem"}}>
          <span style={{color:"#f87171",fontWeight:"700"}}>Stop-loss (-8%)</span>
          <p style={{color:"#cbd5e1",fontSize:"0.9rem",margin:"0.25rem 0 0",lineHeight:"1.6"}}>Si une position perd plus de 8% depuis le prix d'entrée, le bot la vend immédiatement — même entre deux rebalancements. Protège contre les chutes soudaines.</p>
        </div>
        {example(<>
          SOL acheté à $160. Si SOL tombe à $147.2 (-8%) → <span style={{color:"#f87171"}}>vente automatique</span>
        </>)}
        <div style={{margin:"0.75rem 0"}}>
          <span style={{color:"#f59e0b",fontWeight:"700"}}>Anti-whipsaw (24h)</span>
          <p style={{color:"#cbd5e1",fontSize:"0.9rem",margin:"0.25rem 0 0",lineHeight:"1.6"}}>Après un trade sur un asset, le bot attend 24h avant d'y retoucher. Évite les aller-retours coûteux quand le marché hésite (whipsaw = "coup de scie").</p>
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
            ["Momentum","90 jours"],
            ["Volatilité","20 jours"],
            ["Top K","1 asset à la fois"],
            ["Exposition max","80%"],
            ["Stop-loss","−8%"],
            ["Anti-whipsaw","24h"],
            ["Frais taker","0.6%"],
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
    assets: "BTC-USD,ETH-USD,SOL-USD", trendMaDays:200, momentumDays:90,
    volDays:20, topK:1, maxExposure:0.8, startCash:500, numDays:500,
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
        body: JSON.stringify({ ...params, assets: params.assets.split(",").map(s=>s.trim()) }),
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
    assets:       "Les cryptos à analyser. Le bot choisira la meilleure parmi celles-ci.",
    trendMaDays:  "Filtre de tendance : l'asset doit être au-dessus de sa moyenne mobile sur N jours pour être éligible. Valeur standard : 200.",
    momentumDays: "Période de momentum : l'asset avec la meilleure performance sur N jours est sélectionné. Valeur standard : 90.",
    volDays:      "Période de calcul de la volatilité pour ajuster la taille de position. Plus court = plus réactif au risque récent.",
    topK:         "Nombre d'assets détenus simultanément. 1 = concentration maximale (meilleure performance en tendance forte).",
    maxExposure:  "Pourcentage maximum du portefeuille investi. 0.8 = toujours 20% en cash minimum.",
    startCash:    "Capital de départ simulé pour le backtest.",
    numDays:      "Nombre de jours d'historique à utiliser. 500 jours ≈ 1.5 ans.",
  };

  const s = result?.summary;

  const metricHelp = {
    "Total Return":   "Gain total en % sur toute la période. À comparer avec le BTC B&H pour savoir si la stratégie bat le marché.",
    "BTC B&H Return": "Ce qu'un simple achat et conservation de BTC aurait rapporté sur la même période.",
    "CAGR":           "Rendement annualisé. Un CAGR de 40% signifie que le portefeuille double environ tous les 2 ans.",
    "Sharpe Ratio":   "Rendement ajusté au risque. < 0 = mauvais · 0-1 = acceptable · 1-2 = bon · > 2 = excellent (rare en crypto).",
    "Max Drawdown":   "La pire perte depuis un pic. Si -45%, tu aurais perdu 45% de ton sommet à un moment. Question clé : aurais-tu tenu le coup ?",
    "# Trades":       "Nombre de rebalancements. Moins il y en a, moins on paie de frais. Chaque trade coûte ~1.2% aller-retour.",
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
              ["MA Trend Days",      "trendMaDays"],
              ["Momentum Days",      "momentumDays"],
              ["Vol Days",           "volDays"],
              ["Top K",              "topK"],
              ["Max Exposure",       "maxExposure"],
              ["Start Cash ($)",     "startCash"],
              ["History Days",       "numDays"],
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
function ConfigTab({ config }) {
  const fields = [
    ["Product IDs","PRODUCT_IDS"],["MA Trend Days","TREND_MA_DAYS"],["Momentum Days","MOMENTUM_DAYS"],
    ["Vol Days","VOL_DAYS"],["Top K","TOP_K"],["Max Exposure","MAX_GROSS_EXPOSURE"],
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
          To change these values, update Vercel environment variables and redeploy.
        </p>
      </div>
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
          {tab==="Dashboard"  && <DashboardTab portfolio={portfolio} equityHistory={equityHistory} onRebalance={handleRebalance} rebalancing={rebalancing} />}
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
