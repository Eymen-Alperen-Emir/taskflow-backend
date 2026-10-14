/**
 * UTILS/APIRESPONSE.JS — Standart ve Güvenli API Yanıt Yardımcısı
 */

const { IS_PROD } = require('../config');

class ApiResponse {
    /**
     * Başarılı Yanıt Standardı
     */
    static success(res, data = null, message = 'İşlem başarılı.', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    }

    /**
     * Hata Yanıt Standardı
     * Production ortamında dahili hata detayları (stack trace, db hatası vb.) asla istemciye verilmez.
     */
    static error(res, message = 'Bir hata oluştu.', code = 'SERVER_ERROR', statusCode = 500, details = null) {
        const payload = {
            success: false,
            error: {
                code,
                message
            }
        };

        if (!IS_PROD && details) {
            payload.error.details = details;
        }

        return res.status(statusCode).json(payload);
    }
}

module.exports = ApiResponse;
