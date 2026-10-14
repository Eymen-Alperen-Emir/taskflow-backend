/**
 * CONFIG/SUPABASE.JS — Supabase İstemcisi Başlatıcı
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
    console.error('❌ KRİTİK HATA: .env dosyasında SUPABASE_URL veya SUPABASE_KEY eksik!');
    process.exit(1);
}

// Standart istemci (Kullanıcı JWT yetkilendirmesiyle çalışır)
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Admin yetkili istemci (Varsa hesap silme vb. admin işlemleri için)
let supabaseAdmin = null;
if (config.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

module.exports = {
    supabase,
    supabaseAdmin
};
