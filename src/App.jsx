import React, { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [data, setData] = useState({
    portfolio: null,
    trades: [],
    logs: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeToNext, setTimeToNext] = useState("");
  const [isRebalancing, setIsRebalancing] = useState(false);

  // --- RÉCUPÉRATION DES DONNÉES ---
  const fetchAll = async () => {
    try {
      const [portfolioRes, tradesRes, logsRes] = await Promise.all([
        fetch("/api/portfolio").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/trades").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/logs").then((r) => (r.ok ? r.json() : [])),
      ]);

      setData({
        portfolio: portfolioRes,
        trades: tradesRes || [],
        logs: logsRes || [],
      });
    } catch (error) {
      console.error("Erreur de récupération:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- COMPTEUR TEMPS RÉEL ---
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      let nextHour = 8;
      if (utcHours >= 8 && utcHours < 16) nextHour = 16;
      else if (utcHours >= 16) nextHour = 24;

      const nextDate = new Date(now);
      nextDate.setUTCHours(nextHour, 0, 0, 0);

      const diffMs = nextDate - now;
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);

      const format = (num) => num.toString().padStart(2, "0");
      setTimeToNext(`${format(h)}h ${format(m)}m ${format(s)}s`);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  const handleForceRebalance = async () => {
    if (!window.confirm("Forcer une analyse du marché maintenant ?")) return;
    setIsRebalancing(true);
    try {
      await fetch("/api/rebalance", { method: "POST" });
      await fetchAll(); 
    } catch (error) {
      console.error(error);
      alert("Erreur. Consultez la console.");
    } finally {
      setIsRebalancing(false);
    }
  };

  const botState = data.portfolio?.botState || {
    current_mode: "CASH", active_asset: "-", entry_price: 0, trailing_stop_level: 0, position_size: 0,
  };

  const logs = Array.isArray(data.logs) ? data.logs : [];
  const trades = Array.isArray(data.trades) ? data.trades : [];
  
  // Extraction de la dernière analyse
  const latestAnalysis = logs.find(l => l.log_type === 'ANALYSIS' || l.log_type === 'INFO') || logs[0];

  const statusColors = botState.current_mode === "LONG" ? { bg: "#052e16", text: "#4ade80" } : 
                       botState.current_mode === "SHORT" ? { bg: "#450a0a", text: "#f87171" } : 
                       { bg: "#334155", text: "#f8fafc" };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h2>Chargement du Centre de Contrôle...</h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif", display: "flex", flexDirection: "column" }}>
      
      {/* INJECTION DU CSS POUR L'ANIMATION */}
      <style>
        {`
          @keyframes pulse-green {
            0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); }
            100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
          }
          .status-dot {
            display: inline-block;
            width: 12px;
            height: 12px;
            background-color: #4ade80;
            border-radius: 50%;
            animation: pulse-green 2s infinite;
          }
        `}
      </style>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1e293b", padding: "1rem 2rem", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="status-dot"></span> 🤖 CryptoBot V2
          </h1>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Architecture Hyperliquid + Supabase</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: "bold" }}>Prochain cycle auto</span>
            <span style={{ color: "#38bdf8", fontSize: "1rem", fontWeight: "bold", fontFamily: "monospace" }}>⏱ {timeToNext}</span>
          </div>

          <span style={{ background: statusColors.bg, color: statusColors.text, padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: "bold" }}>
            ÉTAT : {botState.current_mode}
          </span>
          
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleForceRebalance} disabled={isRebalancing} style={{ padding: "0.5rem 1rem", background: isRebalancing ? "#475569" : "#f59e0b", border: "none", borderRadius: "0.5rem", color: "white", cursor: isRebalancing ? "not-allowed" : "pointer", fontWeight: "bold", transition: "0.2s" }}>
              {isRebalancing ? "⏳ Analyse..." : "⚡ Forcer Rebalance"}
            </button>
            <button onClick={fetchAll} style={{ padding: "0.5rem 1rem", background: "#3b82f6", border: "none", borderRadius: "0.5rem", color: "white", cursor: "pointer", fontWeight: "bold" }}>Rafraîchir</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "0.5rem", padding: "1rem 2rem", borderBottom: "1px solid #334155", overflowX: "auto" }}>
        {["Dashboard", "Stratégie V2", "Historique Trades", "Logs Système"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "0.5rem 1rem", background: tab === t ? "#3b82f6" : "#1e293b", color: tab === t ? "#ffffff" : "#cbd5e1", border: "1px solid #334155", borderRadius: "0.5rem", cursor: "pointer", fontWeight: tab === t ? "bold" : "normal" }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div style={{ padding: "2rem", flex: 1, overflowY: "auto" }}>
        
        {tab === "Dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            
            {/* LE NOUVEAU SCANNER DE MARCHÉ */}
            <div style={{ background: "linear-gradient(145deg, #1e293b, #0f172a)", padding: "1.5rem", borderRadius: "1rem", border: "1px solid #38bdf8", gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem 0", color: "#38bdf8", textTransform: "uppercase", fontSize: "0.9rem", display: "flex", justifyContent: "space-between" }}>
                <span>Radar de Marché (Dernier Résultat)</span>
                <span style={{ color: "#64748b", fontWeight: "normal" }}>
                  {latestAnalysis?.timestamp ? new Date(latestAnalysis.timestamp).toLocaleString("fr-FR") : "-"}
                </span>
              </h3>
              <p style={{ margin: 0, fontSize: "1.1rem", lineHeight: "1.6", color: "#f8fafc" }}>
                {latestAnalysis ? latestAnalysis.message : "Aucune analyse enregistrée pour le moment. Forcez un rebalance pour commencer."}
              </p>
            </div>

            <Card title="Actif Cible" value={botState.active_asset || "Aucun"} />
            <Card title="Prix d'Entrée" value={botState.entry_price ? `${parseFloat(botState.entry_price).toFixed(2)} $` : "-"} />
            <Card title="Trailing Stop" value={botState.trailing_stop_level ? `${parseFloat(botState.trailing_stop_level).toFixed(2)} $` : "-"} valueColor="#f59e0b" />
            <Card title="Taille (Unités)" value={botState.position_size ? parseFloat(botState.position_size).toFixed(4) : "0"} />
          </div>
        )}

        {/* ONGLET LOGS AMÉLIORÉ */}
        {tab === "Logs Système" && (
          <div style={{ background: "#000000", borderRadius: "1rem", padding: "1.5rem", border: "1px solid #334155", fontFamily: "monospace", minHeight: "400px" }}>
            {logs.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center" }}>En attente de la première exécution du bot...</p>
            ) : (
              logs.map((log, i) => {
                // Couleurs selon le type
                let color = "#cbd5e1";
                if (log.log_type === "ERROR") color = "#f87171";
                else if (log.log_type === "ANALYSIS") color = "#38bdf8";
                else if (log.log_type === "TRADE") color = "#4ade80";

                return (
                  <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid #1e293b", color: color }}>
                    <span style={{ color: "#64748b", marginRight: "1rem" }}>[{log.timestamp ? new Date(log.timestamp).toLocaleTimeString("fr-FR") : "-"}]</span>
                    <span style={{ fontWeight: "bold", marginRight: "0.5rem", background: `${color}22`, padding: "2px 6px", borderRadius: "4px" }}>
                      {log.log_type}
                    </span>
                    <span>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* STRATÉGIE & TRADES (Raccourcis pour l'exemple, garde ceux du code précédent) */}
        {tab === "Stratégie V2" && (
          <div style={{ background: "#1e293b", padding: "2rem", borderRadius: "1rem", border: "1px solid #334155" }}>
            <h2 style={{ color: "#f8fafc", marginTop: 0 }}>🧠 Explication de la Stratégie V2</h2>
            <p style={{ color: "#94a3b8", lineHeight: "1.6" }}>Le bot gère 3 états (Long, Short, Cash) basés sur la MA200, la Pente, et un Stop-Loss ATR adaptatif.</p>
          </div>
        )}
        
        {tab === "Historique Trades" && (
          <div style={{ background: "#1e293b", borderRadius: "1rem", overflow: "hidden", border: "1px solid #334155" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead style={{ background: "#0f172a" }}>
                <tr><th style={{ padding: "1rem", color: "#94a3b8" }}>Date</th><th style={{ padding: "1rem", color: "#94a3b8" }}>Actif</th><th style={{ padding: "1rem", color: "#94a3b8" }}>Direction</th><th style={{ padding: "1rem", color: "#94a3b8" }}>PnL</th></tr>
              </thead>
              <tbody>
                {trades.length === 0 ? <tr><td colSpan="4" style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Aucun trade enregistré.</td></tr> : trades.map((trade, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "1rem" }}>{new Date(trade.close_date).toLocaleString("fr-FR")}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{trade.asset}</td>
                    <td style={{ padding: "1rem", color: trade.direction === "LONG" ? "#4ade80" : "#f87171" }}>{trade.direction}</td>
                    <td style={{ padding: "1rem" }}>{trade.pnl_percentage ? `${trade.pnl_percentage}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

function Card({ title, value, valueColor = "#f8fafc" }) {
  return (
    <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "1rem", border: "1px solid #334155" }}>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "#94a3b8", textTransform: "uppercase" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: valueColor }}>{value}</p>
    </div>
  );
}