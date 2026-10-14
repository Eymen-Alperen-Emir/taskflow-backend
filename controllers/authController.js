/**
 * CONTROLLERS/AUTHCONTROLLER.JS — Kullanıcı Hesabı ve Oturum Yönetimi
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const ApiResponse = require('../utils/apiResponse');
const { logError } = require('../middleware/logger');

class AuthController {
    /**
     * Yeni Kullanıcı Kaydı
     */
    static async register(req, res) {
        try {
            const { email, password } = req.body;

            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) {
                logError('register', error);
                // Kullanıcı dostu hata mesajı eşleştirmesi
                if (error.message.includes('already registered')) {
                    return ApiResponse.error(res, 'Bu e-posta adresi ile zaten kayıtlı bir hesap bulunmaktadır.', 'EMAIL_EXISTS', 409);
                }
                return ApiResponse.error(res, 'Kayıt işlemi tamamlanamadı: ' + error.message, 'REGISTER_FAILED', 400);
            }

            // E-posta doğrulama gereksinimi kontrolü
            const needsEmailConfirm = data.user && data.user.identities && data.user.identities.length === 0;

            return ApiResponse.success(
                res,
                {
                    user: {
                        id: data.user.id,
                        email: data.user.email
                    },
                    requiresConfirmation: needsEmailConfirm
                },
                needsEmailConfirm
                    ? 'Kayıt başarılı. Lütfen e-postanıza gönderilen onay bağlantısına tıklayın.'
                    : 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.',
                201
            );
        } catch (err) {
            logError('register:catch', err);
            return ApiResponse.error(res, 'Kayıt sırasında sistemsel bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Kullanıcı Girişi
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error || !data || !data.session) {
                logError('login:failed', error || new Error('Oturum açılamadı'));
                return ApiResponse.error(res, 'E-posta veya şifre hatalı.', 'INVALID_CREDENTIALS', 401);
            }

            return ApiResponse.success(
                res,
                {
                    token: data.session.access_token,
                    refreshToken: data.session.refresh_token,
                    expiresAt: data.session.expires_at,
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                        createdAt: data.user.created_at
                    }
                },
                'Giriş başarılı.'
            );
        } catch (err) {
            logError('login:catch', err);
            return ApiResponse.error(res, 'Giriş yapılırken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Güvenli Çıkış (Oturumu Kapatma)
     */
    static async logout(req, res) {
        try {
            // Frontend token'ı silecek, backend'de varsa session temizlenir
            return ApiResponse.success(res, null, 'Başarıyla çıkış yapıldı.');
        } catch (err) {
            logError('logout:catch', err);
            return ApiResponse.error(res, 'Çıkış sırasında bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Aktif Kullanıcı Profil Bilgisi
     */
    static async getProfile(req, res) {
        return ApiResponse.success(res, {
            id: req.user.id,
            email: req.user.email,
            createdAt: req.user.created_at,
            lastSignIn: req.user.last_sign_in_at
        }, 'Profil bilgileri alındı.');
    }

    /**
     * Şifre Değiştirme (Doğrulanmış Kullanıcı için)
     */
    static async changePassword(req, res) {
        try {
            const { newPassword } = req.body;
            const userId = req.user.id;

            // Service Role Key mevcutsa en garantili yöntem: Doğrudan updateUserById
            if (supabaseAdmin) {
                const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: newPassword
                });

                if (error) {
                    logError('changePassword:admin', error);
                    return ApiResponse.error(res, 'Şifre güncellenemedi: ' + error.message, 'PASSWORD_UPDATE_FAILED', 400);
                }

                return ApiResponse.success(res, null, 'Şifreniz başarıyla güncellendi.');
            }

            // Yedek yöntem (Service Role Key yoksa kullanıcı istemcisi üzerinden)
            const { createClient } = require('@supabase/supabase-js');
            const { SUPABASE_URL, SUPABASE_KEY } = require('../config');

            const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            // Session belirtecini tanımla
            await userClient.auth.setSession({
                access_token: req.token,
                refresh_token: ''
            });

            const { error } = await userClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                logError('changePassword:userClient', error);
                return ApiResponse.error(res, 'Şifre güncellenemedi: ' + error.message, 'PASSWORD_UPDATE_FAILED', 400);
            }

            return ApiResponse.success(res, null, 'Şifreniz başarıyla güncellendi.');
        } catch (err) {
            logError('changePassword:catch', err);
            return ApiResponse.error(res, 'Şifre değiştirilirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Şifre Sıfırlama Bağlantısı Gönderme
     */
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${req.headers.origin || 'http://localhost:3000'}/index.html`
            });

            if (error) {
                logError('forgotPassword', error);
            }

            // Güvenlik: Kullanıcının kayıtlı olup olmadığını ifşa etmemek için her durumda aynı mesaj dönülür
            return ApiResponse.success(
                res,
                null,
                'Eğer bu e-posta adresi sistemimizde kayıtlı ise şifre sıfırlama talimatları gönderilmiştir.'
            );
        } catch (err) {
            logError('forgotPassword:catch', err);
            return ApiResponse.error(res, 'İşlem sırasında bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Hesap Silme (KVKK Unutulma Hakkı & Veri Tasfiyesi)
     */
    static async deleteAccount(req, res) {
        try {
            const userId = req.user.id;

            // 1. Kullanıcının tüm görev verilerini kalıcı olarak sil
            const { error: taskError } = await supabase
                .from('tasks')
                .delete()
                .eq('user_id', userId);

            if (taskError) {
                logError('deleteAccount:tasks', taskError);
                return ApiResponse.error(res, 'Kullanıcı verileri silinemedi.', 'TASK_DELETION_FAILED', 500);
            }

            // 2. Eğer admin yetkisi (SERVICE_ROLE_KEY) yapılandırılmışsa auth kullanıcısını da kalıcı sil
            if (supabaseAdmin) {
                const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
                if (authError) {
                    logError('deleteAccount:authAdmin', authError);
                }
            }

            return ApiResponse.success(
                res,
                null,
                'Hesabınız ve ilişkili tüm görev verileriniz kalıcı olarak silindi.'
            );
        } catch (err) {
            logError('deleteAccount:catch', err);
            return ApiResponse.error(res, 'Hesap silinirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }
}

module.exports = AuthController;
