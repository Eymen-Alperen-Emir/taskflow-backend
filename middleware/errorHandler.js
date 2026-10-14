/**
 * MIDDLEWARE/ERRORHANDLER.JS — Merkezi Hata Yönetimi
 */

const ApiResponse = require('../utils/apiResponse');
const { logError } = require('./logger');

// 404 Bulunamadı İşleyicisi
function notFoundHandler(req, res) {
    return ApiResponse.error(
        res,
        `İstenen kaynak bulunamadı: ${req.method} ${req.originalUrl}`,
        'NOT_FOUND',
        404
    );
}

// Genel Hata Yakalayıcı (500)
function globalErrorHandler(err, req, res, next) {
    logError('GlobalErrorHandler', err);

    // JSON syntax hatası (bozuk body vb.)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return ApiResponse.error(res, 'Geçersiz JSON formatı.', 'INVALID_JSON', 400);
    }

    // CORS hatası
    if (err.message && err.message.includes('CORS')) {
        return ApiResponse.error(res, 'CORS erişim izni reddedildi.', 'CORS_ERROR', 403);
    }

    // Varsayılan güvenli sunucu hatası
    return ApiResponse.error(
        res,
        'Sunucuda beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.',
        'INTERNAL_SERVER_ERROR',
        500
    );
}

module.exports = {
    notFoundHandler,
    globalErrorHandler
};
