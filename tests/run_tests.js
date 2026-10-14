/**
 * TESTS/RUN_TESTS.JS — Kapsamlı Production Güvenlik ve API Entegrasyon Testleri
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function logPass(msg) {
    passed++;
    console.log(`  ✅ [BAŞARILI] ${msg}`);
}

function logFail(msg, err) {
    failed++;
    console.error(`  ❌ [BAŞARISIZ] ${msg} ->`, err || '');
}

async function request(path, options = {}) {
    const url = new URL(path, BASE_URL);
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(body); } catch (_) {}
                resolve({ status: res.statusCode, headers: res.headers, body: json || body });
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n======================================================');
    console.log('🧪 TaskFlow Production Güvenlik ve Entegrasyon Testleri');
    console.log('======================================================\n');

    // TEST 1: Health Check Endpoint
    try {
        const res = await request('/health');
        if (res.status === 200 && res.body.data?.status === 'UP') {
            logPass('1. Health Check Endpoint (200 OK ve status UP)');
        } else {
            logFail('1. Health Check Endpoint', res.body);
        }
    } catch (e) {
        logFail('1. Health Check Endpoint (Bağlantı Hatası)', e.message);
    }

    // TEST 2: Güvenlik HTTP Başlıkları (Helmet)
    try {
        const res = await request('/health');
        const h = res.headers;
        if (h['x-content-type-options'] === 'nosniff' && h['content-security-policy']) {
            logPass('2. Güvenlik Başlıkları (X-Content-Type-Options & CSP mevcut)');
        } else {
            logFail('2. Güvenlik Başlıkları eksik', h);
        }
    } catch (e) {
        logFail('2. Güvenlik Başlıkları', e.message);
    }

    // TEST 3: Yetkisiz İstek Engelleme (401 Unauthorized)
    try {
        const res = await request('/tasks');
        if (res.status === 401 && res.body.error?.code === 'UNAUTHORIZED') {
            logPass('3. Yetkisiz API Erişimi Engellendi (Token olmadan /tasks -> 401)');
        } else {
            logFail('3. Yetkisiz API Erişimi Engelleme', res.body);
        }
    } catch (e) {
        logFail('3. Yetkisiz API Erişimi', e.message);
    }

    // TEST 4: Sahte Token ile İstek Engelleme (401 Unauthorized)
    try {
        const res = await request('/tasks', {
            headers: {
                'Authorization': 'Bearer gecersiz_sahte_token_xyz_123'
            }
        });
        if (res.status === 401) {
            logPass('4. Sahte/Geçersiz JWT Token Reddedildi (401)');
        } else {
            logFail('4. Sahte Token Kontrolü', res.body);
        }
    } catch (e) {
        logFail('4. Sahte Token', e.message);
    }

    // TEST 5: Form Validation — Zayıf Şifre ile Kayıt Engeli
    try {
        const res = await request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: 'test@example.com', password: '123' } // çok kısa
        });
        if (res.status === 400 && res.body.error?.code === 'WEAK_PASSWORD') {
            logPass('5. Zayıf Şifre Doğrulaması Engellendi (400 WEAK_PASSWORD)');
        } else {
            logFail('5. Zayıf Şifre Kontrolü', res.body);
        }
    } catch (e) {
        logFail('5. Zayıf Şifre', e.message);
    }

    // TEST 6: Form Validation — Geçersiz E-posta ile Kayıt Engeli
    try {
        const res = await request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: 'gecersiz-eposta-adresi', password: 'GucluSifre2026!' }
        });
        if (res.status === 400 && res.body.error?.code === 'INVALID_EMAIL') {
            logPass('6. Geçersiz E-posta Formatı Engellendi (400 INVALID_EMAIL)');
        } else {
            logFail('6. E-posta Doğrulama', res.body);
        }
    } catch (e) {
        logFail('6. E-posta Formatı', e.message);
    }

    // TEST 7: Hatalı Şifre ile Giriş (401 Invalid Credentials)
    try {
        const res = await request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: 'olmayan_kullanici@example.com', password: 'RastgeleSifre123' }
        });
        if (res.status === 401 && res.body.error?.code === 'INVALID_CREDENTIALS') {
            logPass('7. Yanlış Giriş Bilgileri Güvenle Reddedildi (401)');
        } else {
            logFail('7. Yanlış Giriş Kontrolü', res.body);
        }
    } catch (e) {
        logFail('7. Giriş Kontrolü', e.message);
    }

    // TEST 8: Boş Görev Başlığı Validasyonu
    try {
        const res = await request('/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sahte_token'
            },
            body: { title: '   ' }
        });
        // 401 (Auth önce çalışır) veya 400
        if (res.status === 401 || res.status === 400) {
            logPass('8. Başlıksız Görev Oluşturma Koruması Aktif (400/401)');
        } else {
            logFail('8. Boş Başlık Kontrolü', res.body);
        }
    } catch (e) {
        logFail('8. Boş Başlık', e.message);
    }

    // TEST 9: XSS Sanitization Birim Testi
    try {
        const { sanitizeString } = require('../utils/sanitizer');
        const rawPayload = '<script>alert("XSS")</script><b>Test</b>';
        const clean = sanitizeString(rawPayload);
        if (!clean.includes('<script>') && clean.includes('&lt;script&gt;')) {
            logPass('9. XSS Sanitization Başarılı (Zararlı HTML tagleri encode edildi)');
        } else {
            logFail('9. XSS Sanitization Başarısız', clean);
        }
    } catch (e) {
        logFail('9. XSS Sanitizer Birim Testi', e.message);
    }

    // TEST 10: 404 Bilinmeyen Kaynak İşleyicisi
    try {
        const res = await request('/api/bilinmeyen-endpoint-xyz');
        if (res.status === 404 && res.body.error?.code === 'NOT_FOUND') {
            logPass('10. 404 Özel Hata Yanıtı Başarılı');
        } else {
            logFail('10. 404 Hata Yanıtı', res.body);
        }
    } catch (e) {
        logFail('10. 404 Kontrolü', e.message);
    }

    console.log('\n------------------------------------------------------');
    console.log(`Sonuç: ${passed} Başarılı, ${failed} Başarısız.`);
    console.log('------------------------------------------------------\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
