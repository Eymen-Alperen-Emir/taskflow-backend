/**
 * Şifre değiştirme endpoint'ini uçtan uca test eder.
 * 1. Giriş yap → token al
 * 2. O token ile şifre değiştir
 * 3. Eski şifre artık çalışmıyor mu dene
 * 4. Yeni şifre ile giriş yap
 * 5. Eski şifreyi geri yükle
 */

const http = require('http');
const BASE = 'http://localhost:5000';

// ⚠️ Test hesabı: Supabase'de kayıtlı gerçek bir kullanıcı olmalı
const TEST_EMAIL    = process.env.TEST_EMAIL    || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestSifre1';
const NEW_PASSWORD  = 'YeniSifre2026';

let passed = 0, failed = 0;

function log(ok, msg, detail) {
    if (ok) { passed++; console.log(`  ✅ ${msg}`); }
    else     { failed++; console.error(`  ❌ ${msg}`, detail || ''); }
}

async function req(path, opts = {}) {
    const url = new URL(path, BASE);
    return new Promise((resolve, reject) => {
        const r = http.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(body); } catch(_) {}
                resolve({ status: res.statusCode, body: json });
            });
        });
        r.on('error', reject);
        if (opts.body) r.write(JSON.stringify(opts.body));
        r.end();
    });
}

async function run() {
    console.log('\n=== Şifre Değiştirme Uçtan Uca Test ===\n');

    // 1. Giriş
    const login1 = await req('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: TEST_EMAIL, password: TEST_PASSWORD }
    });
    log(login1.status === 200 && login1.body?.data?.token, '1. Test hesabıyla giriş', login1.body?.error);
    if (login1.status !== 200) { console.log('\nTest hesabı bulunamadı. TEST_EMAIL ve TEST_PASSWORD env değişkenlerini ayarlayın.'); process.exit(1); }

    const token = login1.body.data.token;
    const authHeader = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Session-Token': token };

    // 2. Şifre değiştir (yeni → YeniSifre2026)
    const change = await req('/auth/change-password', {
        method: 'POST',
        headers: authHeader,
        body: { newPassword: NEW_PASSWORD }
    });
    log(change.status === 200, '2. Şifre değiştirme isteği (200 bekleniyor)', change.body?.error || change.body);

    // 3. Eski şifre artık çalışmamalı
    const oldLogin = await req('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: TEST_EMAIL, password: TEST_PASSWORD }
    });
    log(oldLogin.status === 401, '3. Eski şifre artık geçersiz (401 bekleniyor)', oldLogin.body);

    // 4. Yeni şifre çalışmalı
    const newLogin = await req('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: TEST_EMAIL, password: NEW_PASSWORD }
    });
    log(newLogin.status === 200, '4. Yeni şifre ile giriş başarılı', newLogin.body?.error);

    // 5. Şifreyi eski haline döndür
    if (newLogin.status === 200) {
        const token2 = newLogin.body.data.token;
        const restore = await req('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}`, 'X-Session-Token': token2 },
            body: { newPassword: TEST_PASSWORD }
        });
        log(restore.status === 200, '5. Şifre eski haline geri yüklendi', restore.body?.error);
    }

    console.log(`\nSonuç: ${passed} Başarılı, ${failed} Başarısız.\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Kritik hata:', e.message); process.exit(1); });
