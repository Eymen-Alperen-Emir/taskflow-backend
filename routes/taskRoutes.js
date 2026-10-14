/**
 * ROUTES/TASKROUTES.JS — Görev Yönetimi API Yolları
 */

const express = require('express');
const router = express.Router();

const TaskController = require('../controllers/taskController');
const { requireAuth } = require('../middleware/auth');
const {
    validateTaskCreate,
    validateTaskUpdate
} = require('../middleware/validator');

// Tüm görev rotaları kimlik doğrulama gerektirir
router.use(requireAuth);

// İstatistikleri Getir (Özel rota /:id'den önce tanımlanmalı)
router.get('/stats', TaskController.getStats);

// Görevleri Listele
router.get('/', TaskController.getAll);

// Tek Görev Detayı
router.get('/:id', TaskController.getOne);

// Yeni Görev Oluştur
router.post('/', validateTaskCreate, TaskController.create);

// Görev Güncelle
router.put('/:id', validateTaskUpdate, TaskController.update);

// Görev Sil
router.delete('/:id', TaskController.delete);

module.exports = router;
