/**
 * MIDDLEWARE/VALIDATOR.JS — Girdi Doğrulama ve Sanitization
 */

const ApiResponse = require('../utils/apiResponse');
const {
    sanitizeString,
    isValidEmail,
    isStrongPassword,
    isValidDate
} = require('../utils/sanitizer');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['pending', 'in-progress', 'completed'];
const CATEGORY_MAP = {
    'personal': 'personal',
    'kişisel': 'personal',
    'kisisel': 'personal',
    'family': 'family',
    'aile': 'family',
    'shopping': 'shopping',
    'market': 'shopping',
    'alisveris': 'shopping',
    'alışveriş': 'shopping',
    'work': 'work',
    'iş': 'work',
    'is': 'work',
    'other': 'other',
    'diğer': 'other',
    'diger': 'other'
};

function normalizeCategory(cat) {
    if (!cat || typeof cat !== 'string') return 'personal';
    const key = cat.trim().toLowerCase();
    return CATEGORY_MAP[key] || 'personal';
}

function validateRegister(req, res, next) {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
        return ApiResponse.error(res, 'Geçerli bir e-posta adresi giriniz.', 'INVALID_EMAIL', 400);
    }

    if (!password || !isStrongPassword(password)) {
        return ApiResponse.error(
            res,
            'Şifreniz en az 8 karakter uzunluğunda olmalı ve hem harf hem de rakam içermelidir.',
            'WEAK_PASSWORD',
            400
        );
    }

    req.body.email = email.trim().toLowerCase();
    next();
}

function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return ApiResponse.error(res, 'E-posta ve şifre zorunludur.', 'MISSING_CREDENTIALS', 400);
    }

    if (!isValidEmail(email)) {
        return ApiResponse.error(res, 'Geçerli bir e-posta formatı giriniz.', 'INVALID_EMAIL', 400);
    }

    req.body.email = email.trim().toLowerCase();
    next();
}

function validateChangePassword(req, res, next) {
    const { newPassword } = req.body;

    if (!newPassword || !isStrongPassword(newPassword)) {
        return ApiResponse.error(
            res,
            'Yeni şifreniz en az 8 karakter olmalı, harf ve rakam içermelidir.',
            'WEAK_PASSWORD',
            400
        );
    }

    next();
}

function validateForgotPassword(req, res, next) {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
        return ApiResponse.error(res, 'Geçerli bir e-posta adresi giriniz.', 'INVALID_EMAIL', 400);
    }

    req.body.email = email.trim().toLowerCase();
    next();
}

function validateTaskCreate(req, res, next) {
    const { title, description, priority, date, status, category } = req.body;

    const cleanTitle = sanitizeString(title, 100);
    if (!cleanTitle || cleanTitle.length === 0) {
        return ApiResponse.error(res, 'Görev başlığı zorunludur ve en fazla 100 karakter olabilir.', 'INVALID_TITLE', 400);
    }

    const cleanDesc = description ? sanitizeString(description, 500) : '';
    const cleanPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'pending';
    const cleanCategory = normalizeCategory(category);

    if (date && !isValidDate(date)) {
        return ApiResponse.error(res, 'Geçersiz tarih formatı (YYYY-AA-GG olmalı).', 'INVALID_DATE', 400);
    }

    req.sanitizedTask = {
        title: cleanTitle,
        description: cleanDesc,
        priority: cleanPriority,
        status: cleanStatus,
        category: cleanCategory,
        date: date || null
    };

    next();
}

function validateTaskUpdate(req, res, next) {
    const { title, description, priority, date, status, category } = req.body;
    const updates = {};

    if (title !== undefined) {
        const cleanTitle = sanitizeString(title, 100);
        if (!cleanTitle) {
            return ApiResponse.error(res, 'Görev başlığı boş bırakılamaz.', 'INVALID_TITLE', 400);
        }
        updates.title = cleanTitle;
    }

    if (description !== undefined) {
        updates.description = sanitizeString(description, 500);
    }

    if (priority !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) {
            return ApiResponse.error(res, 'Geçersiz öncelik seviyesi.', 'INVALID_PRIORITY', 400);
        }
        updates.priority = priority;
    }

    if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
            return ApiResponse.error(res, 'Geçersiz görev durumu.', 'INVALID_STATUS', 400);
        }
        updates.status = status;
    }

    if (category !== undefined) {
        updates.category = normalizeCategory(category);
    }

    if (date !== undefined) {
        if (date && !isValidDate(date)) {
            return ApiResponse.error(res, 'Geçersiz tarih formatı (YYYY-AA-GG olmalı).', 'INVALID_DATE', 400);
        }
        updates.date = date || null;
    }

    if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'Güncellenecek geçerli bir alan gönderilmedi.', 'NO_UPDATES', 400);
    }

    req.sanitizedUpdates = updates;
    next();
}

module.exports = {
    validateRegister,
    validateLogin,
    validateChangePassword,
    validateForgotPassword,
    validateTaskCreate,
    validateTaskUpdate
};
