/**
 * CONFIG/INDEX.JS — Merkezi Konfigürasyon Yönetimi
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'production';
const PORT = parseInt(process.env.PORT, 10) || 5000;

// İzin verilen CORS domainleri (production ortamında .env üzerinden özelleştirilebilir)
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://fancy-sundae-b16e91.netlify.app',
    'null' // Yerel dosya sistemi (file://) desteği için
];

const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

const CORS_ORIGINS = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins])];

// *.netlify.app subdomain'lerini dinamik olarak kontrol eden yardımcı fonksiyon
function isAllowedOrigin(origin) {
    if (!origin || origin === 'null') return true;
    if (CORS_ORIGINS.includes(origin)) return true;
    // Tüm *.netlify.app subdomain'lerine izin ver
    if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
    return false;
}

module.exports = {
    NODE_ENV,
    IS_PROD: NODE_ENV === 'production',
    PORT,
    CORS_ORIGINS,
    isAllowedOrigin,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null
};
