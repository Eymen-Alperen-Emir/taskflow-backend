/**
 * MIDDLEWARE/LOGGER.JS — Güvenli İstek ve Hata Günlükleyicisi
 * Asla şifre, token veya hassas kişisel verileri loglamaz!
 */

function requestLogger(req, res, next) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // Response tamamlandığında logla
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusColor = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';

        // URL'den olası hassas query parametrelerini maskele
        const safeUrl = originalUrl.split('?')[0];

        const logMsg = `[${new Date().toISOString()}] ${statusColor} ${method} ${safeUrl} - ${status} (${duration}ms) [IP: ${ip || req.connection.remoteAddress}]`;

        if (status >= 500) {
            console.error(logMsg);
        } else if (status >= 400) {
            console.warn(logMsg);
        } else {
            console.log(logMsg);
        }
    });

    next();
}

/**
 * Güvenli Hata Loglayıcı
 */
function logError(context, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ [HATA - ${context}]:`, {
        message: error.message || error,
        code: error.code || 'UNKNOWN',
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
}

module.exports = {
    requestLogger,
    logError
};
