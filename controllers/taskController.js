/**
 * CONTROLLERS/TASKCONTROLLER.JS — Görev Yönetimi İş Mantığı
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const ApiResponse = require('../utils/apiResponse');
const { logError } = require('../middleware/logger');

// Güvenli veritabanı istemcisi (Service Role ile RLS engellerini aşar)
const db = supabaseAdmin || supabase;

class TaskController {
    /**
     * Kullanıcının Görevlerini Listele (Arama, Filtre, Sayfalama Desteğiyle)
     */
    static async getAll(req, res) {
        try {
            const userId = req.user.id;
            const { status, category, search, groupId, limit = 50, page = 1 } = req.query;

            let query = db
                .from('tasks')
                .select('*', { count: 'exact' });

            if (groupId && groupId !== 'all' && groupId !== 'personal') {
                // Grubun üyesi mi doğrula
                const { data: member } = await db
                    .from('group_members')
                    .select('role')
                    .eq('group_id', groupId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!member) {
                    return ApiResponse.error(res, 'Bu grubun görevlerine erişim izniniz yok.', 'FORBIDDEN', 403);
                }
                query = query.eq('group_id', groupId);
            } else {
                // Kişisel görevler (group_id NULL olan veya bu kullanıcının kişisel görevleri)
                query = query.eq('user_id', userId).is('group_id', null);
            }

            // Durum filtresi
            if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
                query = query.eq('status', status);
            }

            // Kategori filtresi
            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            // Metin arama (başlık veya açıklama)
            if (search && typeof search === 'string') {
                const term = search.trim();
                if (term) {
                    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
                }
            }

            // Sıralama: Tamamlananlar en altta, sonra son tarihe göre
            query = query
                .order('completed_at', { ascending: true, nullsFirst: true })
                .order('created_at', { ascending: false });

            // Sayfalama
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
            const from = (pageNum - 1) * limitNum;
            const to = from + limitNum - 1;

            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) {
                logError('getAllTasks', error);
                return ApiResponse.error(res, 'Görevler listelenirken bir hata oluştu.', 'DATABASE_ERROR', 500);
            }

            return ApiResponse.paginated(res, data || [], {
                page: pageNum,
                limit: limitNum,
                total: count || (data ? data.length : 0)
            }, 'Görevler başarıyla listelendi.');
        } catch (err) {
            logError('getAllTasks:catch', err);
            return ApiResponse.error(res, 'Görevler yüklenemedi.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Tek Bir Görevin Detayını Getir
     */
    static async getOne(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const { data, error } = await db
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

            // Eğer grup görevi olarak ekleniyorsa, kullanıcının gruba üye olduğunu doğrula
            if (taskData.group_id) {
                const { data: member } = await db
                    .from('group_members')
                    .select('role')
                    .eq('group_id', taskData.group_id)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!member) {
                    return ApiResponse.error(res, 'Bu gruba görev ekleme yetkiniz yok.', 'FORBIDDEN', 403);
                }

                if (!taskData.created_by_name) {
                    taskData.created_by_name = req.user.user_metadata?.display_name || req.user.email?.split('@')[0] || 'Üye';
                }
            }

            let { data, error } = await db
                .from('tasks')
                .insert([taskData])
                .select()
                .single();

            // Veritabanında henüz category sütunu yoksa geriye dönük uyumluluk
            if (error && error.message && error.message.toLowerCase().includes('category')) {
                delete taskData.category;
                const retry = await db
                    .from('tasks')
                    .insert([taskData])
                    .select()
                    .single();
                data = retry.data;
                error = retry.error;
            }

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
            const updates = { ...req.sanitizedUpdates };

            // 1. Önce güncellenecek görevi bul
            const { data: existingTask, error: findErr } = await db
                .from('tasks')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (findErr || !existingTask) {
                return ApiResponse.error(res, 'Güncellenecek görev bulunamadı.', 'NOT_FOUND', 404);
            }

            // 2. Yetki Kontrolü
            if (existingTask.group_id) {
                // Grup görevi: Kullanıcının grupta üye olduğunu doğrula
                const { data: member } = await db
                    .from('group_members')
                    .select('role')
                    .eq('group_id', existingTask.group_id)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!member) {
                    return ApiResponse.error(res, 'Bu grubun görevini düzenleme yetkiniz yok.', 'FORBIDDEN', 403);
                }

                // Sadece görevi tamamlandı/yapılıyor durumunu değiştirme herkese açıktır.
                // Başlık/açıklama/öncelik değiştirmek için görevi oluşturan ya da grup admini olmak gerekir.
                const isOnlyStatusOrAssignee = Object.keys(updates).every(k => ['status', 'assigned_to'].includes(k));
                if (existingTask.user_id !== userId && member.role !== 'admin' && !isOnlyStatusOrAssignee) {
                    return ApiResponse.error(res, 'Grup görevinin içeriğini yalnızca görevi oluşturan kişi veya grup yöneticisi düzenleyebilir.', 'FORBIDDEN', 403);
                }
            } else {
                // Kişisel görev: Yalnızca sahibi düzenleyebilir
                if (existingTask.user_id !== userId) {
                    return ApiResponse.error(res, 'Bu görevi düzenleme yetkiniz yok.', 'FORBIDDEN', 403);
                }
            }

            let { data, error } = await db
                .from('tasks')
                .update(updates)
                .eq('id', id)
                .select();

            // Veritabanında henüz category sütunu yoksa geriye dönük uyumluluk
            if (error && error.message && error.message.toLowerCase().includes('category')) {
                delete updates.category;
                const retry = await db
                    .from('tasks')
                    .update(updates)
                    .eq('id', id)
                    .select();
                data = retry.data;
                error = retry.error;
            }

            if (error) {
                logError('updateTask', error);
                return ApiResponse.error(res, 'Görev güncellenemedi.', 'DATABASE_ERROR', 500);
            }

            if (!data || data.length === 0) {
                return ApiResponse.error(res, 'Güncellenecek görev bulunamadı.', 'NOT_FOUND', 404);
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

            // 1. Görevi bul
            const { data: existingTask, error: findErr } = await db
                .from('tasks')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (findErr || !existingTask) {
                return ApiResponse.error(res, 'Silinecek görev bulunamadı.', 'NOT_FOUND', 404);
            }

            // 2. Yetki Kontrolü
            if (existingTask.group_id) {
                const { data: member } = await db
                    .from('group_members')
                    .select('role')
                    .eq('group_id', existingTask.group_id)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!member) {
                    return ApiResponse.error(res, 'Bu gruptan görev silme yetkiniz yok.', 'FORBIDDEN', 403);
                }

                // Grup görevini yalnızca görevi oluşturan kişi veya grup yöneticisi silebilir
                if (existingTask.user_id !== userId && member.role !== 'admin') {
                    return ApiResponse.error(res, 'Grup görevini yalnızca görevi oluşturan kişi veya grup yöneticisi silebilir.', 'FORBIDDEN', 403);
                }
            } else {
                if (existingTask.user_id !== userId) {
                    return ApiResponse.error(res, 'Bu görevi silme yetkiniz yok.', 'FORBIDDEN', 403);
                }
            }

            const { data, error } = await db
                .from('tasks')
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                logError('deleteTask', error);
                return ApiResponse.error(res, 'Görev silinemedi.', 'DATABASE_ERROR', 500);
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
            const { groupId } = req.query;

            let query = db.from('tasks').select('status');

            if (groupId && groupId !== 'all' && groupId !== 'personal') {
                query = query.eq('group_id', groupId);
            } else {
                query = query.eq('user_id', userId).is('group_id', null);
            }

            const { data, error } = await query;

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
