/**
 * CONTROLLERS/TASKCONTROLLER.JS — Görev Yönetimi İş Mantığı
 */

const { supabase } = require('../config/supabase');
const ApiResponse = require('../utils/apiResponse');
const { logError } = require('../middleware/logger');

class TaskController {
    /**
     * Kullanıcının Görevlerini Listele (Arama, Filtre, Sayfalama Desteğiyle)
     */
    static async getAll(req, res) {
        try {
            const userId = req.user.id;
            const { status, search, limit = 50, page = 1 } = req.query;

            let query = supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('user_id', userId);

            // Durum filtresi
            if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
                query = query.eq('status', status);
            }

            // Metin arama (başlık veya açıklama)
            if (search && typeof search === 'string') {
                const term = search.trim();
                if (term) {
                    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
                }
            }

            // Sayfalama (Pagination - Performans koruması)
            const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
            const safePage = Math.max(parseInt(page, 10) || 1, 1);
            const from = (safePage - 1) * safeLimit;
            const to = from + safeLimit - 1;

            query = query
                .order('created_at', { ascending: false })
                .range(from, to);

            const { data, count, error } = await query;

            if (error) {
                logError('getAllTasks', error);
                return ApiResponse.error(res, 'Görevler getirilirken bir hata oluştu.', 'DATABASE_ERROR', 500);
            }

            return ApiResponse.success(res, {
                tasks: data || [],
                pagination: {
                    total: count || 0,
                    page: safePage,
                    limit: safeLimit,
                    totalPages: Math.ceil((count || 0) / safeLimit)
                }
            }, 'Görevler listelendi.');
        } catch (err) {
            logError('getAllTasks:catch', err);
            return ApiResponse.error(res, 'Görev listesi alınırken sistemsel bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Tek Bir Görevin Detayı
     */
    static async getOne(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return ApiResponse.error(res, 'Görev bulunamadı veya erişim yetkiniz yok.', 'NOT_FOUND', 404);
            }

            return ApiResponse.success(res, data, 'Görev detayı getirildi.');
        } catch (err) {
            logError('getOneTask:catch', err);
            return ApiResponse.error(res, 'Görev getirilemedi.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Yeni Görev Oluştur
     */
    static async create(req, res) {
        try {
            const userId = req.user.id;
            const taskData = {
                ...req.sanitizedTask,
                user_id: userId
            };

            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single();

            if (error) {
                logError('createTask', error);
                return ApiResponse.error(res, 'Görev kaydedilemedi.', 'DATABASE_ERROR', 500);
            }

            return ApiResponse.success(res, data, 'Görev başarıyla oluşturuldu.', 201);
        } catch (err) {
            logError('createTask:catch', err);
            return ApiResponse.error(res, 'Görev eklenirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Görev Güncelle
     */
    static async update(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const updates = req.sanitizedUpdates;

            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', id)
                .eq('user_id', userId)
                .select();

            if (error) {
                logError('updateTask', error);
                return ApiResponse.error(res, 'Görev güncellenemedi.', 'DATABASE_ERROR', 500);
            }

            if (!data || data.length === 0) {
                return ApiResponse.error(res, 'Güncellenecek görev bulunamadı veya yetkiniz yok.', 'NOT_FOUND', 404);
            }

            return ApiResponse.success(res, data[0], 'Görev başarıyla güncellendi.');
        } catch (err) {
            logError('updateTask:catch', err);
            return ApiResponse.error(res, 'Görev güncellenirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Görev Sil
     */
    static async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const { data, error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)
                .select();

            if (error) {
                logError('deleteTask', error);
                return ApiResponse.error(res, 'Görev silinemedi.', 'DATABASE_ERROR', 500);
            }

            if (!data || data.length === 0) {
                return ApiResponse.error(res, 'Silinecek görev bulunamadı veya yetkiniz yok.', 'NOT_FOUND', 404);
            }

            return ApiResponse.success(res, { id }, 'Görev başarıyla silindi.');
        } catch (err) {
            logError('deleteTask:catch', err);
            return ApiResponse.error(res, 'Görev silinirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * İstatistikleri Getir
     */
    static async getStats(req, res) {
        try {
            const userId = req.user.id;

            const { data, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('user_id', userId);

            if (error) {
                logError('getStats', error);
                return ApiResponse.error(res, 'İstatistikler alınamadı.', 'DATABASE_ERROR', 500);
            }

            const total = data ? data.length : 0;
            const completed = data ? data.filter(t => t.status === 'completed').length : 0;
            const inProgress = data ? data.filter(t => t.status === 'in-progress').length : 0;
            const pending = data ? data.filter(t => t.status === 'pending').length : 0;
            const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

            return ApiResponse.success(res, {
                total,
                completed,
                inProgress,
                pending,
                completionRate: percent
            }, 'İstatistikler hesaplandı.');
        } catch (err) {
            logError('getStats:catch', err);
            return ApiResponse.error(res, 'İstatistik hesaplanamadı.', 'INTERNAL_ERROR', 500);
        }
    }
}

module.exports = TaskController;
