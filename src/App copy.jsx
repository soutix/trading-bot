import React, { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [data, setData] = useState({
    portfolio: null,
    trades: [],
    logs: [],
    signals: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeToNext, setTimeToNext] = useState("");
  const [isRebalancing, setIsRebalancing] = useState(false);

  // --- RÉCUPÉRATION DES DONNÉES (SUPABASE) ---
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
    const interval = setInterval(fetchAll, 60000); // MAJ silencieuse toutes les minutes
    return () => clearInterval(interval);
  }, []);

  // --- COMPTEUR TEMPS RÉEL (CYCLE 8H UTC) ---
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      
      // Calculer la prochaine heure cible (8h, 16h, ou 24h/00h)
      let nextHour = 8;
      if (utcHours >= 8 && utcHours < 16) nextHour = 16;
      else if (utcHours >= 16) nextHour = 24;

      const nextDate = new Date(now);
      nextDate.setUTCHours(nextHour, 0, 0, 0);

      const diffMs = nextDate - now;
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);

      // Formater pour toujours avoir 2 chiffres (ex: 08m 05s)
      const format = (num) => num.toString().padStart(2, "0");
      setTimeToNext(`${format(h)}h ${format(m)}m ${format(s)}s`);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // --- FORCER LE REBALANCE MANUELLEMENT ---
  const handleForceRebalance = async () => {
    if (!window.confirm("Voulez-vous forcer le réveil du bot maintenant ? (Il va analyser le marché et potentiellement prendre une position sur le Testnet).")) return;
    
    setIsRebalancing(true);
    try {
      const res = await fetch("/api/rebalance", { method: "POST" });
      const result = await res.json();
      console.log("Résultat du Rebalance manuel :", result);
      
      // On rafraîchit immédiatement le dashboard pour voir les changements
      await fetchAll(); 
    } catch (error) {
      console.error("Erreur lors du force rebalance:", error);
      alert("Erreur lors de l'exécution du bot. Consultez la console.");
    } finally {
      setIsRebalancing(false);
    }
  };

  // --- SÉCURISATION DES DONNÉES ---
  const botState = data.portfolio?.botState || {
    current_mode: "CASH",
    active_asset: "-",
    entry_price: 0,
    trailing_stop_level: 0,
    position_size: 0,
  };

  const trades = Array.isArray(data.trades) ? data.trades : [];
  const logs = Array.isArray(data.logs) ? data.logs : [];

  // Couleurs dynamiques pour le statut
  const getStatusColor = (mode) => {
    if (mode === "LONG") return { bg: "#052e16", text: "#4ade80" }; // Vert
    if (mode === "SHORT") return { bg: "#450a0a", text: "#f87171" }; // Rouge
    return { bg: "#334155", text: "#f8fafc" }; // Gris (CASH)
  };
  const statusColors = getStatusColor(botState.current_mode);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h2>Connexion à Supabase et Hyperliquid en cours...</h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER AVEC COMPTEUR ET BOUTONS */}
      <div style={{ backgroundColor: "#1e293b", padding: "1rem 2rem", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#f8fafc" }}>🤖 CryptoBot V2</h1>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Architecture Hyperliquid + Supabase</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Le fameux compteur temps réel */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: "bold" }}>Prochain cycle auto</span>
            <span style={{ color: "#38bdf8", fontSize: "1rem", fontWeight: "bold", fontFamily: "monospace" }}>⏱ {timeToNext}</span>
          </div>

          <span style={{ background: statusColors.bg, color: statusColors.text, padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: "bold" }}>
            ÉTAT : {botState.current_mode}
          </span>
          
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {/* Bouton Forcer Rebalance */}
            <button 
              onClick={handleForceRebalance} 
              disabled={isRebalancing}
              style={{ padding: "0.5rem 1rem", background: isRebalancing ? "#475569" : "#f59e0b", border: "none", borderRadius: "0.5rem", color: "white", cursor: isRebalancing ? "not-allowed" : "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.5rem", transition: "0.2s" }}
            >
              {isRebalancing ? "⏳ Exécution..." : "⚡ Forcer Rebalance"}
            </button>

            <button onClick={fetchAll} style={{ padding: "0.5rem 1rem", background: "#3b82f6", border: "none", borderRadius: "0.5rem", color: "white", cursor: "pointer", fontWeight: "bold" }}>
              Rafraîchir
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: "flex", gap: "0.5rem", padding: "1rem 2rem", borderBottom: "1px solid #334155", overflowX: "auto" }}>
        {["Dashboard", "Stratégie V2", "Historique Trades", "Logs Système"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 1rem",
              background: tab === t ? "#3b82f6" : "#1e293b",
              color: tab === t ? "#ffffff" : "#cbd5e1",
              border: "1px solid #334155",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontWeight: tab === t ? "bold" : "normal",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CONTENU DES ONGLETS */}
      <div style={{ padding: "2rem", flex: 1, overflowY: "auto" }}>
        
        {/* ONGLET : DASHBOARD */}
        {tab === "Dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            <Card title="Actif Cible" value={botState.active_asset || "Aucun"} />
            <Card title="Prix d'Entrée" value={botState.entry_price ? `${parseFloat(botState.entry_price).toFixed(2)} $` : "-"} />
            <Card 
              title="Trailing Stop" 
              value={botState.trailing_stop_level ? `${parseFloat(botState.trailing_stop_level).toFixed(2)} $` : "-"} 
              valueColor="#f59e0b" 
            />
            <Card title="Taille (Unités)" value={botState.position_size ? parseFloat(botState.position_size).toFixed(4) : "0"} />
          </div>
        )}

        {/* ONGLET : STRATÉGIE V2 */}
        {tab === "Stratégie V2" && (
          <div style={{ background: "#1e293b", padding: "2rem", borderRadius: "1rem", border: "1px solid #334155" }}>
            <h2 style={{ color: "#f8fafc", marginTop: 0 }}>🧠 Machine à États Triple (Long / Short / Cash)</h2>
            <p style={{ color: "#94a3b8", lineHeight: "1.6" }}>
              Le bot utilise désormais l'API décentralisée Hyperliquid. Il ne se contente plus de faire du Long, il analyse la pente de la MA200 et la corrélation avec le Bitcoin pour shorter le marché de manière sécurisée.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginTop: "2rem" }}>
              <div style={{ background: "#0f172a", padding: "1.5rem", borderRadius: "0.5rem", borderLeft: "4px solid #4ade80" }}>
                <h3 style={{ color: "#4ade80", marginTop: 0 }}>🟢 État LONG</h3>
                <ul style={{ color: "#cbd5e1", paddingLeft: "1.2rem", margin: 0 }}>
                  <li>Prix actuel &gt; MA200 + 1% (Buffer).</li>
                  <li>Pente de la MA200 (Slope) positive.</li>
                  <li>Taille de position : (Capital × 0.80) / ATR.</li>
                </ul>
              </div>

              <div style={{ background: "#0f172a", padding: "1.5rem", borderRadius: "0.5rem", borderLeft: "4px solid #f87171" }}>
                <h3 style={{ color: "#f87171", marginTop: 0 }}>🔴 État SHORT</h3>
                <ul style={{ color: "#cbd5e1", paddingLeft: "1.2rem", margin: 0 }}>
                  <li>Prix actuel &lt; MA200 - 1% (Buffer).</li>
                  <li>Pente de la MA200 (Slope) négative.</li>
                  <li>Filtre : Le BTC doit être sous sa MA200.</li>
                  <li>Filtre : Funding Rate &gt; -0.03%.</li>
                  <li>Taille de position : (Capital × 0.40) / ATR.</li>
                </ul>
              </div>

              <div style={{ background: "#0f172a", padding: "1.5rem", borderRadius: "0.5rem", borderLeft: "4px solid #94a3b8" }}>
                <h3 style={{ color: "#f8fafc", marginTop: 0 }}>⚪ État CASH</h3>
                <ul style={{ color: "#cbd5e1", paddingLeft: "1.2rem", margin: 0 }}>
                  <li>État de protection par défaut.</li>
                  <li>Activé dès que le Trailing Stop est touché (verrouillage des gains).</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET : TRADES */}
        {tab === "Historique Trades" && (
          <div style={{ background: "#1e293b", borderRadius: "1rem", overflow: "hidden", border: "1px solid #334155" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead style={{ background: "#0f172a" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>Date</th>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>Actif</th>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>Direction</th>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>Entrée</th>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>Sortie</th>
                  <th style={{ padding: "1rem", color: "#94a3b8", borderBottom: "1px solid #334155" }}>PnL</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Aucun trade enregistré sur Supabase pour le moment.</td>
                  </tr>
                ) : (
                  trades.map((trade, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "1rem" }}>{trade.close_date ? new Date(trade.close_date).toLocaleString("fr-FR") : "-"}</td>
                      <td style={{ padding: "1rem", fontWeight: "bold" }}>{trade.asset}</td>
                      <td style={{ padding: "1rem", color: trade.direction === "LONG" ? "#4ade80" : "#f87171", fontWeight: "bold" }}>{trade.direction}</td>
                      <td style={{ padding: "1rem" }}>{trade.entry_price} $</td>
                      <td style={{ padding: "1rem" }}>{trade.exit_price || "-"} $</td>
                      <td style={{ padding: "1rem" }}>{trade.pnl_percentage ? `${trade.pnl_percentage}%` : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ONGLET : LOGS */}
        {tab === "Logs Système" && (
          <div style={{ background: "#000000", borderRadius: "1rem", padding: "1rem", border: "1px solid #334155", fontFamily: "monospace", minHeight: "400px" }}>
            {logs.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center" }}>En attente de la première exécution du bot...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ marginBottom: "0.5rem", color: log.log_type === "ERROR" ? "#f87171" : log.log_type === "SIGNAL" ? "#facc15" : "#4ade80" }}>
                  <span style={{ color: "#64748b", marginRight: "1rem" }}>[{log.timestamp ? new Date(log.timestamp).toLocaleString("fr-FR") : "-"}]</span>
                  <span style={{ fontWeight: "bold", marginRight: "0.5rem" }}>[{log.log_type}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Petit composant "Carte"
function Card({ title, value, valueColor = "#f8fafc" }) {
  return (
    <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "1rem", border: "1px solid #334155" }}>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "#94a3b8", textTransform: "uppercase" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: valueColor }}>{value}</p>
    </div>
  );
}