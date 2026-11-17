
/* ============================================================
 * WFESCTRA PRO — PROFILE AUTH
 * File: js/profile/profile-auth.js
 *
 * المسؤوليات:
 * 1. التسجيل بالبريد الإلكتروني.
 * 2. التحقق من رمز البريد.
 * 3. إكمال إنشاء الحساب.
 * 4. تسجيل الدخول.
 * 5. استعادة جلسة المستخدم.
 * 6. تسجيل الخروج.
 *
 * يعتمد على:
 * - profile-config.js
 * - profile-server.js
 * - profile-core.js (اختياري للأحداث)
 *
 * SECURITY:
 * - لا يخزن كلمات المرور.
 * - لا يخزن بيانات الحساب محلياً.
 * - Token يدار حصرياً بواسطة WFESCTRA_SERVER.
 * ============================================================ */

(function (window, document) {

    'use strict';

    if (window.WFESCTRA_PROFILE_AUTH) {
        return;
    }

    /* ========================================================
       01 — AUTH STATE
       ======================================================== */

    var AUTH = {

        ready: false,

        busy: false,

        user: null,

        restoring: false,

        register: {
            email: '',
            ticket: '',
            verified: false
        }

    };


    /* ========================================================
       02 — SERVER CONNECTION
       ======================================================== */

    function getAPI() {

        var API = window.WFESCTRA_PROFILE_SERVER;

        if (
            !API ||
            typeof API.post !== 'function' ||
            typeof API.get !== 'function'
        ) {

            throw new Error(
                'خدمة الحساب غير جاهزة. تحقق من تحميل profile-server.js.'
            );

        }

        return API;

    }


    /* ========================================================
       03 — BASIC HELPERS
       ======================================================== */

    function ep(name, fallback) {
        var E = (window.WFESCTRA_PROFILE_SERVER || {}).endpoints || {};
        return E[name] || fallback;
    }


    function normalizeEmail(email) {

        return String(email || '')
            .trim()
            .toLowerCase();

    }


    function validEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            normalizeEmail(email)
        );

    }


    function validPassword(password) {

        return (
            typeof password === 'string' &&
            password.length >= 8 &&
            password.length <= 128
        );

    }


    function requireValue(value, message) {

        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ''
        ) {

            throw new Error(message);

        }

        return String(value).trim();

    }


    function notify(message) {

        if (typeof pfNotify === 'function') {

            pfNotify(message);

        } else if (typeof showToastNotification === 'function') {

            showToastNotification(message);

        } else if (typeof showToast === 'function') {

            showToast(message);

        } else {

            console.log('[WFESCTRA AUTH]', message);

        }

    }


    function setBusy(value) {

        AUTH.busy = !!value;

        emit('busy-change', {
            busy: AUTH.busy
        });

    }


    /* ========================================================
       04 — RESPONSE HELPERS
       ======================================================== */

    function findValue(data, keys, depth) {

        depth = depth || 0;

        if (
            !data ||
            typeof data !== 'object' ||
            depth > 5
        ) {
            return null;
        }

        for (var i = 0; i < keys.length; i++) {

            var value = data[keys[i]];

            if (
                typeof value === 'string' &&
                value.trim()
            ) {

                return value.trim();

            }

        }

        var nested = [
            'data',
            'result',
            'session',
            'auth'
        ];

        for (var j = 0; j < nested.length; j++) {

            var result = findValue(
                data[nested[j]],
                keys,
                depth + 1
            );

            if (result) {
                return result;
            }

        }

        return null;

    }


    function extractToken(data) {

        return findValue(
            data,
            [
                'access_token',
                'token',
                'session_token'
            ]
        );

    }


    function extractUser(data) {

        if (
            !data ||
            typeof data !== 'object'
        ) {
            return null;
        }

        var user =
            data.user ||
            data.account ||
            data.player ||
            (data.session && data.session.user) ||
            null;

        if (!user && data.id && data.email) {
            user = data;
        }

        return (
            user &&
            typeof user === 'object'
        ) ? user : null;

    }


    function extractTicket(data) {

        return findValue(
            data,
            [
                'ticket',
                'verification_ticket',
                'registration_ticket',
                'verification_id'
            ]
        );

    }


    function handleError(error) {

        var API = window.WFESCTRA_PROFILE_SERVER;

        var message = (
            API &&
            typeof API.getErrorMessage === 'function'
        )
            ? API.getErrorMessage(error)
            : (
                error && error.message
                    ? error.message
                    : 'تعذر تنفيذ العملية.'
            );

        notify(message);

        throw error;

    }


    /* ========================================================
       05 — AUTH EVENTS
       ======================================================== */

    function emit(eventName, detail) {

        var payload = detail || {};

        try {

            document.dispatchEvent(
                new CustomEvent(
                    'wfesctra:auth:' + eventName,
                    {
                        detail: payload
                    }
                )
            );

        } catch (error) {}

        if (eventName === 'auth-change') {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        'wfesctra:auth-change',
                        {
                            detail: {
                                authenticated: !!AUTH.user,
                                user: AUTH.user
                                    ? Object.assign({}, AUTH.user)
                                    : null
                            }
                        }
                    )
                );

            } catch (error) {}

        }

    }


    /* ========================================================
       06 — SESSION MANAGEMENT
       ======================================================== */

    function setUser(user) {

        AUTH.user = (
            user &&
            typeof user === 'object'
        )
            ? Object.assign({}, user)
            : null;

        AUTH.ready = true;

        emit('auth-change', {
            authenticated: !!AUTH.user,
            user: AUTH.user
                ? Object.assign({}, AUTH.user)
                : null
        });

        return AUTH.user;

    }


    function setToken(token) {

        var API = getAPI();

        if (!token || typeof token !== 'string') {

            throw new Error(
                'لم يستلم التطبيق رمز جلسة صالحاً من السيرفر.'
            );

        }

        if (typeof API.setToken !== 'function') {

            throw new Error(
                'إدارة رمز الجلسة غير متاحة.'
            );

        }

        API.setToken(token);

    }


    function clearSession() {

        try {

            getAPI().clearToken();

        } catch (error) {}

        AUTH.user = null;

        AUTH.ready = true;

        AUTH.busy = false;

        AUTH.restoring = false;

        AUTH.register = {
            email: '',
            ticket: '',
            verified: false
        };

        emit('auth-change', {
            authenticated: false,
            user: null
        });

    }


    function activate(data) {

        var token = extractToken(data);

        if (token) {
            setToken(token);
        }

        var user = extractUser(data);

        if (user) {

            setUser(user);

            return user;

        }

        return null;

    }


    /* ========================================================
       07 — REGISTER REQUEST
       ======================================================== */

    async function registerRequest(payload) {

        payload = payload || {};

        var email = normalizeEmail(payload.email);

        var password = String(payload.password || '');

        if (!validEmail(email)) {

            throw new Error(
                'يرجى إدخال بريد إلكتروني صحيح.'
            );

        }

        if (!validPassword(password)) {

            throw new Error(
                'كلمة المرور يجب أن تكون بين 8 و128 حرفاً.'
            );

        }

        if (AUTH.busy) {
            throw new Error('توجد عملية أخرى قيد التنفيذ.');
        }

        setBusy(true);

        try {

            var data = await getAPI().post(
                ep('registerRequest','/auth/register/request'),
                {
                    email: email,
                    password: password
                },
                {
                    auth: false
                }
            );

            AUTH.register.email = email;

            AUTH.register.ticket = extractTicket(data) || '';

            AUTH.register.verified = false;

            emit('register-requested', {
                email: email,
                response: data
            });

            notify(
                'تم إرسال طلب التسجيل. تحقق من بريدك الإلكتروني.'
            );

            return data;

        } catch (error) {

            handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       08 — EMAIL VERIFICATION
       ======================================================== */

    async function registerVerify(payload) {

        payload = payload || {};

        var email = normalizeEmail(
            payload.email || AUTH.register.email
        );

        var code = requireValue(
            payload.code,
            'أدخل رمز التحقق.'
        );

        if (!validEmail(email)) {

            throw new Error(
                'البريد الإلكتروني غير صحيح.'
            );

        }

        if (!/^\d{4,8}$/.test(code)) {

            throw new Error(
                'رمز التحقق غير صالح.'
            );

        }

        if (AUTH.busy) {
            throw new Error('توجد عملية أخرى قيد التنفيذ.');
        }

        setBusy(true);

        try {

            var data = await getAPI().post(
                ep('registerVerify','/auth/register/verify'),
                {
                    email: email,
                    code: code,
                    ticket: AUTH.register.ticket || ''
                },
                {
                    auth: false
                }
            );

            AUTH.register.email = email;

            AUTH.register.ticket =
                extractTicket(data) ||
                AUTH.register.ticket;

            AUTH.register.verified = true;

            emit('email-verified', {
                email: email,
                response: data
            });

            notify('تم التحقق من البريد الإلكتروني.');

            return data;

        } catch (error) {

            handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       09 — COMPLETE REGISTRATION
       ======================================================== */

    async function registerComplete(payload) {

        payload = payload || {};

        var email = normalizeEmail(
            payload.email || AUTH.register.email
        );

        var password = String(payload.password || '');

        var displayName = requireValue(
            payload.displayName,
            'يرجى إدخال اسم اللاعب.'
        );

        if (!AUTH.register.verified) {

            throw new Error(
                'يجب التحقق من البريد الإلكتروني أولاً.'
            );

        }

        if (!validEmail(email)) {

            throw new Error(
                'البريد الإلكتروني غير صحيح.'
            );

        }

        if (!validPassword(password)) {

            throw new Error(
                'كلمة المرور غير صالحة.'
            );

        }

        if (AUTH.busy) {
            throw new Error('توجد عملية أخرى قيد التنفيذ.');
        }

        setBusy(true);

        try {

            var data = await getAPI().post(
                ep('registerComplete','/auth/register/complete'),
                {
                    email: email,
                    password: password,
                    display_name: displayName,
                    ticket: AUTH.register.ticket
                },
                {
                    auth: false
                }
            );

            var user = activate(data);

            /*
             * إذا لم يرجع السيرفر بيانات المستخدم،
             * نسترجعها من /auth/me.
             */

            if (!user) {

                var API = getAPI();

                var token = extractToken(data);

                if (!token && !API.isAuthenticated()) {

                    throw new Error(
                        'تم إنشاء الحساب لكن لم يستلم التطبيق رمز الجلسة.'
                    );

                }

                user = await restoreSession();

            }

            AUTH.register = {
                email: '',
                ticket: '',
                verified: false
            };

            emit('registered', {
                user: user
            });

            notify('تم إنشاء حسابك بنجاح.');

            return {
                success: true,
                user: user,
                response: data
            };

        } catch (error) {

            handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       10 — LOGIN
       ======================================================== */

    async function login(payload) {

        payload = payload || {};

        var email = normalizeEmail(payload.email);

        var password = String(payload.password || '');

        if (!validEmail(email)) {

            throw new Error(
                'تحقق من البريد الإلكتروني.'
            );

        }

        if (!password) {

            throw new Error(
                'أدخل كلمة المرور.'
            );

        }

        if (AUTH.busy) {
            throw new Error('توجد عملية أخرى قيد التنفيذ.');
        }

        setBusy(true);

        try {

            var data = await getAPI().post(
                ep('login','/auth/login'),
                {
                    email: email,
                    password: password
                },
                {
                    auth: false
                }
            );

            var user = activate(data);

            if (!user) {

                var token = extractToken(data);

                if (!token) {

                    throw new Error(
                        'لم يستلم التطبيق رمز الجلسة من السيرفر.'
                    );

                }

                user = await restoreSession();

            }

            emit('logged-in', {
                user: user
            });

            notify('أهلاً بعودتك.');

            return {
                success: true,
                user: user,
                response: data
            };

        } catch (error) {

            handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       11 — RESTORE SESSION
       ======================================================== */

    async function restoreSession() {

        if (AUTH.restoring) {
            return AUTH.user;
        }

        var API = getAPI();

        if (
            typeof API.getToken !== 'function' ||
            !API.getToken()
        ) {

            setUser(null);

            return null;

        }

        AUTH.restoring = true;

        setBusy(true);

        try {

            var data = await API.get(ep('me','/auth/me'));

            var user = extractUser(data);

            if (!user) {
                user = data;
            }

            setUser(user);

            emit('session-restored', {
                user: user
            });

            return user;

        } catch (error) {

            if (
                API.isUnauthorized &&
                API.isUnauthorized(error)
            ) {

                clearSession();

                return null;

            }

            throw error;

        } finally {

            AUTH.restoring = false;

            setBusy(false);

        }

    }


    /* ========================================================
       12 — LOGOUT
       ======================================================== */

    async function logout() {

        if (AUTH.busy) {
            throw new Error('توجد عملية أخرى قيد التنفيذ.');
        }

        setBusy(true);

        try {

            /*
             * لا نفترض وجود endpoint للخروج.
             * نمسح رمز الجلسة من خلال الموصل المركزي.
             */

            clearSession();

            emit('logged-out', {});

            notify('تم تسجيل الخروج.');

            return true;

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       13 — INITIALIZATION
       ======================================================== */

    async function init() {

        if (AUTH.ready) {
            return AUTH.user;
        }

        try {

            return await restoreSession();

        } catch (error) {

            console.error(
                '[WFESCTRA AUTH] Session restore failed:',
                error
            );

            AUTH.ready = true;

            AUTH.user = null;

            emit('auth-error', {
                message: error.message
            });

            return null;

        }

    }


    /* ========================================================
       14 — PUBLIC API
       ======================================================== */

    var API = {

        version: '1.0.0',

        init: init,

        registerRequest: registerRequest,

        registerVerify: registerVerify,

        registerComplete: registerComplete,

        login: login,

        restoreSession: restoreSession,

        logout: logout,

        getUser: function () {

            return AUTH.user
                ? Object.assign({}, AUTH.user)
                : null;

        },

        getState: function () {

            return {
                ready: AUTH.ready,
                busy: AUTH.busy,
                authenticated: !!AUTH.user,
                restoring: AUTH.restoring,
                user: AUTH.user
                    ? Object.assign({}, AUTH.user)
                    : null
            };

        },

        isLoggedIn: function () {

            return !!AUTH.user;

        },

        isBusy: function () {

            return AUTH.busy;

        },

        on: function (eventName, callback) {

            if (typeof callback !== 'function') {
                return;
            }

            document.addEventListener(
                'wfesctra:auth:' + eventName,
                callback
            );

        }

    };


    /* ========================================================
       15 — REGISTER MODULE
       ======================================================== */

    window.WFESCTRA_PROFILE_AUTH = API;

    console.log(
        '[WFESCTRA] Profile Authentication Module Ready.'
    );

})(window, document);
