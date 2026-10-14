/**
 * MIDDLEWARE/AUTH.JS — JWT Kimlik Doğrulama ve Kullanıcı İzolasyonu
 */

const { supabase } = require('../config/supabase');
const ApiResponse = require('../utils/apiResponse');
const { logError } = require('./logger');

async function requireAuth(req, res, next) {
    try {
        // Token'ı Authorization: Bearer <token> veya X-Session-Token header'ından al
        let token = req.headers['x-session-token'];
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
                token = parts[1];
            }
        }

        if (!token) {
            return ApiResponse.error(
                res,
                'Bu işlem için oturum açmanız gerekmektedir.',
                'UNAUTHORIZED',
                401
            );
        }

        // Supabase Auth üzerinden JWT doğrulaması
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return ApiResponse.error(
                res,
                'Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.',
                'SESSION_EXPIRED',
                401
            );
        }

        // Doğrulanmış kullanıcıyı request nesnesine bağla
        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        logError('requireAuth', err);
        return ApiResponse.error(
            res,
            'Kimlik doğrulanırken bir hata oluştu.',
            'AUTH_ERROR',
            401
        );
    }
}

module.exports = {
    requireAuth
};
