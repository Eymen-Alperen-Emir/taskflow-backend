/**
 * UTILS/SANITIZER.JS — Güvenli Veri Temizleme ve Doğrulama
 */

/**
 * XSS engellemek için tehlikeli HTML karakterlerini etkisiz hale getirir
 */
function sanitizeString(str, maxLen = 500) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim()
        .slice(0, maxLen);
}

/**
 * Standart RFC-5322 e-posta format doğrulaması
 */
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email.trim()) && email.length <= 254;
}

/**
 * Şifre karmaşıklık kontrolü: En az 8 karakter, en az bir harf ve bir rakam
 */
function isStrongPassword(password) {
    if (typeof password !== 'string') return false;
    if (password.length < 8 || password.length > 128) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
}

/**
 * YYYY-MM-DD tarih format doğrulaması
 */
function isValidDate(dateStr) {
    if (!dateStr) return true; // Opsiyonel olabilir
    if (typeof dateStr !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
}

module.exports = {
    sanitizeString,
    isValidEmail,
    isStrongPassword,
    isValidDate
};
