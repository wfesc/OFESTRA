
/* ============================================================
 * OFESTRA PRO — PROFILE AUTH
 * الملف: profile-auth.js
 *
 * المسؤولية:
 * - طلب التسجيل بالبريد الإلكتروني
 * - التحقق من رمز البريد
 * - إكمال إنشاء الحساب
 * - تسجيل الدخول
 * - استعادة جلسة المستخدم
 * - تسجيل الخروج
 *
 * يعتمد على:
 * - profile-core.js
 * - profile-server.js
 * - profile-data.js
 * ============================================================ */

(function () {

    'use strict';


    /* ========================================================
       01 — MODULES
       ======================================================== */

    var API = window.OFESTRA_PROFILE_SERVER;

    var DATA = window.OFESTRA_PROFILE_DATA;


    function getAPI() {

        API = window.OFESTRA_PROFILE_SERVER;

        if (!API) {

            throw new Error(
                'خدمة الحساب غير جاهزة.'
            );

        }

        return API;

    }


    function getDATA() {

        DATA = window.OFESTRA_PROFILE_DATA;

        if (!DATA) {

            throw new Error(
                'نظام بيانات البروفايل غير جاهز.'
            );

        }

        return DATA;

    }


    /* ========================================================
       02 — AUTH STATE
       ======================================================== */

    function setBusy(value) {

        PF_AUTH.busy = !!value;

    }


    function setUser(user) {

        PF_AUTH.user = user || null;

        PF_AUTH.ready = true;

    }


    function setToken(token) {

        getAPI().setToken(token);

        PF_AUTH.token = token || '';

    }


    function clearSession() {

        try {

            getAPI().clearToken();

        } catch (error) {}


        PF_AUTH.token = '';

        PF_AUTH.user = null;

        PF_AUTH.ready = true;

        PF_AUTH.busy = false;

        PF_AUTH.restoring = false;

    }


    function getUserToken(data) {

        return (
            data &&
            (
                data.access_token ||
                data.token ||
                (
                    data.session &&
                    data.session.access_token
                )
            )
        ) || '';

    }


    function getUserData(data) {

        if (!data || typeof data !== 'object') {

            return null;

        }


        return (
            data.user ||
            data.account ||
            data.player ||
            (
                data.session &&
                data.session.user
            ) ||
            null
        );

    }


    /* ========================================================
       03 — RESPONSE HELPERS
       ======================================================== */

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


    function normalizeEmail(email) {

        return String(
            email || ''
        ).trim().toLowerCase();

    }


    function handleError(error) {

        var message = getAPI().getErrorMessage(error);

        pfNotify(message);

        throw error;

    }


    /* ========================================================
       04 — REGISTER REQUEST
       ======================================================== */

    async function requestRegistration(email, password) {

        email = normalizeEmail(email);

        password = String(password || '');


        if (!pfEmailValid(email)) {

            throw new Error(
                'يرجى إدخال بريد إلكتروني صحيح.'
            );

        }


        var passwordError = pfPasswordError(password);

        if (passwordError) {

            throw new Error(passwordError);

        }


        if (PF_AUTH.busy) {

            throw new Error(
                'هناك عملية حساب جارية، انتظر قليلاً.'
            );

        }


        setBusy(true);


        try {

            var result = await getAPI().post(
                '/auth/register/request',
                {
                    email: email,
                    password: password
                }
            );


            PF_PENDING.email = email;

            PF_PENDING.password = password;

            PF_PENDING.ticket =
                result.ticket ||
                result.registration_ticket ||
                '';


            return result;

        } catch (error) {

            return handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       05 — VERIFY EMAIL CODE
       ======================================================== */

    async function verifyRegistrationCode(code) {

        code = requireValue(
            code,
            'يرجى إدخال رمز التحقق.'
        );


        if (!PF_PENDING.email) {

            throw new Error(
                'ابدأ التسجيل من جديد قبل التحقق.'
            );

        }


        if (PF_AUTH.busy) {

            throw new Error(
                'انتظر حتى تكتمل العملية الحالية.'
            );

        }


        setBusy(true);


        try {

            var payload = {

                email: PF_PENDING.email,

                code: code

            };


            if (PF_PENDING.ticket) {

                payload.ticket = PF_PENDING.ticket;

            }


            var result = await getAPI().post(
                '/auth/register/verify',
                payload
            );


            PF_PENDING.ticket =
                result.ticket ||
                result.registration_ticket ||
                PF_PENDING.ticket;


            PF_PENDING.resetTicket =
                result.verification_token ||
                result.verify_token ||
                result.ticket ||
                PF_PENDING.ticket;


            return result;

        } catch (error) {

            return handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       06 — COMPLETE REGISTRATION
       ======================================================== */

    async function completeRegistration(username, displayName) {

        username = String(
            username || ''
        ).trim();

        displayName = String(
            displayName || ''
        ).trim();


        if (!PF_PENDING.email) {

            throw new Error(
                'بيانات التسجيل غير موجودة. ابدأ من جديد.'
            );

        }


        var usernameError = pfUsernameError(username);

        if (usernameError) {

            throw new Error(usernameError);

        }


        var displayError = pfDisplayNameError(displayName);

        if (displayError) {

            throw new Error(displayError);

        }


        if (!PF_PENDING.resetTicket) {

            throw new Error(
                'يجب تأكيد البريد الإلكتروني أولاً.'
            );

        }


        if (PF_AUTH.busy) {

            throw new Error(
                'انتظر حتى تكتمل العملية الحالية.'
            );

        }


        setBusy(true);


        try {

            var result = await getAPI().post(
                '/auth/register/complete',
                {
                    email: PF_PENDING.email,

                    ticket: PF_PENDING.resetTicket,

                    username: username,

                    display_name: displayName
                }
            );


            var token = getUserToken(result);

            var user = getUserData(result);


            if (!token) {

                throw new Error(
                    'تم تنفيذ التسجيل لكن الخادم لم يرجع رمز الجلسة.'
                );

            }


            setToken(token);

            setUser(user);


            /*
             * إزالة بيانات التسجيل المؤقتة بعد النجاح.
             */

            PF_PENDING.email = '';

            PF_PENDING.password = '';

            PF_PENDING.ticket = '';

            PF_PENDING.resetTicket = '';


            /*
             * تحميل بيانات الحساب من الخادم.
             */

            try {

                await getDATA().loadServerProfile();

            } catch (profileError) {

                console.warn(
                    '[OFESTRA] Profile loading after registration failed:',
                    profileError
                );

            }


            pfNotify('تم إنشاء حساب OFESTRA بنجاح.');

            pfPublish();

            pfRefresh();


            return result;

        } catch (error) {

            return handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       07 — LOGIN
       ======================================================== */

    async function login(email, password) {

        email = normalizeEmail(email);

        password = String(password || '');


        if (!pfEmailValid(email)) {

            throw new Error(
                'يرجى إدخال بريد إلكتروني صحيح.'
            );

        }


        if (!password) {

            throw new Error(
                'يرجى إدخال كلمة المرور.'
            );

        }


        if (PF_AUTH.busy) {

            throw new Error(
                'انتظر حتى تكتمل العملية الحالية.'
            );

        }


        setBusy(true);


        try {

            var result = await getAPI().post(
                '/auth/login',
                {
                    email: email,
                    password: password
                }
            );


            var token = getUserToken(result);

            var user = getUserData(result);


            if (!token) {

                throw new Error(
                    'الخادم لم يرجع رمز جلسة صالح.'
                );

            }


            setToken(token);

            setUser(user);


            try {

                await getDATA().loadServerProfile();

            } catch (profileError) {

                console.error(
                    '[OFESTRA] Profile loading failed:',
                    profileError
                );

                throw new Error(
                    'تم تسجيل الدخول، لكن تعذر تحميل بيانات البروفايل.'
                );

            }


            pfNotify('تم تسجيل الدخول بنجاح.');

            pfPublish();

            pfRefresh();


            return result;

        } catch (error) {

            /*
             * إذا فشل تسجيل الدخول لا نمسح جلسة سابقة
             * إلا إذا كانت العملية قد أنشأت جلسة جديدة.
             */

            return handleError(error);

        } finally {

            setBusy(false);

        }

    }


    /* ========================================================
       08 — RESTORE SESSION
       ======================================================== */

    async function restoreSession() {

        if (PF_AUTH.restoring) {

            return false;

        }


        PF_AUTH.restoring = true;


        try {

            var token = getAPI().getToken();

            PF_AUTH.token = token || '';


            if (!token) {

                PF_AUTH.user = null;

                PF_AUTH.ready = true;

                getDATA().loadGuestProfile();

                return false;

            }


            var result = await getAPI().get('/auth/me');


            var user = getUserData(result);


            if (!user) {

                user = result;

            }


            setUser(user);


            await getDATA().loadServerProfile();


            return true;

        } catch (error) {

            /*
             * لا نمسح الجلسة بسبب انقطاع الإنترنت.
             * نمسحها فقط إذا أكد الخادم أن التوكن غير صالح.
             */

            if (
                getAPI().isUnauthorized(error)
            ) {

                clearSession();

                getDATA().loadGuestProfile();

                return false;

            }


            PF_AUTH.ready = true;

            console.warn(
                '[OFESTRA] Session restore failed:',
                error
            );


            throw error;

        } finally {

            PF_AUTH.restoring = false;

        }

    }


    /* ========================================================
       09 — LOGOUT
       ======================================================== */

    function logout() {

        clearSession();


        /*
         * لا نمسح بيانات الضيف القديمة.
         * نعيد عرض ملف الضيف بعد الخروج.
         */

        getDATA().loadGuestProfile();


        pfNotify('تم تسجيل الخروج.');

        pfPublish();

        pfRefresh();


        return true;

    }


    /* ========================================================
       10 — REGISTRATION RESET
       ======================================================== */

    function resetRegistration() {

        PF_PENDING.email = '';

        PF_PENDING.password = '';

        PF_PENDING.ticket = '';

        PF_PENDING.resetTicket = '';


        return true;

    }


    /* ========================================================
       11 — AUTH STATUS
       ======================================================== */

    function isLoggedIn() {

        return !!(
            PF_AUTH.token &&
            PF_AUTH.user
        );

    }


    function getCurrentUser() {

        return PF_AUTH.user;

    }


    /* ========================================================
       12 — PUBLIC API
       ======================================================== */

    var AUTH = {

        requestRegistration: requestRegistration,

        verifyRegistrationCode: verifyRegistrationCode,

        completeRegistration: completeRegistration,

        login: login,

        restoreSession: restoreSession,

        logout: logout,

        resetRegistration: resetRegistration,

        isLoggedIn: isLoggedIn,

        getCurrentUser: getCurrentUser

    };


    /* ========================================================
       13 — REGISTER
       ======================================================== */

    window.OFESTRA_PROFILE_AUTH = AUTH;


    console.log(
        '[OFESTRA] Profile Auth Ready'
    );


})();

