/**
 * SERVER.JS — Production Düzeyinde Express API Sunucusu
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const { requestLogger, logError } = require('./middleware/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// ─── 1. GÜVENLİK BAŞLIKLARI (HELMET) ──────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "http://localhost:5000", "http://127.0.0.1:5000", config.SUPABASE_URL],
            imgSrc: ["'self'", "data:"]
        }
    },
    hsts: config.IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false
}));

// ─── 2. CORS YAPILANDIRMASI ───────────────────────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        // origin yoksa (örn: mobil uygulama, curl, file:// açılışı) veya listede varsa izin ver
        if (!origin || config.CORS_ORIGINS.includes(origin) || origin === 'null') {
            return callback(null, true);
        }
        return callback(new Error(`CORS ilkesi ihlali: '${origin}' etki alanına izin verilmiyor.`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
    credentials: true,
    maxAge: 86400 // Preflight önbelleği (24 saat)
}));

// ─── 3. BODY PARSING VE SINIRLANDIRMA ─────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // DoS ve payload inflation saldırılarına karşı koruma
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── 4. GÜVENLİ GÜNLÜKLEME VE ORAN SINIRLAMA ──────────────────────────────────
app.use(requestLogger);
app.use('/tasks', generalLimiter);

// ─── 5. API ROTALARI ──────────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);

// Kök karşılama
app.get('/', (req, res) => {
    res.json({
        name: 'TaskFlow API',
        version: '2.0.0',
        status: 'ONLINE',
        documentation: '/health'
    });
});

// ─── 6. HATA İŞLEYİCİLERİ ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── 7. SUNUCU BAŞLATMA VE GRACEFUL SHUTDOWN ──────────────────────────────────
const server = app.listen(config.PORT, () => {
    console.log('\n==================================================');
    console.log(`🚀 TaskFlow Production API Aktif: http://localhost:${config.PORT}`);
    console.log(`🛡️  Ortam: ${config.NODE_ENV.toUpperCase()}`);
    console.log(`🔒 Güvenlik: Helmet, CORS, Rate-Limit, XSS Sanitization`);
    console.log(`☁️  Veritabanı: Supabase Cloud (Multi-Tenant)`);
    console.log('==================================================\n');
});

// Sunucunun kontrollü ve güvenli şekilde kapatılması
function gracefulShutdown(signal) {
    console.log(`\n🛑 [${signal}] sinyali alındı. Sunucu kapatılıyor...`);
    server.close(() => {
        console.log('✅ HTTP sunucusu kapatıldı.');
        process.exit(0);
    });

    // 10 saniye içinde kapanmazsa zorla sonlandır
    setTimeout(() => {
        console.error('⚠️ Kapanma zaman aşımına uğradı, zorla durduruluyor.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };