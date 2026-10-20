/**
 * CONTROLLERS/GROUPCONTROLLER.JS — Grup ve Ekip Yönetimi İş Mantığı
 */

const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const ApiResponse = require('../utils/apiResponse');
const { logError } = require('../middleware/logger');
const { sanitizeString } = require('../utils/sanitizer');

class GroupController {
    /**
     * Rastgele 6 haneli benzersiz davet kodu üretici (Örn: GRP-7K9A)
     */
    static _generateInviteCode() {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 6; i++) {
            const randomIndex = crypto.randomInt(0, chars.length);
            code += chars[randomIndex];
        }
        return code;
    }

    /**
     * Yeni Grup Oluştur (Oluşturan otomatik 'admin' olur)
     */
    static async create(req, res) {
        try {
            const { name } = req.body;
            const userId = req.user.id;

            const cleanName = sanitizeString(name, 50);
            if (!cleanName || cleanName.length < 2) {
                return ApiResponse.error(res, 'Grup adı en az 2 karakter olmalıdır.', 'INVALID_GROUP_NAME', 400);
            }

            let inviteCode = GroupController._generateInviteCode();
            let attempts = 0;

            // Benzersiz kod garantisi
            while (attempts < 5) {
                const { data: existing } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('invite_code', inviteCode)
                    .maybeSingle();

                if (!existing) break;
                inviteCode = GroupController._generateInviteCode();
                attempts++;
            }

            // 1. Grubu oluştur
            const { data: newGroup, error: groupErr } = await supabase
                .from('groups')
                .insert([{
                    name: cleanName,
                    invite_code: inviteCode,
                    created_by: userId
                }])
                .select()
                .single();

            if (groupErr || !newGroup) {
                logError('createGroup:group', groupErr);
                return ApiResponse.error(res, 'Grup oluşturulamadı.', 'GROUP_CREATE_FAILED', 500);
            }

            // 2. Oluşturan kişiyi 'admin' rolüyle üyeliğe ekle
            const { error: memberErr } = await supabase
                .from('group_members')
                .insert([{
                    group_id: newGroup.id,
                    user_id: userId,
                    role: 'admin'
                }]);

            if (memberErr) {
                logError('createGroup:member', memberErr);
                // Geri alma
                await supabase.from('groups').delete().eq('id', newGroup.id);
                return ApiResponse.error(res, 'Grup üyeliği başlatılamadı.', 'GROUP_MEMBER_FAILED', 500);
            }

            return ApiResponse.success(res, {
                ...newGroup,
                role: 'admin',
                member_count: 1
            }, 'Grup başarıyla oluşturuldu.', 201);
        } catch (err) {
            logError('createGroup:catch', err);
            return ApiResponse.error(res, 'Grup oluşturulurken bir hata meydana geldi.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Kullanıcının Dahil Olduğu Tüm Grupları Listele
     */
    static async getMyGroups(req, res) {
        try {
            const userId = req.user.id;

            // Kullanıcının üyeliklerini al
            const { data: memberships, error: memberErr } = await supabase
                .from('group_members')
                .select('group_id, role, joined_at')
                .eq('user_id', userId);

            if (memberErr) {
                logError('getMyGroups:members', memberErr);
                return ApiResponse.error(res, 'Gruplar getirilemedi.', 'DATABASE_ERROR', 500);
            }

            if (!memberships || memberships.length === 0) {
                return ApiResponse.success(res, [], 'Henüz bir gruba dahil değilsiniz.');
            }

            const groupIds = memberships.map(m => m.group_id);

            // Grupların detaylarını çek
            const { data: groups, error: groupErr } = await supabase
                .from('groups')
                .select('*')
                .in('id', groupIds)
                .order('created_at', { ascending: false });

            if (groupErr) {
                logError('getMyGroups:groups', groupErr);
                return ApiResponse.error(res, 'Grup bilgileri alınamadı.', 'DATABASE_ERROR', 500);
            }

            // Her grubun toplam üye sayısını çek
            const { data: allMembers } = await supabase
                .from('group_members')
                .select('group_id')
                .in('group_id', groupIds);

            const countMap = {};
            (allMembers || []).forEach(m => {
                countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
            });

            const membershipMap = {};
            memberships.forEach(m => {
                membershipMap[m.group_id] = m;
            });

            const result = (groups || []).map(g => ({
                id: g.id,
                name: g.name,
                invite_code: g.invite_code,
                role: membershipMap[g.id]?.role || 'member',
                joined_at: membershipMap[g.id]?.joined_at,
                member_count: countMap[g.id] || 1,
                created_at: g.created_at,
                is_admin: membershipMap[g.id]?.role === 'admin'
            }));

            return ApiResponse.success(res, result, 'Gruplar başarıyla listelendi.');
        } catch (err) {
            logError('getMyGroups:catch', err);
            return ApiResponse.error(res, 'Gruplar yüklenirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Tek Bir Grubun Detaylarını ve Üye Listesini Getir
     */
    static async getGroupDetails(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // 1. İstek yapan kullanıcının üye olup olmadığını ve rolünü doğrula
            const { data: myMembership } = await supabase
                .from('group_members')
                .select('role')
                .eq('group_id', id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!myMembership) {
                return ApiResponse.error(res, 'Bu gruba erişim izniniz bulunmamaktadır.', 'FORBIDDEN', 403);
            }

            // 2. Grup bilgilerini al
            const { data: group, error: groupErr } = await supabase
                .from('groups')
                .select('*')
                .eq('id', id)
                .single();

            if (groupErr || !group) {
                return ApiResponse.error(res, 'Grup bulunamadı.', 'NOT_FOUND', 404);
            }

            // 3. Grup üyelerini al
            const { data: members, error: memErr } = await supabase
                .from('group_members')
                .select('id, user_id, role, joined_at')
                .eq('group_id', id)
                .order('joined_at', { ascending: true });

            if (memErr) {
                logError('getGroupDetails:members', memErr);
                return ApiResponse.error(res, 'Üye listesi alınamadı.', 'DATABASE_ERROR', 500);
            }

            // 4. Üyelerin e-posta / isim bilgilerini çözümle
            let userMap = {};
            if (supabaseAdmin) {
                try {
                    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
                    if (authData && authData.users) {
                        authData.users.forEach(u => {
                            userMap[u.id] = {
                                email: u.email,
                                displayName: u.user_metadata?.display_name || u.email?.split('@')[0] || 'Kullanıcı'
                            };
                        });
                    }
                } catch (e) {
                    logError('getGroupDetails:adminUsers', e);
                }
            }

            const memberList = (members || []).map(m => ({
                id: m.id,
                user_id: m.user_id,
                role: m.role,
                joined_at: m.joined_at,
                email: userMap[m.user_id]?.email || (m.user_id === userId ? req.user.email : 'Üye'),
                displayName: userMap[m.user_id]?.displayName || (m.user_id === userId ? req.user.email?.split('@')[0] : 'Üye'),
                is_me: m.user_id === userId
            }));

            return ApiResponse.success(res, {
                ...group,
                my_role: myMembership.role,
                is_admin: myMembership.role === 'admin',
                members: memberList
            }, 'Grup detayları getirildi.');
        } catch (err) {
            logError('getGroupDetails:catch', err);
            return ApiResponse.error(res, 'Grup detayları yüklenemedi.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * 6 Haneli Davet Koduyla Gruba Katıl
     */
    static async joinByCode(req, res) {
        try {
            const { invite_code } = req.body;
            const userId = req.user.id;

            if (!invite_code || typeof invite_code !== 'string') {
                return ApiResponse.error(res, 'Geçerli bir davet kodu giriniz.', 'INVALID_INVITE_CODE', 400);
            }

            const cleanCode = invite_code.trim().toUpperCase();

            // 1. Koda ait grubu bul
            const { data: group, error: findErr } = await supabase
                .from('groups')
                .select('*')
                .eq('invite_code', cleanCode)
                .maybeSingle();

            if (findErr || !group) {
                return ApiResponse.error(res, 'Bu davet koduna ait bir grup bulunamadı. Lütfen kodu kontrol ediniz.', 'GROUP_NOT_FOUND', 404);
            }

            // 2. Zaten üye mi kontrol et
            const { data: existingMember } = await supabase
                .from('group_members')
                .select('id, role')
                .eq('group_id', group.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (existingMember) {
                return ApiResponse.error(res, 'Zaten bu grubun bir üyesisiniz.', 'ALREADY_MEMBER', 409);
            }

            // 3. Üye olarak kaydet
            const { error: joinErr } = await supabase
                .from('group_members')
                .insert([{
                    group_id: group.id,
                    user_id: userId,
                    role: 'member'
                }]);

            if (joinErr) {
                logError('joinByCode', joinErr);
                return ApiResponse.error(res, 'Gruba katılırken hata oluştu.', 'JOIN_FAILED', 500);
            }

            return ApiResponse.success(res, {
                id: group.id,
                name: group.name,
                invite_code: group.invite_code,
                role: 'member',
                is_admin: false
            }, `"${group.name}" grubuna başarıyla katıldınız!`, 200);
        } catch (err) {
            logError('joinByCode:catch', err);
            return ApiResponse.error(res, 'Gruba katılma işlemi başarısız oldu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Gruptan Ayrıl (Kendi isteğiyle)
     */
    static async leaveGroup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const { data: membership } = await supabase
                .from('group_members')
                .select('role')
                .eq('group_id', id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!membership) {
                return ApiResponse.error(res, 'Bu grupta değilsiniz.', 'NOT_MEMBER', 404);
            }

            // Toplam üye sayısını kontrol et
            const { data: allMembers } = await supabase
                .from('group_members')
                .select('user_id, role, joined_at')
                .eq('group_id', id)
                .order('joined_at', { ascending: true });

            if (allMembers && allMembers.length <= 1) {
                // Gruptaki son kişi çıkıyorsa grubu ve görevlerini tamamen sil
                await supabase.from('groups').delete().eq('id', id);
                return ApiResponse.success(res, null, 'Gruptan ayrıldınız. Grupta kimse kalmadığı için grup kapatıldı.');
            }

            // Eğer ayrılan kişi admin ise ve başka admin yoksa, en eski üyeyi admin yap
            if (membership.role === 'admin') {
                const otherAdmins = allMembers.filter(m => m.user_id !== userId && m.role === 'admin');
                if (otherAdmins.length === 0) {
                    const nextAdmin = allMembers.find(m => m.user_id !== userId);
                    if (nextAdmin) {
                        await supabase
                            .from('group_members')
                            .update({ role: 'admin' })
                            .eq('group_id', id)
                            .eq('user_id', nextAdmin.user_id);
                    }
                }
            }

            // Üyeliği sil
            await supabase
                .from('group_members')
                .delete()
                .eq('group_id', id)
                .eq('user_id', userId);

            return ApiResponse.success(res, null, 'Gruptan başarıyla ayrıldınız.');
        } catch (err) {
            logError('leaveGroup:catch', err);
            return ApiResponse.error(res, 'Gruptan ayrılırken hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Üyeyi Gruptan Çıkar (Yalnızca Admin)
     */
    static async kickMember(req, res) {
        try {
            const { id, userId: targetUserId } = req.params;
            const adminId = req.user.id;

            if (targetUserId === adminId) {
                return ApiResponse.error(res, 'Kendinizi gruptan atamazsınız, gruptan ayrılma seçeneğini kullanın.', 'CANNOT_KICK_SELF', 400);
            }

            // İstek yapanın admin olduğunu doğrula
            const { data: adminMembership } = await supabase
                .from('group_members')
                .select('role')
                .eq('group_id', id)
                .eq('user_id', adminId)
                .maybeSingle();

            if (!adminMembership || adminMembership.role !== 'admin') {
                return ApiResponse.error(res, 'Üye çıkarmak için grup yöneticisi olmanız gerekir.', 'FORBIDDEN', 403);
            }

            // Üyeyi sil
            const { error: kickErr } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', id)
                .eq('user_id', targetUserId);

            if (kickErr) {
                logError('kickMember', kickErr);
                return ApiResponse.error(res, 'Üye çıkarılamadı.', 'DATABASE_ERROR', 500);
            }

            return ApiResponse.success(res, null, 'Üye gruptan çıkarıldı.');
        } catch (err) {
            logError('kickMember:catch', err);
            return ApiResponse.error(res, 'İşlem başarısız oldu.', 'INTERNAL_ERROR', 500);
        }
    }

    /**
     * Grubu Tamamen Sil (Yalnızca Admin)
     */
    static async deleteGroup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Admin kontrolü
            const { data: membership } = await supabase
                .from('group_members')
                .select('role')
                .eq('group_id', id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!membership || membership.role !== 'admin') {
                return ApiResponse.error(res, 'Grubu yalnızca grup yöneticisi silebilir.', 'FORBIDDEN', 403);
            }

            const { error: delErr } = await supabase
                .from('groups')
                .delete()
                .eq('id', id);

            if (delErr) {
                logError('deleteGroup', delErr);
                return ApiResponse.error(res, 'Grup silinemedi.', 'DATABASE_ERROR', 500);
            }

            return ApiResponse.success(res, null, 'Grup ve ilişkili grup görevleri başarıyla silindi.');
        } catch (err) {
            logError('deleteGroup:catch', err);
            return ApiResponse.error(res, 'Grup silinirken bir hata oluştu.', 'INTERNAL_ERROR', 500);
        }
    }
}

module.exports = GroupController;
