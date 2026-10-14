/**
 * MIDDLEWARE/RATELIMITER.JS — Brute-Force ve DoS Koruma Limitleri
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/apiResponse');

// Genel API İstek Limiti (15 dakikada 200 istek)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return ApiResponse.error(
            res,
            'Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.',
            'RATE_LIMIT_EXCEEDED',
            429
        );
    }
});

// Kimlik Doğrulama / Giriş Limiti (15 dakikada en fazla 15 deneme)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return ApiResponse.error(
            res,
            'Güvenlik nedeniyle çok sayıda başarısız giriş denemesi engellendi. Lütfen 15 dakika bekleyin.',
            'AUTH_RATE_LIMIT_EXCEEDED',
            429
        );
    }
});

// Şifre Sıfırlama Limiti (1 saatte en fazla 5 istek)
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return ApiResponse.error(
            res,
            'Şifre sıfırlama istek limiti aşıldı. Lütfen 1 saat sonra tekrar deneyin.',
            'RESET_RATE_LIMIT_EXCEEDED',
            429
        );
    }
});

module.exports = {
    generalLimiter,
    authLimiter,
    passwordResetLimiter
};
