/**
 * lib/logger.js — Logger centralisé structuré
 *
 * Chaque cycle de rebalance crée un logger avec un cycle_id unique.
 * Chaque log est envoyé simultanément :
 *   1. Console (pour les logs Vercel/GitHub Actions)
 *   2. Supabase system_logs (pour le dashboard)
 *
 * Format système_logs :
 *   log_type  : 'INFO' | 'WARN' | 'ERROR' | 'TRADE' | 'ANALYSIS' | 'DEBUG'
 *   message   : string lisible (affiché dans le dashboard)
 *   metadata  : JSONB — contexte structuré (cycle_id, asset, prix, etc.)
 *   timestamp : ISO string
 */

const LOG_LEVELS = {
    DEBUG:    { emoji: '🔍', console: 'log'   },
    INFO:     { emoji: 'ℹ️',  console: 'log'   },
    WARN:     { emoji: '⚠️',  console: 'warn'  },
    ERROR:    { emoji: '❌', console: 'error' },
    TRADE:    { emoji: '💰', console: 'log'   },
    ANALYSIS: { emoji: '📊', console: 'log'   },
};

/**
 * Crée un logger scopé à un cycle de rebalance.
 * @param {object} supabase - Client Supabase
 * @param {string} [cycleId] - ID unique du cycle (généré si absent)
 */
function createLogger(supabase, cycleId = null) {
    const id        = cycleId || `cycle_${Date.now()}`;
    const startTime = Date.now();
    const buffer    = []; // buffer local pour débogage

    async function log(level, message, metadata = {}) {
        const { emoji, console: method } = LOG_LEVELS[level] || LOG_LEVELS.INFO;
        const ts      = new Date().toISOString();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // 1. Console structuré
        const prefix = `[${id}] [+${elapsed}s]`;
        console[method](`${emoji} ${prefix} ${message}`, Object.keys(metadata).length ? metadata : '');

        // 2. Buffer local
        buffer.push({ level, message, metadata, ts });

        // 3. Supabase (fire and forget — on ne bloque pas le cycle)
        try {
            await supabase.from('system_logs').insert([{
                log_type:  level,
                message,
                metadata:  { cycle_id: id, elapsed_s: parseFloat(elapsed), ...metadata },
                timestamp: ts,
            }]);
        } catch (err) {
            // Ne jamais crasher le cycle à cause d'un log raté
            console.error(`[LOGGER] Supabase write failed: ${err.message}`);
        }
    }

    return {
        cycleId: id,
        startTime,

        debug:    (msg, meta = {}) => log('DEBUG',    msg, meta),
        info:     (msg, meta = {}) => log('INFO',     msg, meta),
        warn:     (msg, meta = {}) => log('WARN',     msg, meta),
        error:    (msg, meta = {}) => log('ERROR',    msg, meta),
        trade:    (msg, meta = {}) => log('TRADE',    msg, meta),
        analysis: (msg, meta = {}) => log('ANALYSIS', msg, meta),

        /** Loggue une erreur avec stack trace complète */
        exception(context, err, meta = {}) {
            return log('ERROR', `${context}: ${err.message}`, {
                ...meta,
                error_message: err.message,
                error_stack:   err.stack?.split('\n').slice(0, 5).join(' | '),
            });
        },

        /** Loggue le résumé de fin de cycle */
        async summary(outcome, meta = {}) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const level    = outcome === 'ERROR' ? 'ERROR' : 'INFO';
            return log(level, `Cycle terminé — ${outcome} (${duration}s)`, {
                ...meta,
                duration_s: parseFloat(duration),
                log_count:  buffer.length,
            });
        },

        /** Accès au buffer pour inspection */
        getLogs: () => [...buffer],
    };
}

module.exports = { createLogger };