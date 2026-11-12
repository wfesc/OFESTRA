
/* ============================================================
 * OFESTRA PRO — PROFILE DATA
 * الملف: profile-data.js
 *
 * المسؤولية:
 * - تحميل بيانات البروفايل
 * - حفظ وتحديث بيانات اللاعب
 * - إدارة الصورة الشخصية
 * - فصل بيانات الحساب عن بيانات الضيف
 * - مزامنة الحساب مع الخادم
 *
 * يعتمد على:
 * - profile-core.js
 * - profile-server.js
 * - profile-levels.js
 * ============================================================ */

(function () {

    'use strict';


    /* ========================================================
       01 — CONFIGURATION
       ======================================================== */

    var API = window.OFESTRA_PROFILE_SERVER;

    var DEFAULT_AVATAR = PF_DEFAULT_AVATAR;

    var GUEST_STORAGE_KEY = 'OFESTRA_GUEST_PROFILE';

    var MAX_AVATAR_BYTES = PF_RULES.AVATAR_MAX_BYTES;

    var MAX_AVATAR_SIZE = PF_RULES.AVATAR_MAX_SIZE;


    /* ========================================================
       02 — SERVER CHECK
       ======================================================== */

    function requireServer() {

        API = window.OFESTRA_PROFILE_SERVER;

        if (
            !API ||
            typeof API.get !== 'function' ||
            typeof API.put !== 'function'
        ) {

            throw new Error(
                'نظام الاتصال بالبروفايل غير جاهز.'
            );

        }

        return API;

    }


    function isLoggedIn() {

        return !!(
            window.PF_AUTH &&
            window.PF_AUTH.token &&
            window.PF_AUTH.user
        );

    }


    /* ========================================================
       03 — NORMALIZE PROFILE
       ======================================================== */

    function normalizeProfile(data) {

        data = data && typeof data === 'object'
            ? data
            : {};


        var normalized = {

            name: String(
                data.name ||
                data.display_name ||
                'Player'
            ).trim(),

            username: String(
                data.username || ''
            ).trim(),

            info: String(
                data.info ||
                data.bio ||
                ''
            ).slice(0, PF_RULES.BIO_MAX),

            avatarUrl: String(
                data.avatar_url ||
                data.avatarUrl ||
                DEFAULT_AVATAR
            ),

            w: pfNumber(data.wins ?? data.w, 0),

            l: pfNumber(data.losses ?? data.l, 0),

            d: pfNumber(data.draws ?? data.d, 0),

            played: pfNumber(data.played, 0),

            mins: pfNumber(
                data.minutes ??
                data.mins,
                0
            ),

            xp: pfNumber(
                data.xp ??
                data.experience,
                0
            ),

            level: pfNumber(data.level, 1),

            seen: pfNumber(data.seen, 0),

            lastNamed: pfNumber(data.lastNamed, 0)

        };


        if (
            !/^https:\/\//i.test(normalized.avatarUrl) &&
            normalized.avatarUrl !== DEFAULT_AVATAR
        ) {

            normalized.avatarUrl = DEFAULT_AVATAR;

        }


        return normalized;

    }


    /* ========================================================
       04 — APPLY PROFILE
       ======================================================== */

    function applyProfile(data) {

        var normalized = normalizeProfile(data);


        Object.keys(normalized).forEach(function (key) {

            PF[key] = normalized[key];

        });


        /*
         * لا نكتب بيانات الحساب المسجل في localStorage.
         * العرض والتحديث يتمان من الذاكرة والخادم.
         */

        if (typeof pfRefresh === 'function') {

            pfRefresh();

        }


        return normalized;

    }


    /* ========================================================
       05 — SERVER PROFILE
       ======================================================== */

    async function loadServerProfile() {

        if (!isLoggedIn()) {

            throw new Error(
                'يجب تسجيل الدخول أولاً.'
            );

        }


        var server = requireServer();

        var data = await server.get('/profile');


        /*
         * بعض الاستجابات قد تحتوي بيانات الملف
         * داخل مفتاح profile.
         */

        var profileData =
            data.profile &&
            typeof data.profile === 'object'
                ? data.profile
                : data;


        return applyProfile(profileData);

    }


    async function updateServerProfile(changes) {

        if (!isLoggedIn()) {

            throw new Error(
                'لا يمكن تحديث حساب غير مسجل.'
            );

        }


        var server = requireServer();

        changes = changes || {};


        var payload = {};


        if (changes.name !== undefined) {

            payload.display_name = String(
                changes.name
            ).trim();

        }


        if (changes.info !== undefined) {

            payload.bio = String(
                changes.info
            ).slice(0, PF_RULES.BIO_MAX);

        }


        if (changes.avatar_url !== undefined) {

            payload.avatar_url = String(
                changes.avatar_url
            );

        }


        if (changes.avatarUrl !== undefined) {

            payload.avatar_url = String(
                changes.avatarUrl
            );

        }


        var result = await server.put(
            '/profile',
            payload
        );


        var profileData =
            result.profile &&
            typeof result.profile === 'object'
                ? result.profile
                : result;


        applyProfile(profileData);


        return result;

    }


    /* ========================================================
       06 — GUEST PROFILE
       ======================================================== */

    function readGuestProfile() {

        try {

            var raw = localStorage.getItem(
                GUEST_STORAGE_KEY
            );

            if (!raw) return null;


            var data = JSON.parse(raw);

            if (
                !data ||
                typeof data !== 'object'
            ) {

                return null;

            }


            return normalizeProfile(data);

        } catch (error) {

            console.warn(
                '[OFESTRA] Guest profile read failed:',
                error
            );

            return null;

        }

    }


    function saveGuestProfile() {

        if (isLoggedIn()) {

            throw new Error(
                'لا يجوز حفظ بيانات الحساب المسجل كبيانات ضيف.'
            );

        }


        var guestData = {

            name: PF.name,

            info: PF.info,

            avatarUrl: PF.avatarUrl,

            w: PF.w,

            l: PF.l,

            d: PF.d,

            played: PF.played,

            mins: PF.mins,

            xp: PF.xp || 0

        };


        try {

            localStorage.setItem(
                GUEST_STORAGE_KEY,
                JSON.stringify(guestData)
            );

        } catch (error) {

            throw new Error(
                'تعذر حفظ تقدم الضيف على الجهاز.'
            );

        }


        return guestData;

    }


    function loadGuestProfile() {

        if (isLoggedIn()) {

            throw new Error(
                'الحساب المسجل لا يستخدم بيانات الضيف.'
            );

        }


        var guest = readGuestProfile();


        if (guest) {

            applyProfile(guest);

            return guest;

        }


        var freshGuest = normalizeProfile({

            name: 'Guest',

            avatarUrl: DEFAULT_AVATAR,

            w: 0,

            l: 0,

            d: 0,

            played: 0,

            mins: 0,

            xp: 0

        });


        applyProfile(freshGuest);

        saveGuestProfile();


        return freshGuest;

    }


    /* ========================================================
       07 — UPDATE PROFILE DATA
       ======================================================== */

    async function updateProfile(changes) {

        changes = changes || {};


        if (isLoggedIn()) {

            return await updateServerProfile(changes);

        }


        var allowed = [
            'name',
            'info',
            'avatarUrl'
        ];


        allowed.forEach(function (key) {

            if (changes[key] !== undefined) {

                PF[key] = changes[key];

            }

        });


        if (
            changes.name !== undefined &&
            pfDisplayNameError(PF.name)
        ) {

            throw new Error(
                pfDisplayNameError(PF.name)
            );

        }


        if (
            changes.info !== undefined &&
            String(PF.info).length > PF_RULES.BIO_MAX
        ) {

            throw new Error(
                'النبذة أطول من الحد المسموح.'
            );

        }


        saveGuestProfile();

        pfRefresh();


        return normalizeProfile(PF);

    }


    /* ========================================================
       08 — AVATAR VALIDATION
       ======================================================== */

    function validateAvatar(file) {

        if (!file) {

            throw new Error(
                'يرجى اختيار صورة.'
            );

        }


        if (
            !/^image\/(jpeg|png|webp)$/.test(file.type)
        ) {

            throw new Error(
                'الصورة يجب أن تكون JPG أو PNG أو WEBP.'
            );

        }


        if (file.size > MAX_AVATAR_BYTES) {

            throw new Error(
                'حجم الصورة يجب ألا يتجاوز 2 ميغابايت.'
            );

        }


        return true;

    }


    /* ========================================================
       09 — RESIZE AVATAR
       ======================================================== */

    function resizeAvatar(file) {

        return new Promise(function (resolve, reject) {

            var reader = new FileReader();


            reader.onerror = function () {

                reject(
                    new Error('تعذرت قراءة الصورة.')
                );

            };


            reader.onload = function () {

                var image = new Image();


                image.onerror = function () {

                    reject(
                        new Error('ملف الصورة غير صالح.')
                    );

                };


                image.onload = function () {

                    var canvas = document.createElement('canvas');

                    var size = MAX_AVATAR_SIZE;

                    canvas.width = size;

                    canvas.height = size;


                    var context = canvas.getContext('2d');

                    if (!context) {

                        reject(
                            new Error('تعذر تجهيز الصورة.')
                        );

                        return;

                    }


                    var scale = Math.max(
                        size / image.width,
                        size / image.height
                    );


                    var width = image.width * scale;

                    var height = image.height * scale;

                    var x = (size - width) / 2;

                    var y = (size - height) / 2;


                    context.fillStyle = '#101522';

                    context.fillRect(
                        0,
                        0,
                        size,
                        size
                    );


                    context.drawImage(
                        image,
                        x,
                        y,
                        width,
                        height
                    );


                    canvas.toBlob(
                        function (blob) {

                            if (!blob) {

                                reject(
                                    new Error('تعذر ضغط الصورة.')
                                );

                                return;

                            }


                            resolve(blob);

                        },
                        'image/jpeg',
                        0.88
                    );

                };


                image.src = reader.result;

            };


            reader.readAsDataURL(file);

        });

    }


    /* ========================================================
       10 — AVATAR UPLOAD
       ======================================================== */

    async function uploadAvatar(file) {

        validateAvatar(file);


        if (!isLoggedIn()) {

            /*
             * الضيف يحتفظ بصورته محلياً فقط.
             */

            var guestBlob = await resizeAvatar(file);

            var guestDataUrl = await new Promise(
                function (resolve, reject) {

                    var reader = new FileReader();

                    reader.onload = function () {

                        resolve(reader.result);

                    };

                    reader.onerror = function () {

                        reject(
                            new Error('تعذرت قراءة الصورة.')
                        );

                    };

                    reader.readAsDataURL(guestBlob);

                }
            );


            PF.avatarUrl = guestDataUrl;

            saveGuestProfile();

            pfRefresh();


            return guestDataUrl;

        }


        if (PF_AVATAR_UPLOAD_BUSY) {

            throw new Error(
                'انتظر حتى يكتمل رفع الصورة الحالية.'
            );

        }


        PF_AVATAR_UPLOAD_BUSY = true;


        try {

            var blob = await resizeAvatar(file);

            var formData = new FormData();

            formData.append(
                'file',
                blob,
                'avatar.jpg'
            );


            /*
             * مسار رفع الصورة غير مؤكد في الخادم الحالي.
             * نستخدمه فقط إذا كان endpoint موجوداً.
             */

            var server = requireServer();

            var result = await server.post(
                '/profile/avatar',
                formData
            );


            var imageUrl =
                result.avatar_url ||
                result.url ||
                (
                    result.profile &&
                    result.profile.avatar_url
                );


            if (!imageUrl) {

                throw new Error(
                    'الخادم لم يرجع رابط الصورة.'
                );

            }


            PF.avatarUrl = imageUrl;

            pfRefresh();


            return imageUrl;

        } finally {

            PF_AVATAR_UPLOAD_BUSY = false;

        }

    }


    /* ========================================================
       11 — MATCH RESULT SYNC
       ======================================================== */

    async function recordMatch(result, extra) {

        extra = extra || {};


        if (!window.OFESTRA_PROFILE_LEVELS) {

            throw new Error(
                'نظام المستويات غير جاهز.'
            );

        }


        var levels = window.OFESTRA_PROFILE_LEVELS;


        /*
         * الحساب المسجل:
         * لا نزيد الإحصائيات محلياً قبل تأكيد الخادم.
         *
         * endpoint تسجيل المباراة لم يُعتمد بعد،
         * لذلك لا نرسل طلباً بمسار غير مؤكد.
         */

        if (isLoggedIn()) {

            throw new Error(
                'تسجيل نتائج الحسابات على الخادم يحتاج تفعيل مسار المباريات أولاً.'
            );

        }


        var resultData = levels.applyMatchResult(
            result,
            PF
        );


        PF.mins = number(PF.mins) +
            number(extra.minutes);


        saveGuestProfile();

        pfRefresh();


        return resultData;

    }


    /* ========================================================
       12 — RESET GUEST PROGRESS
       ======================================================== */

    function resetGuestProfile() {

        if (isLoggedIn()) {

            throw new Error(
                'لا يمكن تصفير بيانات حساب مسجل من نظام الضيف.'
            );

        }


        var fresh = normalizeProfile({

            name: 'Guest',

            avatarUrl: DEFAULT_AVATAR,

            w: 0,

            l: 0,

            d: 0,

            played: 0,

            mins: 0,

            xp: 0

        });


        applyProfile(fresh);

        saveGuestProfile();


        return fresh;

    }


    /* ========================================================
       13 — PUBLIC API
       ======================================================== */

    var DATA = {

        normalizeProfile: normalizeProfile,

        applyProfile: applyProfile,

        loadServerProfile: loadServerProfile,

        updateServerProfile: updateServerProfile,

        readGuestProfile: readGuestProfile,

        saveGuestProfile: saveGuestProfile,

        loadGuestProfile: loadGuestProfile,

        updateProfile: updateProfile,

        validateAvatar: validateAvatar,

        resizeAvatar: resizeAvatar,

        uploadAvatar: uploadAvatar,

        recordMatch: recordMatch,

        resetGuestProfile: resetGuestProfile,

        isLoggedIn: isLoggedIn

    };


    /* ========================================================
       14 — REGISTER
       ======================================================== */

    window.OFESTRA_PROFILE_DATA = DATA;


    console.log(
        '[OFESTRA] Profile Data Ready'
    );


})();

