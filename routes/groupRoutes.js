/**
 * ROUTES/GROUPROUTES.JS — Grup ve Ekip Yönetimi API Rotaları
 */

const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const { requireAuth } = require('../middleware/auth');

// Tüm grup rotaları JWT ile doğrulanmış oturum gerektirir
router.use(requireAuth);

router.post('/', GroupController.create);
router.get('/', GroupController.getMyGroups);
router.post('/join', GroupController.joinByCode);
router.get('/:id', GroupController.getGroupDetails);
router.post('/:id/leave', GroupController.leaveGroup);
router.delete('/:id/members/:userId', GroupController.kickMember);
router.delete('/:id', GroupController.deleteGroup);

module.exports = router;
