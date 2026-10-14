/**
 * ROUTES/HEALTHROUTES.JS — Sunucu Durumu ve İzleme Rotası
 */

const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/apiResponse');

router.get('/', (req, res) => {
    return ApiResponse.success(res, {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memoryUsage: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
        }
    }, 'Sunucu sağlıklı ve aktif.');
});

module.exports = router;
