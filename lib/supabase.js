const { createClient } = require('@supabase/supabase-js');

// On récupère les clés depuis les variables d'environnement (.env)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️ ERREUR : Clés Supabase manquantes. Vérifie ton fichier .env !");
}

// Initialisation de la connexion à la base de données
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };