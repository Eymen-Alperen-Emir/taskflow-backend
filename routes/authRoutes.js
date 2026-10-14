/**
 * ROUTES/AUTHROUTES.JS — Kimlik Doğrulama ve Kullanıcı İşlemleri Yolları
 */

const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
    validateRegister,
    validateLogin,
    validateChangePassword,
    validateForgotPassword
} = require('../middleware/validator');

// Kayıt Ol
router.post('/register', authLimiter, validateRegister, AuthController.register);

// Giriş Yap
router.post('/login', authLimiter, validateLogin, AuthController.login);

// Çıkış Yap
router.post('/logout', AuthController.logout);

// Profil Bilgileri
router.get('/me', requireAuth, AuthController.getProfile);

// Şifre Değiştir
router.post('/change-password', requireAuth, validateChangePassword, AuthController.changePassword);

// Şifre Sıfırlama İsteği
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, AuthController.forgotPassword);

// Hesabı ve Verileri Kalıcı Olarak Sil (KVKK)
router.delete('/delete-account', requireAuth, AuthController.deleteAccount);

module.exports = router;
