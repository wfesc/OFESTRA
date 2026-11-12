/* ============================================================
   OFESTRA PRO — PROFILE.JS
   WFESC ENGINE
   PROFILE / ACCOUNT / AUTHENTICATION
   ============================================================ */


/* ============================================================
   01 — PLAYER FALLBACK
   ============================================================ */

if (typeof PF === 'undefined') {
    window.PF = {
        name: 'Player',
        av: 0,
        info: '',
        w: 0,
        l: 0,
        d: 0,
        played: 0,
        mins: 0,
        seen: 0
    };
}


/* ============================================================
   02 — API CONFIGURATION
   ============================================================ */

var PF_API = {

    BASE_URL:
        localStorage.getItem('OFESTRA_API_URL') ||
        'http://127.0.0.1:8000',

    REGISTER_REQUEST: '/auth/register/request',
    REGISTER_VERIFY: '/auth/register/verify',
    REGISTER_COMPLETE: '/auth/register/complete',

    LOGIN: '/auth/login',
    ME: '/auth/me',

    PROFILE: '/profile',

    FORGOT_REQUEST: '/auth/password/forgot/request',
    FORGOT_VERIFY: '/auth/password/forgot/verify',
    FORGOT_RESET: '/auth/password/forgot/reset',

    USERNAME_CHANGE: '/auth/username/change'

};


/*
   config.js يجب أن يعرّف:

   window.OFESTRA_CONFIG = {
       API_BASE: 'http://127.0.0.1:8000',
       OFESTRA_SECRET_KEY: 'YOUR_KEY'
   };

   لا تضع المفتاح الحقيقي في المحادثة.
*/


function pfConfig() {

    var config = window.OFESTRA_CONFIG || {};

    var base =
        config.API_BASE ||
        config.BASE_URL ||
        window.OFESTRA_API_BASE ||
        localStorage.getItem('OFESTRA_API_URL') ||
        PF_API.BASE_URL;

    var key =
        config.OFESTRA_SECRET_KEY ||
        config.GAME_KEY ||
        window.OFESTRA_SECRET_KEY ||
        '';

    return {
        base: String(base || '').replace(/\/+$/, ''),
        key: String(key || '').trim()
    };

}


function pfBase() {
    return pfConfig().base;
}


function pfGameKey() {
    return pfConfig().key;
}


/* ============================================================
   03 — RULES
   ============================================================ */

var PF_RULES = {

    USERNAME_MIN: 4,
    USERNAME_MAX: 10,

    PASSWORD_MIN: 8,
    PASSWORD_MAX: 20,

    DISPLAY_NAME_MIN: 2,
    DISPLAY_NAME_MAX: 20,

    BIO_MAX: 250,

    USERNAME_CHANGE_DAYS: 7

};


var PF_USERNAME_PATTERN = /^[A-Za-z0-9]+$/;

var PF_EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

var PF_PASSWORD_ALLOWED =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'abcdefghijklmnopqrstuvwxyz' +
    '0123456789' +
    '!@#$%^&*()-_=+[]{};:,.?';


/* ============================================================
   04 — AVATARS
   ============================================================ */

var PF_AVATARS = [

    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=320&h=320&q=85',

    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=320&h=320&q=85'

];


/* ============================================================
   05 — AUTH STATE
   ============================================================ */

var PF_AUTH = {

    token: '',
    user: null,

    ready: false,
    busy: false,
    restoring: false

};


/*
   رمز الجلسة يبقى في الذاكرة فقط.
   لا نخزن كلمات المرور أو بيانات الحساب الدائمة محلياً.
*/

var PF_VIEW = 'home';

var PF_PENDING = {

    email: '',
    password: '',
    ticket: '',
    resetTicket: ''

};

var PF_PROFILE_TIMER = null;
var PF_SYNC_TIMER = null;


/* ============================================================
   06 — HELPERS
   ============================================================ */

function pfGet(id) {
    return document.getElementById(id);
}


function pfEscape(value) {

    return String(value == null ? '' : value)
        .replace(/[&<>"']/g, function (char) {

            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];

        });

}


function pfNotify(message) {

    if (typeof showToastNotification === 'function') {
        showToastNotification(message);

    } else if (typeof showToast === 'function') {
        showToast(message);

    } else {
        console.log('[OFESTRA]', message);
    }

}


function pfSound() {

    if (typeof X !== 'undefined' && X.sw) {
        X.sw();
    }

}


function pfSaveLocal() {

    if (typeof savePF === 'function') {
        savePF();
    }

}


function pfPublish() {

    if (typeof publishDir === 'function') {
        publishDir();
    }

}


function pfRefresh() {

    if (typeof refresh === 'function') {
        refresh();
    }

}


function pfUID() {

    var user = PF_AUTH.user || {};

    return String(
        user.uid ||
        user.player_uid ||
        user.playerId ||
        user.id ||
        ''
    );

}


function pfToken() {
    return PF_AUTH.token || '';
}


function pfSetToken(token) {
    PF_AUTH.token = String(token || '');
}


function pfLogged() {

    return !!(
        pfToken() &&
        PF_AUTH.user &&
        pfUID()
    );

}


function pfEmailValid(email) {

    return PF_EMAIL_PATTERN.test(
        String(email || '').trim()
    );

}


function pfUsernameError(username) {

    username = String(username || '');

    if (!username) {
        return 'يرجى إدخال اسم المستخدم.';
    }

    if (/\s/.test(username)) {
        return 'اسم المستخدم لا يقبل الفراغات.';
    }

    if (username.length === 3) {
        return 'الأسماء المكوّنة من 3 خانات محجوزة للإدارة.';
    }

    if (username.length < PF_RULES.USERNAME_MIN) {
        return 'اسم المستخدم يجب أن يحتوي على 4 خانات على الأقل.';
    }

    if (username.length > PF_RULES.USERNAME_MAX) {
        return 'الحد الأقصى لاسم المستخدم هو 10 خانات.';
    }

    if (!PF_USERNAME_PATTERN.test(username)) {
        return 'استخدم الحروف الإنجليزية والأرقام فقط.';
    }

    return '';

}


function pfPasswordError(password) {

    password = String(password || '');

    if (password.length < PF_RULES.PASSWORD_MIN) {
        return 'كلمة المرور يجب أن تحتوي على 8 خانات على الأقل.';
    }

    if (password.length > PF_RULES.PASSWORD_MAX) {
        return 'الحد الأقصى لكلمة المرور هو 20 خانة.';
    }

    for (var i = 0; i < password.length; i++) {

        if (PF_PASSWORD_ALLOWED.indexOf(password[i]) === -1) {
            return 'توجد رموز غير مسموح بها في كلمة المرور.';
        }

    }

    return '';

}


function pfDisplayNameError(name) {

    name = String(name || '').trim();

    if (name.length < PF_RULES.DISPLAY_NAME_MIN) {
        return 'اسم العرض يجب أن يحتوي على حرفين على الأقل.';
    }

    if (name.length > PF_RULES.DISPLAY_NAME_MAX) {
        return 'اسم العرض طويل جداً.';
    }

    return '';

}


function pfErrorText(error) {

    if (!error) {
        return 'حدث خطأ غير معروف.';
    }

    var message = error.message || '';

    if (Array.isArray(message)) {

        return message.map(function (item) {
            return item.msg || String(item);
        }).join('، ');

    }

    return String(message);

}


/* ============================================================
   07 — SERVER REQUEST
   ============================================================ */

async function pfRequest(path, options) {

    options = options || {};

    var config = pfConfig();

    if (!config.base) {
        throw new Error('عنوان سيرفر OFESTRA غير مضبوط في config.js.');
    }

    if (!config.key) {
        throw new Error(
            'مفتاح OFESTRA غير مضبوط. راجع ملف js/config.js.'
        );
    }

    var headers = {
        Accept: 'application/json',
        'X-OFESTRA-KEY': config.key
    };

    var token = pfToken();

    if (token && options.auth !== false) {
        headers.Authorization = 'Bearer ' + token;
    }

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (options.headers) {

        Object.keys(options.headers).forEach(function (name) {
            headers[name] = options.headers[name];
        });

    }

    var response;

    try {

        response = await fetch(

            config.base + path,

            {

                method: options.method || 'GET',

                headers: headers,

                body: options.body !== undefined
                    ? JSON.stringify(options.body)
                    : undefined

            }

        );

    } catch (networkError) {

        throw new Error(
            'تعذر الوصول إلى السيرفر. تأكد أن سيرفر Termux يعمل وأن عنوان الاتصال صحيح.'
        );

    }

    var raw = await response.text();

    var data = {};

    try {
        data = raw ? JSON.parse(raw) : {};
    } catch (parseError) {
        data = { message: raw };
    }

    if (!response.ok) {

        var message =
            data.detail ||
            data.message ||
            data.error ||
            'HTTP ' + response.status;

        if (Array.isArray(message)) {

            message = message.map(function (item) {
                return item.msg || String(item);
            }).join('، ');

        }

        var error = new Error(String(message));

        error.status = response.status;
        error.data = data;

        throw error;

    }

    return data;

}


/* ============================================================
   08 — RESPONSE PARSING
   ============================================================ */

function pfReadToken(data) {

    if (!data) return '';

    return (

        data.access_token ||
        data.token ||
        data.session_token ||
        data.session?.access_token ||
        data.session?.token ||
        data.data?.access_token ||
        data.data?.token ||
        data.data?.session_token ||
        ''

    );

}


function pfReadUser(data) {

    if (!data || typeof data !== 'object') {
        return null;
    }

    return (

        data.user ||
        data.player ||
        data.account ||
        data.data?.user ||
        data.data?.player ||
        data.data?.account ||
        data

    );

}


function pfReadProfile(data) {

    if (!data || typeof data !== 'object') {
        return null;
    }

    return (

        data.profile ||
        data.player_profile ||
        data.data?.profile ||
        data.data?.player_profile ||
        data.data ||
        data

    );

}


/* ============================================================
   09 — BUSY STATE
   ============================================================ */

function pfSetBusy(value) {

    PF_AUTH.busy = !!value;

    var panel = pfGet('pfAccountPanel');

    if (!panel) return;

    panel.classList.toggle('is-busy', PF_AUTH.busy);

    panel.querySelectorAll('button').forEach(function (button) {

        button.disabled = PF_AUTH.busy;

    });

}


/* ============================================================
   10 — LOGIN
   ============================================================ */

async function pfLogin(identifier, password) {

    if (PF_AUTH.busy) return false;

    identifier = String(identifier || '').trim();
    password = String(password || '');

    if (!identifier) {

        pfNotify('أدخل البريد الإلكتروني أو اسم المستخدم.');
        return false;

    }

    var passwordError = pfPasswordError(password);

    if (passwordError) {

        pfNotify(passwordError);
        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.LOGIN,

            {

                method: 'POST',
                auth: false,

                body: {

                    email: identifier,
                    username: identifier,
                    identifier: identifier,
                    password: password

                }

            }

        );

        var token = pfReadToken(response);

        if (!token) {
            throw new Error('السيرفر لم يرجع رمز تسجيل الدخول.');
        }

        pfSetToken(token);

        PF_AUTH.user = pfReadUser(response);

        if (!pfUID()) {

            var account = await pfRequest(
                PF_API.ME,
                { method: 'GET' }
            );

            PF_AUTH.user = pfReadUser(account);

        }

        if (!pfUID()) {
            throw new Error('لم يتم استلام UID صالح من السيرفر.');
        }

        PF_AUTH.ready = true;

        PF_VIEW = 'profile';

        await pfLoadRemote();

        renderProf();

        pfPublish();

        pfNotify('تم تسجيل الدخول بنجاح.');
        pfSound();

        return true;

    } catch (error) {

        pfSetToken('');
        PF_AUTH.user = null;

        pfNotify(
            'تعذر تسجيل الدخول: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   11 — REGISTRATION REQUEST
   ============================================================ */

async function pfRegisterRequest(email, password) {

    if (PF_AUTH.busy) return false;

    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    if (!pfEmailValid(email)) {

        pfNotify('أدخل بريداً إلكترونياً صحيحاً.');
        return false;

    }

    var passwordError = pfPasswordError(password);

    if (passwordError) {

        pfNotify(passwordError);
        return false;

    }

    PF_PENDING.email = email;
    PF_PENDING.password = password;

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.REGISTER_REQUEST,

            {

                method: 'POST',
                auth: false,

                body: {
                    email: email,
                    password: password
                }

            }

        );

        PF_VIEW = 'register-code';

        pfNotify(
            response.message ||
            'تم إرسال رمز التحقق إلى بريدك الإلكتروني.'
        );

        return true;

    } catch (error) {

        pfNotify(
            'تعذر إرسال رمز التحقق: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   12 — VERIFY REGISTRATION
   ============================================================ */

async function pfVerifyRegistration(code) {

    if (PF_AUTH.busy) return false;

    code = String(code || '').trim();

    if (!/^\d{6}$/.test(code)) {

        pfNotify('أدخل رمز التحقق المكوّن من 6 أرقام.');
        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.REGISTER_VERIFY,

            {

                method: 'POST',
                auth: false,

                body: {

                    email: PF_PENDING.email,
                    code: code,
                    verification_code: code

                }

            }

        );

        var ticket =
            response.ticket ||
            response.verification_ticket ||
            response.data?.ticket ||
            '';

        if (!ticket) {
            throw new Error('السيرفر لم يرجع تذكرة إكمال التسجيل.');
        }

        PF_PENDING.ticket = ticket;

        PF_VIEW = 'register-username';

        pfNotify('تم تأكيد البريد الإلكتروني بنجاح.');

        return true;

    } catch (error) {

        pfNotify(
            'تعذر التحقق: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   13 — COMPLETE REGISTRATION
   ============================================================ */

async function pfCompleteRegistration(username, displayName) {

    if (PF_AUTH.busy) return false;

    username = String(username || '').trim();

    displayName = String(
        displayName || username
    ).trim();

    var usernameError = pfUsernameError(username);

    if (usernameError) {

        pfNotify(usernameError);
        return false;

    }

    var displayError = pfDisplayNameError(displayName);

    if (displayError) {

        pfNotify(displayError);
        return false;

    }

    if (!PF_PENDING.ticket) {

        pfNotify('انتهت جلسة التسجيل. أعد طلب رمز التحقق.');

        PF_VIEW = 'register';

        pfRenderAccount();

        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.REGISTER_COMPLETE,

            {

                method: 'POST',
                auth: false,

                body: {

                    ticket: PF_PENDING.ticket,
                    username: username,
                    display_name: displayName

                }

            }

        );

        var token = pfReadToken(response);

        if (!token) {
            throw new Error('السيرفر لم يرجع رمز الجلسة.');
        }

        pfSetToken(token);

        PF_AUTH.user = pfReadUser(response);

        if (!pfUID()) {

            var me = await pfRequest(
                PF_API.ME,
                { method: 'GET' }
            );

            PF_AUTH.user = pfReadUser(me);

        }

        if (!pfUID()) {
            throw new Error('الحساب أنشئ لكن UID غير متوفر.');
        }

        PF_AUTH.ready = true;

        PF_VIEW = 'profile';

        PF.name = displayName;
        PF.av = 0;
        PF.info = '';

        PF.w = 0;
        PF.l = 0;
        PF.d = 0;
        PF.played = 0;
        PF.mins = 0;

        PF_PENDING.email = '';
        PF_PENDING.password = '';
        PF_PENDING.ticket = '';

        await pfLoadRemote();

        renderProf();
        pfPublish();

        pfNotify('تم إنشاء حساب OFESTRA بنجاح.');
        pfSound();

        return true;

    } catch (error) {

        pfNotify(
            'تعذر إكمال إنشاء الحساب: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   14 — FORGOT PASSWORD REQUEST
   ============================================================ */

async function pfForgotRequest(email) {

    if (PF_AUTH.busy) return false;

    email = String(email || '').trim().toLowerCase();

    if (!pfEmailValid(email)) {

        pfNotify('أدخل بريداً إلكترونياً صحيحاً.');
        return false;

    }

    PF_PENDING.email = email;

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.FORGOT_REQUEST,

            {

                method: 'POST',
                auth: false,

                body: {
                    email: email
                }

            }

        );

        PF_VIEW = 'forgot-code';

        pfNotify(
            response.message ||
            'إذا كان البريد مسجلاً، سيصلك رمز استعادة كلمة المرور.'
        );

        return true;

    } catch (error) {

        pfNotify(
            'تعذر طلب الاستعادة: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   15 — VERIFY FORGOT PASSWORD
   ============================================================ */

async function pfForgotVerify(code) {

    if (PF_AUTH.busy) return false;

    code = String(code || '').trim();

    if (!/^\d{6}$/.test(code)) {

        pfNotify('أدخل رمز التحقق المكوّن من 6 أرقام.');
        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.FORGOT_VERIFY,

            {

                method: 'POST',
                auth: false,

                body: {

                    email: PF_PENDING.email,
                    code: code,
                    verification_code: code

                }

            }

        );

        PF_PENDING.resetTicket =
            response.ticket ||
            response.reset_ticket ||
            response.data?.ticket ||
            '';

        if (!PF_PENDING.resetTicket) {
            throw new Error('السيرفر لم يرجع تذكرة الاستعادة.');
        }

        PF_VIEW = 'forgot-password';

        pfNotify('تم تأكيد الرمز. أدخل كلمة المرور الجديدة.');

        return true;

    } catch (error) {

        pfNotify(
            'تعذر التحقق من الرمز: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   16 — RESET PASSWORD
   ============================================================ */

async function pfForgotReset(password, confirmPassword) {

    if (PF_AUTH.busy) return false;

    password = String(password || '');
    confirmPassword = String(confirmPassword || '');

    var passwordError = pfPasswordError(password);

    if (passwordError) {

        pfNotify(passwordError);
        return false;

    }

    if (password !== confirmPassword) {

        pfNotify('كلمتا المرور غير متطابقتين.');
        return false;

    }

    if (!PF_PENDING.resetTicket) {

        pfNotify('تذكرة الاستعادة غير صالحة. أعد طلب الرمز.');
        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.FORGOT_RESET,

            {

                method: 'POST',
                auth: false,

                body: {

                    ticket: PF_PENDING.resetTicket,
                    password: password

                }

            }

        );

        PF_PENDING.email = '';
        PF_PENDING.password = '';
        PF_PENDING.resetTicket = '';

        PF_VIEW = 'login';

        pfNotify(
            response.message ||
            'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول.'
        );

        return true;

    } catch (error) {

        pfNotify(
            'تعذر تغيير كلمة المرور: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   17 — USERNAME CHANGE
   ============================================================ */

function pfTimeValue(value) {

    if (!value) return 0;

    if (typeof value === 'number') {

        return value < 1000000000000
            ? value * 1000
            : value;

    }

    var parsed = Date.parse(value);

    return Number.isFinite(parsed) ? parsed : 0;

}


function pfUsernameAvailableAt() {

    var user = PF_AUTH.user || {};

    var direct =
        user.username_change_available_at ||
        user.next_username_change_at ||
        user.next_username_change ||
        '';

    if (direct) {
        return pfTimeValue(direct);
    }

    var changed =
        user.username_changed_at ||
        user.username_last_changed_at ||
        '';

    if (changed) {

        return pfTimeValue(changed) +
            PF_RULES.USERNAME_CHANGE_DAYS * 86400000;

    }

    return 0;

}


function pfUsernameWait() {

    return Math.max(
        0,
        pfUsernameAvailableAt() - Date.now()
    );

}


function pfFormatWait(milliseconds) {

    var seconds = Math.ceil(milliseconds / 1000);

    var days = Math.floor(seconds / 86400);

    seconds %= 86400;

    var hours = Math.floor(seconds / 3600);

    seconds %= 3600;

    var minutes = Math.floor(seconds / 60);

    if (days > 0) {
        return days + ' يوم و' + hours + ' ساعة';
    }

    if (hours > 0) {
        return hours + ' ساعة و' + minutes + ' دقيقة';
    }

    return minutes + ' دقيقة';

}


async function pfChangeUsername(username) {

    if (!pfLogged()) {

        pfNotify('يجب تسجيل الدخول أولاً.');
        return false;

    }

    username = String(username || '').trim();

    var usernameError = pfUsernameError(username);

    if (usernameError) {

        pfNotify(usernameError);
        return false;

    }

    var wait = pfUsernameWait();

    if (wait > 0) {

        pfNotify(
            'لا يمكنك تغيير اسم المستخدم الآن. المتبقي: ' +
            pfFormatWait(wait)
        );

        return false;

    }

    pfSetBusy(true);

    try {

        var response = await pfRequest(

            PF_API.USERNAME_CHANGE,

            {

                method: 'POST',

                body: {
                    username: username
                }

            }

        );

        var user =
            response.user ||
            response.player ||
            response.data?.user ||
            response.data?.player ||
            null;

        if (user) {

            PF_AUTH.user = Object.assign(
                {},
                PF_AUTH.user,
                user
            );

        } else {

            PF_AUTH.user.username = username;

            PF_AUTH.user.username_changed_at =
                response.username_changed_at ||
                Math.floor(Date.now() / 1000);

        }

        pfNotify('تم تغيير اسم المستخدم بنجاح.');

        return true;

    } catch (error) {

        pfNotify(
            'تعذر تغيير اسم المستخدم: ' + pfErrorText(error)
        );

        return false;

    } finally {

        pfSetBusy(false);
        pfRenderAccount();

    }

}


/* ============================================================
   18 — RESTORE SESSION
   ============================================================ */

async function pfRestoreSession() {

    if (PF_AUTH.restoring) return false;

    if (!pfToken()) {

        PF_AUTH.ready = true;
        pfRenderAccount();

        return false;

    }

    PF_AUTH.restoring = true;

    try {

        var response = await pfRequest(
            PF_API.ME,
            { method: 'GET' }
        );

        PF_AUTH.user = pfReadUser(response);

        if (!pfUID()) {
            throw new Error('UID غير صالح.');
        }

        PF_AUTH.ready = true;

        await pfLoadRemote();

        return true;

    } catch (error) {

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            pfSetToken('');
            PF_AUTH.user = null;

        }

        console.warn(
            '[OFESTRA] Session restore:',
            pfErrorText(error)
        );

        return false;

    } finally {

        PF_AUTH.restoring = false;

        PF_AUTH.ready = true;

        pfRenderAccount();
        renderProf();

    }

}


/* ============================================================
   19 — LOGOUT
   ============================================================ */

async function pfLogout() {

    pfSetToken('');

    PF_AUTH.user = null;
    PF_AUTH.ready = true;

    PF_VIEW = 'home';

    PF_PENDING.email = '';
    PF_PENDING.password = '';
    PF_PENDING.ticket = '';
    PF_PENDING.resetTicket = '';

    pfRenderAccount();
    renderProf();

    pfNotify('تم تسجيل الخروج.');
    pfSound();

}


/* ============================================================
   20 — REMOTE PROFILE
   ============================================================ */

function pfRemoteURL() {
    return PF_API.PROFILE;
}


function pfParseObject(value) {

    if (!value) return {};

    if (typeof value === 'object') {
        return value;
    }

    if (typeof value === 'string') {

        try {
            return JSON.parse(value);
        } catch (error) {
            return {};
        }

    }

    return {};

}


function pfNumber(value, fallback) {

    var number = Number(value);

    return Number.isFinite(number)
        ? number
        : (fallback || 0);

}


function pfAvatarIndexFromURL(url) {

    url = String(url || '');

    var index = PF_AVATARS.indexOf(url);

    return index >= 0 ? index : 0;

}


async function pfLoadRemote() {

    if (!pfLogged()) return false;

    try {

        var response = await pfRequest(
            pfRemoteURL(),
            { method: 'GET' }
        );

        var remote = pfReadProfile(response);

        pfApplyRemote(remote);

        return true;

    } catch (error) {

        console.warn(
            '[OFESTRA] Profile loading:',
            pfErrorText(error)
        );

        return false;

    }

}


function pfApplyRemote(remote) {

    if (!remote || typeof remote !== 'object') {
        return;
    }

    var settings = pfParseObject(remote.settings);
    var progress = pfParseObject(remote.progress);

    var name =
        remote.display_name ||
        remote.name ||
        settings.display_name;

    if (name) {

        PF.name = String(name).slice(
            0,
            PF_RULES.DISPLAY_NAME_MAX
        );

    }

    var avatar =
        settings.avatar_index !== undefined
            ? Number(settings.avatar_index)
            : pfAvatarIndexFromURL(remote.avatar_url);

    if (
        Number.isInteger(avatar) &&
        avatar >= 0 &&
        avatar < PF_AVATARS.length
    ) {
        PF.av = avatar;
    }

    var bio =
        remote.bio ||
        settings.bio ||
        '';

    if (typeof bio === 'string') {
        PF.info = bio.slice(0, PF_RULES.BIO_MAX);
    }

    if (progress.wins !== undefined) {
        PF.w = pfNumber(progress.wins, PF.w);
    }

    if (progress.losses !== undefined) {
        PF.l = pfNumber(progress.losses, PF.l);
    }

    if (progress.draws !== undefined) {
        PF.d = pfNumber(progress.draws, PF.d);
    }

    if (progress.played !== undefined) {
        PF.played = pfNumber(progress.played, PF.played);
    }

    if (progress.minutes !== undefined) {
        PF.mins = pfNumber(progress.minutes, PF.mins);
    }

    if (remote.username && PF_AUTH.user) {
        PF_AUTH.user.username = remote.username;
    }

    renderProf();

}


/* ============================================================
   21 — REMOTE SAVE
   ============================================================ */

function pfRemoteData() {

    var level = calcLv();

    var played = PF.played || 0;

    return {

        display_name: PF.name || 'Player',

        avatar_url:
            PF_AVATARS[PF.av] ||
            PF_AVATARS[0],

        bio: PF.info || '',

        settings: {

            avatar_index: PF.av,

            avatar_url:
                PF_AVATARS[PF.av] ||
                PF_AVATARS[0]

        },

        progress: {

            level: level.lv,

            wins: PF.w || 0,

            losses: PF.l || 0,

            draws: PF.d || 0,

            played: played,

            minutes: PF.mins || 0,

            win_rate: played
                ? Math.round((PF.w || 0) * 100 / played)
                : 0

        }

    };

}


async function pfSyncRemote() {

    if (!pfLogged()) return false;

    try {

        await pfRequest(

            pfRemoteURL(),

            {

                method: 'PUT',

                body: pfRemoteData()

            }

        );

        return true;

    } catch (error) {

        console.warn(
            '[OFESTRA] Profile synchronization:',
            pfErrorText(error)
        );

        return false;

    }

}


function pfQueueSync() {

    if (!pfLogged()) return;

    if (PF_SYNC_TIMER) {
        clearTimeout(PF_SYNC_TIMER);
    }

    PF_SYNC_TIMER = setTimeout(function () {
        pfSyncRemote();
    }, 900);

}


function pfSave() {

    if (pfLogged()) {
        pfQueueSync();
    } else {
        pfSaveLocal();
    }

}


/* ============================================================
   22 — ACCOUNT STYLES
   ============================================================ */

function pfAccountStyles() {

    if (pfGet('pfAccountStyles')) return;

    var style = document.createElement('style');

    style.id = 'pfAccountStyles';

    style.textContent = `

    .pf-account {
        direction:rtl;
        position:relative;
        box-sizing:border-box;
        width:100%;
        margin:12px 0;
        padding:19px;
        border-radius:23px;
        overflow:hidden;
        background:
            radial-gradient(circle at 100% 0%,rgba(58,111,206,.19),transparent 42%),
            linear-gradient(145deg,#111c30,#080e1b 75%);
        border:1px solid rgba(133,166,220,.16);
        color:#edf3ff;
        font-family:inherit;
        box-shadow:0 18px 55px rgba(0,0,0,.25);
    }

    .pf-account * {
        box-sizing:border-box;
    }

    .pf-account-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:20px;
    }

    .pf-brand {
        display:flex;
        align-items:center;
        gap:11px;
    }

    .pf-brand-mark {
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border-radius:13px;
        background:linear-gradient(145deg,#4e8cf1,#2858a8);
        color:white;
        font-size:17px;
        font-weight:1000;
        letter-spacing:-1px;
    }

    .pf-brand-name {
        font-size:15px;
        font-weight:1000;
        letter-spacing:1.4px;
    }

    .pf-brand-caption {
        margin-top:4px;
        color:#8194b3;
        font-size:9px;
        letter-spacing:1.2px;
    }

    .pf-account-status {
        color:#93a5c1;
        font-size:10px;
        padding:7px 10px;
        border-radius:30px;
        background:rgba(130,150,180,.1);
    }

    .pf-account-status.online {
        color:#65e6ac;
        background:rgba(46,190,130,.12);
    }

    .pf-account-title {
        color:#f4f7ff;
        font-size:20px;
        font-weight:1000;
        margin:0 0 7px;
    }

    .pf-account-subtitle {
        color:#91a2bd;
        font-size:12px;
        line-height:1.9;
        margin-bottom:18px;
    }

    .pf-account-btn {
        min-height:45px;
        border:0;
        border-radius:12px;
        padding:12px 14px;
        font-family:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
        transition:transform .16s,opacity .16s;
    }

    .pf-account-btn:active {
        transform:scale(.98);
    }

    .pf-account-btn:disabled {
        opacity:.5;
        cursor:not-allowed;
    }

    .pf-account-primary {
        color:white;
        background:linear-gradient(120deg,#397bea,#638df0);
        box-shadow:0 7px 18px rgba(53,112,219,.17);
    }

    .pf-account-secondary {
        color:#c6d5ee;
        background:rgba(103,133,180,.1);
        border:1px solid rgba(130,160,205,.16);
    }

    .pf-account-danger {
        color:#ff9ca6;
        background:rgba(220,70,80,.1);
        border:1px solid rgba(220,70,80,.2);
    }

    .pf-account-input {
        display:block;
        width:100%;
        min-height:47px;
        margin-top:7px;
        padding:12px 13px;
        border-radius:12px;
        border:1px solid rgba(132,160,205,.18);
        outline:none;
        background:rgba(3,8,18,.56);
        color:#f4f7ff;
        font-family:inherit;
        font-size:13px;
    }

    .pf-account-input::placeholder {
        color:#60738f;
    }

    .pf-account-input:focus {
        border-color:#6394ef;
        box-shadow:0 0 0 3px rgba(80,135,225,.12);
    }

    .pf-account-input.invalid {
        border-color:#e46b78;
    }

    .pf-field {
        margin-top:14px;
    }

    .pf-field-label {
        display:block;
        color:#aabbd4;
        font-size:11px;
        font-weight:800;
        margin-bottom:7px;
    }

    .pf-input-wrap {
        position:relative;
    }

    .pf-input-wrap .pf-account-input {
        direction:ltr;
        text-align:left;
    }

    .pf-input-wrap.password .pf-account-input {
        padding-left:58px;
    }

    .pf-toggle-password {
        position:absolute;
        left:7px;
        top:50%;
        transform:translateY(-50%);
        width:43px;
        height:36px;
        display:grid;
        place-items:center;
        border:0;
        border-radius:9px;
        background:rgba(100,135,190,.13);
        color:#dce8ff;
        cursor:pointer;
    }

    .pf-toggle-password svg {
        width:20px;
        height:20px;
        stroke:currentColor;
        fill:none;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
    }

    .pf-field-error {
        min-height:15px;
        color:#ff8490;
        font-size:10px;
        line-height:1.7;
        margin-top:5px;
    }

    .pf-account-hint {
        margin-top:15px;
        color:#8396b4;
        font-size:11px;
        line-height:1.9;
    }

    .pf-account-actions {
        display:flex;
        gap:9px;
        margin-top:17px;
    }

    .pf-account-actions > * {
        flex:1;
    }

    .pf-account-divider {
        height:1px;
        background:rgba(130,155,195,.13);
        margin:20px 0;
    }

    .pf-back-button {
        display:flex;
        align-items:center;
        gap:8px;
        padding:9px 11px;
        margin:0 0 17px;
        border:1px solid rgba(130,160,205,.14);
        border-radius:11px;
        background:rgba(100,130,180,.07);
        color:#a9c4ed;
        font-family:inherit;
        font-size:11px;
        cursor:pointer;
    }

    .pf-back-arrow {
        font-size:19px;
        line-height:1;
    }

    .pf-step {
        color:#6f9fe9;
        font-size:10px;
        font-weight:900;
        letter-spacing:1.2px;
        margin-bottom:9px;
    }

    .pf-account-note {
        margin-top:13px;
        padding:11px 12px;
        border-radius:11px;
        background:rgba(89,132,201,.09);
        color:#9eb4d5;
        font-size:10px;
        line-height:1.8;
    }

    .pf-account-profile-top {
        display:flex;
        align-items:center;
        gap:14px;
        margin-bottom:18px;
    }

    .pf-profile-avatar {
        width:76px;
        height:76px;
        flex-shrink:0;
        overflow:hidden;
        border-radius:21px;
        border:2px solid rgba(128,167,230,.42);
        background:#17243b;
    }

    .pf-profile-avatar img {
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
    }

    .pf-profile-name {
        font-size:17px;
        font-weight:1000;
        overflow-wrap:anywhere;
    }

    .pf-profile-username {
        margin-top:5px;
        color:#91a8ca;
        font-size:11px;
        direction:ltr;
        text-align:right;
    }

    .pf-profile-uid {
        margin-top:7px;
        color:#7085a5;
        font-size:9px;
        direction:ltr;
        text-align:right;
        overflow-wrap:anywhere;
    }

    .pf-stats-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:9px;
        margin:17px 0;
    }

    .pf-stat {
        padding:13px;
        border:1px solid rgba(125,155,205,.13);
        border-radius:13px;
        background:rgba(100,130,180,.07);
    }

    .pf-stat b {
        display:block;
        color:#f1f5ff;
        font-size:19px;
        font-weight:1000;
    }

    .pf-stat span {
        display:block;
        margin-top:5px;
        color:#879bb9;
        font-size:10px;
    }

    .pf-level-box {
        padding:14px;
        border-radius:14px;
        background:linear-gradient(110deg,rgba(57,123,234,.16),rgba(60,80,130,.08));
        border:1px solid rgba(110,150,220,.15);
    }

    .pf-level-top {
        display:flex;
        justify-content:space-between;
        gap:10px;
        color:#dce8ff;
        font-size:11px;
        font-weight:900;
    }

    .pf-level-track {
        height:7px;
        margin-top:12px;
        border-radius:20px;
        overflow:hidden;
        background:rgba(4,10,22,.65);
    }

    .pf-level-track i {
        display:block;
        height:100%;
        border-radius:20px;
        background:linear-gradient(90deg,#4285ec,#8bb5ff);
    }

    .pf-avatar-grid {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin-top:12px;
    }

    .pf-avatar-choice {
        position:relative;
        overflow:hidden;
        aspect-ratio:1;
        padding:0;
        border-radius:14px;
        border:2px solid transparent;
        background:#17243b;
        cursor:pointer;
    }

    .pf-avatar-choice img {
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
    }

    .pf-avatar-choice.selected {
        border-color:#6fa1ff;
        box-shadow:0 0 0 2px rgba(90,145,240,.18);
    }

    .pf-account-textarea {
        min-height:82px;
        resize:vertical;
        direction:rtl !important;
        text-align:right !important;
    }

    .pf-account-section-title {
        color:#e8efff;
        font-size:13px;
        font-weight:1000;
        margin-bottom:6px;
    }

    .pf-account-section-caption {
        color:#8396b4;
        font-size:10px;
        line-height:1.8;
        margin-bottom:12px;
    }

    .pf-busy-indicator {
        display:none;
        color:#8db4fa;
        font-size:10px;
        margin-top:10px;
    }

    .pf-account.is-busy .pf-busy-indicator {
        display:block;
    }

    .pf-account.is-busy {
        opacity:.88;
    }

    .pf-account-footer {
        margin-top:18px;
        padding-top:13px;
        border-top:1px solid rgba(130,155,195,.1);
        color:#647b9e;
        text-align:center;
        font-size:9px;
        letter-spacing:.8px;
    }

    #prof.pf-auth-locked > :not(#pfAccountPanel):not(#xP):not(#bkP) {
        display:none !important;
    }

    #prof.pf-auth-locked #pfCard,
    #prof.pf-auth-locked #pfStats,
    #prof.pf-auth-locked #avGrid,
    #prof.pf-auth-locked #pfName,
    #prof.pf-auth-locked #nameChangeNotice,
    #prof.pf-auth-locked #pfReset {
        display:none !important;
    }

    @media(max-width:360px) {
        .pf-account {
            padding:14px;
        }

        .pf-avatar-grid {
            gap:7px;
        }
    }

    `;

    document.head.appendChild(style);

}


/* ============================================================
   23 — NAVIGATION GUARD
   ============================================================ */

/*
   يمنع النقر على خلفية البروفايل من إغلاقه.
   زر الإغلاق والسهم فقط يغلقان النافذة.
*/

function pfInstallNavigationGuard(root) {

    if (!root || root.dataset.pfNavGuard === '1') {
        return;
    }

    root.dataset.pfNavGuard = '1';

    /*
       إزالة إغلاق الخلفية إذا كان موجوداً في HTML.
    */

    root.removeAttribute('onclick');
    root.onclick = null;

    root.addEventListener(

        'click',

        function (event) {

            var target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            if (target.closest('#pfAccountPanel')) {
                return;
            }

            if (target.closest('#xP, #bkP')) {
                return;
            }

            var interactive = target.closest(
                'button,input,textarea,select,a,[role="button"]'
            );

            if (interactive) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

        },

        true

    );

}


/* ============================================================
   24 — ACCOUNT PANEL CREATION
   ============================================================ */

function pfEnsureAccount() {

    pfAccountStyles();

    var root = pfGet('prof');

    if (!root) return null;

    pfInstallNavigationGuard(root);

    var panel = pfGet('pfAccountPanel');

    if (panel) return panel;

    panel = document.createElement('section');

    panel.id = 'pfAccountPanel';
    panel.className = 'pf-account';

    root.insertBefore(panel, root.firstChild);

    panel.addEventListener('submit', function (event) {

        var form = event.target.closest('[data-pf-form]');

        if (!form) return;

        event.preventDefault();
        event.stopPropagation();

        pfSubmitForm(
            form.getAttribute('data-pf-form'),
            form
        );

    });

    panel.addEventListener('click', function (event) {

        /*
           يمنع وصول النقر إلى خلفية البروفايل.
        */

        event.stopPropagation();

        var toggle = event.target.closest('[data-pf-toggle]');

        if (toggle) {
            pfTogglePassword(toggle);
            return;
        }

        var avatar = event.target.closest('[data-pf-avatar]');

        if (avatar) {

            pfSelectAvatar(
                Number(avatar.getAttribute('data-pf-avatar'))
            );

            return;

        }

        var button = event.target.closest('[data-pf-action]');

        if (!button) return;

        pfAccountAction(
            button.getAttribute('data-pf-action')
        );

    });

    panel.addEventListener('input', function (event) {

        var input = event.target;

        if (!input || !input.dataset.pfRule) return;

        pfLiveValidate(input);

    });

    return panel;

}


/* ============================================================
   25 — HTML BUILDERS
   ============================================================ */

function pfBackButton() {

    return `

        <button
            class="pf-back-button"
            type="button"
            data-pf-action="close-profile"
            aria-label="العودة إلى اللعبة"
        >

            <span class="pf-back-arrow">↖</span>
            <span>العودة إلى اللعبة</span>

        </button>

    `;

}


function pfHeader(status) {

    return `

        <div class="pf-account-head">

            <div class="pf-brand">

                <div class="pf-brand-mark">O</div>

                <div>

                    <div class="pf-brand-name">OFESTRA</div>

                    <div class="pf-brand-caption">
                        PLAYER IDENTITY SYSTEM
                    </div>

                </div>

            </div>

            <span class="pf-account-status ${status === 'online' ? 'online' : ''}">

                ${status === 'online' ? '● ACCOUNT' : 'SECURE ACCESS'}

            </span>

        </div>

    `;

}


function pfField(
    id,
    label,
    placeholder,
    type,
    rule,
    autocomplete
) {

    return `

        <div class="pf-field">

            <label
                class="pf-field-label"
                for="${id}"
            >
                ${pfEscape(label)}
            </label>

            <input

                class="pf-account-input"

                id="${id}"

                name="${id}"

                type="${type || 'text'}"

                placeholder="${pfEscape(placeholder || '')}"

                autocomplete="${pfEscape(autocomplete || 'off')}"

                data-pf-rule="${pfEscape(rule || '')}"

                required

            >

            <div
                class="pf-field-error"
                data-pf-error="${id}"
            ></div>

        </div>

    `;

}


function pfEyeIcon(open) {

    if (open) {

        return `

            <svg viewBox="0 0 24 24" aria-hidden="true">

                <path d="M3 3l18 18"></path>
                <path d="M10.6 10.6a2 2 0 002.8 2.8"></path>
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.3 2.4-2.7 3.5"></path>
                <path d="M6.2 6.2C4.3 7.4 3 9.3 2.5 12c.7 2 3.7 7 9.5 7 1 0 2-.2 2.9-.5"></path>

            </svg>

        `;

    }

    return `

        <svg viewBox="0 0 24 24" aria-hidden="true">

            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"></path>
            <circle cx="12" cy="12" r="3"></circle>

        </svg>

    `;

}


function pfPasswordField(
    id,
    label,
    placeholder,
    autocomplete
) {

    return `

        <div class="pf-field">

            <label
                class="pf-field-label"
                for="${id}"
            >
                ${pfEscape(label)}
            </label>

            <div class="pf-input-wrap password">

                <input

                    class="pf-account-input"

                    id="${id}"

                    name="${id}"

                    type="password"

                    maxlength="${PF_RULES.PASSWORD_MAX}"

                    placeholder="${pfEscape(placeholder || 'كلمة المرور')}"

                    autocomplete="${pfEscape(autocomplete || 'new-password')}"

                    data-pf-rule="password"

                    required

                >

                <button

                    type="button"

                    class="pf-toggle-password"

                    data-pf-toggle="${id}"

                    aria-label="إظهار كلمة المرور"

                >

                    ${pfEyeIcon(false)}

                </button>

            </div>

            <div
                class="pf-field-error"
                data-pf-error="${id}"
            ></div>

        </div>

    `;

}


function pfCodeField(id) {

    return `

        <div class="pf-field">

            <label
                class="pf-field-label"
                for="${id}"
            >
                رمز التحقق
            </label>

            <input

                class="pf-account-input"

                id="${id}"

                type="text"

                inputmode="numeric"

                maxlength="6"

                minlength="6"

                placeholder="000000"

                autocomplete="one-time-code"

                data-pf-rule="code"

                required

                style="direction:ltr;text-align:center;font-size:21px;letter-spacing:7px;font-weight:900;"

            >

            <div
                class="pf-field-error"
                data-pf-error="${id}"
            ></div>

        </div>

    `;

}


function pfFormButton(text) {

    return `

        <button

            class="pf-account-btn pf-account-primary"

            type="submit"

            style="width:100%;margin-top:18px;"

        >

            ${pfEscape(text)}

        </button>

    `;

}


/* ============================================================
   26 — LOGIN SCREEN
   ============================================================ */

function pfRenderLogin() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">ACCOUNT ACCESS / 01</div>

        <div class="pf-account-title">
            تسجيل الدخول
        </div>

        <div class="pf-account-subtitle">
            أدخل بيانات حسابك للعودة إلى ملفك الشخصي وتقدمك في OFESTRA.
        </div>

        <form data-pf-form="login">

            ${pfField(
                'pfLoginIdentifier',
                'البريد الإلكتروني أو اسم المستخدم',
                'Email / Username',
                'text',
                'identifier',
                'username'
            )}

            ${pfPasswordField(
                'pfLoginPassword',
                'كلمة المرور',
                'أدخل كلمة المرور',
                'current-password'
            )}

            <button

                type="button"

                class="pf-back-button"

                data-pf-action="forgot"

                style="margin-top:13px;"

            >
                نسيت كلمة المرور؟
            </button>

            ${pfFormButton('متابعة')}

        </form>

        <div class="pf-account-hint">
            حسابك وبيانات تقدمك تتم إدارتها من خلال خادم OFESTRA.
        </div>

        <div class="pf-busy-indicator">
            جارٍ التحقق من الحساب...
        </div>

        <div class="pf-account-footer">
            OFESTRA ENGINE · SECURE ACCOUNT
        </div>

    `;

}


/* ============================================================
   27 — HOME SCREEN
   ============================================================ */

function pfRenderHome() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div style="padding:15px 2px 8px;">

            <div class="pf-step">
                PLAYER IDENTITY SYSTEM
            </div>

            <div class="pf-account-title">
                أهلاً بك في OFESTRA
            </div>

            <div class="pf-account-subtitle">
                سجّل دخولك للوصول إلى ملفك الشخصي، أو أنشئ حساباً جديداً لحفظ تقدمك وبياناتك.
            </div>

        </div>

        <div style="display:grid;gap:10px;">

            <button
                class="pf-account-btn pf-account-primary"
                type="button"
                data-pf-action="login-screen"
                style="width:100%;"
            >
                تسجيل الدخول
            </button>

            <button
                class="pf-account-btn pf-account-secondary"
                type="button"
                data-pf-action="register-screen"
                style="width:100%;"
            >
                إنشاء حساب جديد
            </button>

            <button
                class="pf-account-btn pf-account-secondary"
                type="button"
                data-pf-action="forgot"
                style="width:100%;"
            >
                نسيت كلمة المرور؟
            </button>

        </div>

        <div class="pf-account-hint">
            يمكنك الاستمرار باللعب كضيف بعد إغلاق هذه النافذة. اللعب عبر الإنترنت يتطلب تسجيل الدخول.
        </div>

        <div class="pf-account-footer">
            OFESTRA ENGINE · PLAYER SERVICES
        </div>

    `;

}


/* ============================================================
   28 — REGISTRATION SCREEN
   ============================================================ */

function pfRenderRegister() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            CREATE ACCOUNT / 01
        </div>

        <div class="pf-account-title">
            إنشاء حساب جديد
        </div>

        <div class="pf-account-subtitle">
            أدخل بريدك الإلكتروني وأنشئ كلمة مرور لحسابك.
        </div>

        <form data-pf-form="register-request">

            ${pfField(
                'pfRegisterEmail',
                'البريد الإلكتروني',
                'name@example.com',
                'email',
                'email',
                'email'
            )}

            ${pfPasswordField(
                'pfRegisterPassword',
                'كلمة المرور',
                '8 إلى 20 خانة',
                'new-password'
            )}

            <div class="pf-account-note">
                كلمة المرور تقبل الحروف الإنجليزية الكبيرة والصغيرة والأرقام والرموز المسموح بها. الحد الأدنى 8 خانات والحد الأقصى 20 خانة.
            </div>

            ${pfFormButton('متابعة وإرسال رمز التحقق')}

        </form>

        <div class="pf-busy-indicator">
            جارٍ إرسال رمز التحقق...
        </div>

        <div class="pf-account-footer">
            OFESTRA · EMAIL VERIFICATION
        </div>

    `;

}


/* ============================================================
   29 — REGISTRATION CODE
   ============================================================ */

function pfRenderRegisterCode() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            CREATE ACCOUNT / 02
        </div>

        <div class="pf-account-title">
            تأكيد البريد الإلكتروني
        </div>

        <div class="pf-account-subtitle">

            أرسلنا رمز تحقق إلى:

            <b style="color:#dce8ff;direction:ltr;display:inline-block;">
                ${pfEscape(PF_PENDING.email)}
            </b>

        </div>

        <form data-pf-form="register-verify">

            ${pfCodeField('pfRegisterCode')}

            ${pfFormButton('متابعة')}

        </form>

        <div class="pf-account-actions">

            <button
                class="pf-account-btn pf-account-secondary"
                type="button"
                data-pf-action="resend-register"
            >
                إعادة إرسال الرمز
            </button>

        </div>

        <div class="pf-account-hint">
            رمز التحقق صالح لمدة محدودة. لا تشارك الرمز مع أي شخص.
        </div>

        <div class="pf-busy-indicator">
            جارٍ التحقق من الرمز...
        </div>

    `;

}


/* ============================================================
   30 — REGISTRATION USERNAME
   ============================================================ */

function pfRenderRegisterUsername() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            CREATE ACCOUNT / 03
        </div>

        <div class="pf-account-title">
            اختر هويتك داخل اللعبة
        </div>

        <div class="pf-account-subtitle">
            تم تأكيد بريدك الإلكتروني. اختر اسم المستخدم واسم العرض.
        </div>

        <form data-pf-form="register-complete">

            ${pfField(
                'pfNewUsername',
                'اسم المستخدم',
                'Player123',
                'text',
                'username',
                'off'
            )}

            <div class="pf-account-note">
                من 4 إلى 10 خانات، حروف إنجليزية وأرقام فقط. الأسماء المكوّنة من 3 خانات محجوزة للإدارة.
            </div>

            ${pfField(
                'pfNewDisplayName',
                'اسم العرض',
                'الاسم الذي يظهر للاعبين',
                'text',
                'display',
                'nickname'
            )}

            ${pfFormButton('إنشاء حساب OFESTRA')}

        </form>

        <div class="pf-busy-indicator">
            جارٍ إنشاء الحساب...
        </div>

    `;

}


/* ============================================================
   31 — FORGOT PASSWORD SCREENS
   ============================================================ */

function pfRenderForgotEmail() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            ACCOUNT RECOVERY / 01
        </div>

        <div class="pf-account-title">
            استعادة كلمة المرور
        </div>

        <div class="pf-account-subtitle">
            أدخل البريد الإلكتروني المرتبط بحسابك حتى نرسل رمز الاستعادة.
        </div>

        <form data-pf-form="forgot-request">

            ${pfField(
                'pfForgotEmail',
                'البريد الإلكتروني',
                'name@example.com',
                'email',
                'email',
                'email'
            )}

            ${pfFormButton('إرسال رمز الاستعادة')}

        </form>

        <div class="pf-account-hint">
            لأسباب أمنية، لن نكشف ما إذا كان البريد مسجلاً أم لا.
        </div>

    `;

}


function pfRenderForgotCode() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            ACCOUNT RECOVERY / 02
        </div>

        <div class="pf-account-title">
            أدخل رمز الاستعادة
        </div>

        <div class="pf-account-subtitle">
            تحقق من بريدك الإلكتروني وأدخل الرمز المكوّن من 6 أرقام.
        </div>

        <form data-pf-form="forgot-verify">

            ${pfCodeField('pfForgotCode')}

            ${pfFormButton('متابعة')}

        </form>

    `;

}


function pfRenderForgotPassword() {

    return `

        ${pfHeader()}

        ${pfBackButton()}

        <div class="pf-step">
            ACCOUNT RECOVERY / 03
        </div>

        <div class="pf-account-title">
            تعيين كلمة مرور جديدة
        </div>

        <div class="pf-account-subtitle">
            أدخل كلمة المرور الجديدة مرتين للتأكد من صحتها.
        </div>

        <form data-pf-form="forgot-reset">

            ${pfPasswordField(
                'pfNewPassword',
                'كلمة المرور الجديدة',
                '8 إلى 20 خانة',
                'new-password'
            )}

            ${pfPasswordField(
                'pfConfirmNewPassword',
                'تأكيد كلمة المرور',
                'أعد كتابة كلمة المرور',
                'new-password'
            )}

            <div
                class="pf-field-error"
                id="pfPasswordMatchError"
            ></div>

            ${pfFormButton('حفظ كلمة المرور الجديدة')}

        </form>

    `;

}


/* ============================================================
   32 — LOGGED PROFILE
   ============================================================ */

function pfRenderLogged() {

    var user = PF_AUTH.user || {};

    var level = calcLv();

    var played = PF.played || 0;

    var winRate = played
        ? Math.round((PF.w || 0) * 100 / played)
        : 0;

    var username = user.username || 'Player';

    var email = user.email || 'غير متوفر';

    var uid = pfUID();

    var avatarIndex =
        Number.isInteger(PF.av) && PF.av >= 0
            ? PF.av % PF_AVATARS.length
            : 0;

    var wait = pfUsernameWait();

    var canChange = wait <= 0;

    var avatarGrid = PF_AVATARS.map(function (url, index) {

        return `

            <button

                class="pf-avatar-choice ${
                    index === avatarIndex ? 'selected' : ''
                }"

                type="button"

                data-pf-avatar="${index}"

                aria-label="اختيار الصورة ${index + 1}"

            >

                <img
                    src="${url}"
                    alt="صورة اللاعب ${index + 1}"
                    loading="lazy"
                >

            </button>

        `;

    }).join('');

    return `

        ${pfHeader('online')}

        ${pfBackButton()}

        <div class="pf-account-profile-top">

            <div class="pf-profile-avatar">

                <img
                    src="${PF_AVATARS[avatarIndex]}"
                    alt="صورة اللاعب"
                >

            </div>

            <div style="min-width:0;">

                <div class="pf-profile-name">
                    ${pfEscape(PF.name || username)}
                </div>

                <div class="pf-profile-username">
                    @${pfEscape(username)}
                </div>

                <div class="pf-profile-uid">
                    UID: ${pfEscape(uid)}
                </div>

            </div>

        </div>

        <div class="pf-level-box">

            <div class="pf-level-top">

                <span>${pfEscape(titleOf(level.lv))}</span>

                <span>LEVEL ${level.lv}</span>

            </div>

            <div class="pf-level-track">
                <i style="width:${level.pct}%"></i>
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:8px;color:#8198bb;font-size:9px;">

                <span>${level.points} نقطة</span>

                <span>${level.pct}% إلى المستوى التالي</span>

            </div>

        </div>

        <div class="pf-stats-grid">

            <div class="pf-stat">
                <b>${played}</b>
                <span>إجمالي المباريات</span>
            </div>

            <div class="pf-stat">
                <b>${PF.w || 0}</b>
                <span>الانتصارات</span>
            </div>

            <div class="pf-stat">
                <b>${PF.l || 0}</b>
                <span>الخسارات</span>
            </div>

            <div class="pf-stat">
                <b>${PF.d || 0}</b>
                <span>التعادلات</span>
            </div>

            <div class="pf-stat">
                <b>${winRate}%</b>
                <span>نسبة الفوز</span>
            </div>

            <div class="pf-stat">
                <b>${PF.mins || 0}</b>
                <span>دقائق اللعب</span>
            </div>

        </div>

        <div class="pf-account-divider"></div>

        <div class="pf-account-section-title">
            صورة الملف الشخصي
        </div>

        <div class="pf-account-section-caption">
            اختر صورة من مجموعة الصور المتاحة.
        </div>

        <div class="pf-avatar-grid">
            ${avatarGrid}
        </div>

        <div class="pf-account-divider"></div>

        <div class="pf-account-section-title">
            بيانات الحساب
        </div>

        <div class="pf-field">

            <label class="pf-field-label">
                البريد الإلكتروني
            </label>

            <input
                class="pf-account-input"
                value="${pfEscape(email)}"
                readonly
                style="direction:ltr;text-align:left;opacity:.75;"
            >

        </div>

        <form data-pf-form="profile-save">

            <div class="pf-field">

                <label
                    class="pf-field-label"
                    for="pfCloudDisplayName"
                >
                    اسم العرض
                </label>

                <input

                    class="pf-account-input"

                    id="pfCloudDisplayName"

                    maxlength="${PF_RULES.DISPLAY_NAME_MAX}"

                    value="${pfEscape(PF.name || '')}"

                    data-pf-rule="display"

                    required

                >

                <div
                    class="pf-field-error"
                    data-pf-error="pfCloudDisplayName"
                ></div>

            </div>

            <div class="pf-field">

                <label
                    class="pf-field-label"
                    for="pfCloudBio"
                >
                    نبذة اللاعب
                </label>

                <textarea

                    class="pf-account-input pf-account-textarea"

                    id="pfCloudBio"

                    maxlength="${PF_RULES.BIO_MAX}"

                    placeholder="اكتب نبذة مختصرة عنك..."

                >${pfEscape(PF.info || '')}</textarea>

            </div>

            <button

                class="pf-account-btn pf-account-primary"

                type="submit"

                style="width:100%;margin-top:14px;"

            >
                حفظ بيانات الملف الشخصي
            </button>

        </form>

        <div class="pf-account-divider"></div>

        <div class="pf-account-section-title">
            تغيير اسم المستخدم
        </div>

        <div class="pf-account-section-caption">
            يمكن تغيير اسم المستخدم مرة واحدة كل 7 أيام. يجب أن يكون من 4 إلى 10 خانات باللغة الإنجليزية والأرقام فقط.
        </div>

        <form data-pf-form="username-change">

            <div class="pf-field">

                <label
                    class="pf-field-label"
                    for="pfNewUsernameChange"
                >
                    اسم المستخدم الجديد
                </label>

                <input

                    class="pf-account-input"

                    id="pfNewUsernameChange"

                    maxlength="${PF_RULES.USERNAME_MAX}"

                    placeholder="NewUsername"

                    autocomplete="off"

                    data-pf-rule="username"

                    ${canChange ? '' : 'disabled'}

                >

                <div
                    class="pf-field-error"
                    data-pf-error="pfNewUsernameChange"
                >
                    ${
                        canChange
                            ? ''
                            : 'يمكنك تغييره بعد ' + pfEscape(pfFormatWait(wait))
                    }
                </div>

            </div>

            <button

                class="pf-account-btn pf-account-secondary"

                type="submit"

                style="width:100%;margin-top:10px;"

                ${canChange ? '' : 'disabled'}

            >

                ${
                    canChange
                        ? 'تغيير اسم المستخدم'
                        : 'تغيير الاسم غير متاح حالياً'
                }

            </button>

        </form>

        <div class="pf-account-divider"></div>

        <div class="pf-account-actions">

            <button
                class="pf-account-btn pf-account-secondary"
                type="button"
                data-pf-action="sync"
            >
                مزامنة البيانات
            </button>

            <button
                class="pf-account-btn pf-account-danger"
                type="button"
                data-pf-action="logout"
            >
                تسجيل الخروج
            </button>

        </div>

        <div class="pf-account-hint">
            تقدمك وإحصائيات حسابك تتم مزامنتها مع خادم OFESTRA.
        </div>

        <div class="pf-busy-indicator">
            جارٍ تنفيذ العملية...
        </div>

        <div class="pf-account-footer">
            OFESTRA ENGINE · PLAYER PROFILE
        </div>

    `;

}


/* ============================================================
   33 — RENDER ACCOUNT
   ============================================================ */

function pfRenderAccount() {

    var panel = pfEnsureAccount();

    if (!panel) return;

    var root = pfGet('prof');

    if (root) {

        root.classList.toggle(
            'pf-auth-locked',
            !pfLogged()
        );

    }

    if (pfLogged()) {

        panel.innerHTML = pfRenderLogged();

        if (PF_AUTH.busy) {
            panel.classList.add('is-busy');
        }

        return;

    }

    switch (PF_VIEW) {

        case 'login':
            panel.innerHTML = pfRenderLogin();
            break;

        case 'register':
            panel.innerHTML = pfRenderRegister();
            break;

        case 'register-code':
            panel.innerHTML = pfRenderRegisterCode();
            break;

        case 'register-username':
            panel.innerHTML = pfRenderRegisterUsername();
            break;

        case 'forgot-email':
            panel.innerHTML = pfRenderForgotEmail();
            break;

        case 'forgot-code':
            panel.innerHTML = pfRenderForgotCode();
            break;

        case 'forgot-password':
            panel.innerHTML = pfRenderForgotPassword();
            break;

        default:
            PF_VIEW = 'home';
            panel.innerHTML = pfRenderHome();
            break;

    }

    panel.classList.toggle('is-busy', PF_AUTH.busy);

}


/* ============================================================
   34 — PASSWORD VISIBILITY
   ============================================================ */

function pfTogglePassword(button) {

    var id = button.getAttribute('data-pf-toggle');

    var input = pfGet(id);

    if (!input) return;

    if (input.type === 'password') {

        input.type = 'text';

        button.innerHTML = pfEyeIcon(true);

        button.setAttribute(
            'aria-label',
            'إخفاء كلمة المرور'
        );

    } else {

        input.type = 'password';

        button.innerHTML = pfEyeIcon(false);

        button.setAttribute(
            'aria-label',
            'إظهار كلمة المرور'
        );

    }

}


/* ============================================================
   35 — VALIDATION
   ============================================================ */

function pfValidateRule(rule, value) {

    value = String(value || '');

    if (rule === 'email') {

        return pfEmailValid(value)
            ? ''
            : 'أدخل بريداً إلكترونياً صحيحاً.';

    }

    if (rule === 'username') {
        return pfUsernameError(value);
    }

    if (rule === 'password') {
        return pfPasswordError(value);
    }

    if (rule === 'display') {
        return pfDisplayNameError(value);
    }

    if (rule === 'code') {

        return /^\d{6}$/.test(value)
            ? ''
            : 'يجب إدخال 6 أرقام.';

    }

    if (rule === 'identifier') {

        return value.trim()
            ? ''
            : 'أدخل البريد أو اسم المستخدم.';

    }

    return '';

}


function pfLiveValidate(input) {

    var rule = input.dataset.pfRule;

    var error = pfValidateRule(
        rule,
        input.value
    );

    input.classList.toggle('invalid', !!error);

    var errorBox = document.querySelector(
        '[data-pf-error="' + input.id + '"]'
    );

    if (errorBox) {
        errorBox.textContent = error;
    }

    if (
        input.id === 'pfNewPassword' ||
        input.id === 'pfConfirmNewPassword'
    ) {
        pfCheckPasswordMatch();
    }

    return !error;

}


function pfCheckPasswordMatch() {

    var password = pfGet('pfNewPassword');

    var confirm = pfGet('pfConfirmNewPassword');

    var errorBox = pfGet('pfPasswordMatchError');

    if (!password || !confirm || !errorBox) {
        return true;
    }

    if (!confirm.value) {

        errorBox.textContent = '';
        return false;

    }

    var matches = password.value === confirm.value;

    errorBox.textContent = matches
        ? ''
        : 'كلمتا المرور غير متطابقتين.';

    confirm.classList.toggle('invalid', !matches);

    return matches;

}


function pfFormValid(form) {

    var valid = true;

    form.querySelectorAll('[data-pf-rule]').forEach(function (input) {

        if (!pfLiveValidate(input)) {
            valid = false;
        }

    });

    return valid;

}


/* ============================================================
   36 — FORM SUBMISSION
   ============================================================ */

async function pfSubmitForm(action, form) {

    if (PF_AUTH.busy) return;

    if (action === 'login') {

        if (!pfFormValid(form)) return;

        await pfLogin(
            pfGet('pfLoginIdentifier')?.value,
            pfGet('pfLoginPassword')?.value
        );

        return;

    }

    if (action === 'register-request') {

        if (!pfFormValid(form)) return;

        await pfRegisterRequest(
            pfGet('pfRegisterEmail')?.value,
            pfGet('pfRegisterPassword')?.value
        );

        return;

    }

    if (action === 'register-verify') {

        if (!pfFormValid(form)) return;

        await pfVerifyRegistration(
            pfGet('pfRegisterCode')?.value
        );

        return;

    }

    if (action === 'register-complete') {

        if (!pfFormValid(form)) return;

        await pfCompleteRegistration(
            pfGet('pfNewUsername')?.value,
            pfGet('pfNewDisplayName')?.value
        );

        return;

    }

    if (action === 'forgot-request') {

        if (!pfFormValid(form)) return;

        await pfForgotRequest(
            pfGet('pfForgotEmail')?.value
        );

        return;

    }

    if (action === 'forgot-verify') {

        if (!pfFormValid(form)) return;

        await pfForgotVerify(
            pfGet('pfForgotCode')?.value
        );

        return;

    }

    if (action === 'forgot-reset') {

        if (!pfFormValid(form)) return;

        if (!pfCheckPasswordMatch()) {

            pfNotify('كلمتا المرور غير متطابقتين.');
            return;

        }

        await pfForgotReset(
            pfGet('pfNewPassword')?.value,
            pfGet('pfConfirmNewPassword')?.value
        );

        return;

    }

    if (action === 'profile-save') {

        await pfSaveAccount();
        return;

    }

    if (action === 'username-change') {

        await pfChangeUsername(
            pfGet('pfNewUsernameChange')?.value
        );

    }

}


/* ============================================================
   37 — ACCOUNT ACTIONS
   ============================================================ */

async function pfAccountAction(action) {

    if (action === 'close-profile') {

        closeProf();
        return;

    }

    if (action === 'login-screen') {

        PF_VIEW = 'login';
        pfRenderAccount();
        return;

    }

    if (action === 'register-screen') {

        PF_VIEW = 'register';
        pfRenderAccount();
        return;

    }

    if (action === 'forgot') {

        PF_VIEW = 'forgot-email';
        pfRenderAccount();
        return;

    }

    if (action === 'back-home') {

        PF_VIEW = 'home';

        PF_PENDING.password = '';
        PF_PENDING.ticket = '';
        PF_PENDING.resetTicket = '';

        pfRenderAccount();
        return;

    }

    if (action === 'resend-register') {

        await pfRegisterRequest(
            PF_PENDING.email,
            PF_PENDING.password
        );

        return;

    }

    if (action === 'logout') {

        await pfLogout();
        return;

    }

    if (action === 'sync') {

        var result = await pfSyncRemote();

        pfNotify(
            result
                ? 'تمت مزامنة الملف الشخصي بنجاح.'
                : 'تعذرت المزامنة. تحقق من اتصال السيرفر.'
        );

        return;

    }

}


/* ============================================================
   38 — AVATAR SELECTION
   ============================================================ */

function pfSelectAvatar(index) {

    if (!pfLogged()) return;

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= PF_AVATARS.length
    ) {
        return;
    }

    PF.av = index;

    pfSave();

    pfRenderAccount();

    decorProf();

    pfSound();

    pfPublish();

}


/* ============================================================
   39 — SAVE ACCOUNT PROFILE
   ============================================================ */

async function pfSaveAccount() {

    if (!pfLogged()) {

        pfNotify('يجب تسجيل الدخول أولاً.');
        return false;

    }

    var nameInput = pfGet('pfCloudDisplayName');

    var infoInput = pfGet('pfCloudBio');

    var name = nameInput
        ? nameInput.value.trim()
        : PF.name;

    var info = infoInput
        ? infoInput.value.trim()
        : (PF.info || '');

    var nameError = pfDisplayNameError(name);

    if (nameError) {

        pfNotify(nameError);
        return false;

    }

    if (info.length > PF_RULES.BIO_MAX) {

        pfNotify('النبذة تتجاوز الحد الأقصى.');
        return false;

    }

    PF.name = name;
    PF.info = info;

    var synced = await pfSyncRemote();

    if (synced) {

        pfNotify('تم حفظ بيانات الملف الشخصي على السيرفر.');

    } else {

        pfNotify('تعذر حفظ التغييرات على السيرفر.');

    }

    renderProf();

    pfPublish();

    return synced;

}


/* ============================================================
   40 — LEVEL CALCULATOR
   ============================================================ */

function calcLv(P) {

    P = P || PF;

    var played = P.played || 0;

    var rate = played
        ? (P.w || 0) / played
        : 0;

    var points =

        (P.w || 0) * 30 +

        (P.d || 0) * 12 +

        (P.l || 0) * 8 +

        Math.floor((P.mins || 0) / 2) +

        Math.round(
            rate * Math.min(played, 50) * 4
        );

    var level = Math.min(
        99,
        1 + Math.floor(Math.sqrt(points / 40))
    );

    var current =
        40 * (level - 1) * (level - 1);

    var next =
        40 * level * level;

    return {

        lv: level,

        pct: Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    (points - current) /
                    (next - current) * 100
                )
            )
        ),

        points: points,
        current: current,
        next: next

    };

}


/* ============================================================
   41 — TITLES
   ============================================================ */

function titleOf(level) {

    return level >= 22 ? 'أسطورة' :
        level >= 15 ? 'خبير' :
        level >= 10 ? 'محترف' :
        level >= 6 ? 'ماهر' :
        level >= 3 ? 'هاوي' :
        'مبتدئ';

}


/* ============================================================
   42 — PLAYER INFORMATION
   ============================================================ */

function myInfo() {

    var played = PF.played || 0;

    return {

        av: PF.av,

        lv: calcLv().lv,

        wr: played
            ? Math.round((PF.w || 0) * 100 / played)
            : 0,

        pl: played

    };

}


function cleanInfo(info) {

    info = info || {};

    return {

        av: (
            Number.isInteger(info.av) &&
            info.av >= 0 &&
            info.av < PF_AVATARS.length
        )
            ? info.av
            : 0,

        lv: Math.max(
            1,
            Math.min(99, parseInt(info.lv) || 1)
        ),

        wr: Math.max(
            0,
            Math.min(100, parseInt(info.wr) || 0)
        ),

        pl: Math.max(
            0,
            Math.min(99999, parseInt(info.pl) || 0)
        )

    };

}


function infoOf(uid) {

    var player =
        (typeof ONLINE_PLAYERS !== 'undefined' && ONLINE_PLAYERS[uid]) ||
        (typeof SEEN !== 'undefined' && SEEN[uid]);

    return player && player.info
        ? cleanInfo(player.info)
        : {
            av: 0,
            lv: 1,
            wr: 0,
            pl: 0
        };

}


/* ============================================================
   43 — PROFILE DECORATION
   ============================================================ */

function decorProf() {

    if (typeof PF === 'undefined') return;

    var card = pfGet('pfCard');

    if (!card) return;

    var level = calcLv();

    var played = PF.played || 0;

    var winRate = played
        ? Math.round((PF.w || 0) * 100 / played)
        : 0;

    var avatarIndex =
        Number.isInteger(PF.av) && PF.av >= 0
            ? PF.av % PF_AVATARS.length
            : 0;

    card.innerHTML = `

        <div class="lvcard">

            <div class="avbig">

                <img

                    src="${PF_AVATARS[avatarIndex]}"

                    alt="صورة اللاعب"

                    style="width:100%;height:100%;object-fit:cover;border-radius:50%;"

                >

            </div>

            <div class="lvinfo">

                <b>
                    ${pfEscape(titleOf(level.lv))}
                    • المستوى ${level.lv}
                </b>

                <small>
                    نسبة الفوز ${winRate}%
                    • التواجد ${PF.mins || 0} دقيقة
                </small>

                <div class="lvbar">
                    <i style="width:${level.pct}%"></i>
                </div>

            </div>

        </div>

    `;

    var grid = pfGet('avGrid');

    if (!grid) return;

    grid.textContent = '';

    PF_AVATARS.forEach(function (url, index) {

        var button = document.createElement('button');

        button.className =
            index === avatarIndex ? 'on' : '';

        button.type = 'button';

        var image = document.createElement('img');

        image.src = url;
        image.alt = 'صورة اللاعب';
        image.loading = 'lazy';

        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'cover';
        image.style.borderRadius = 'inherit';

        button.appendChild(image);

        button.onclick = function () {

            if (pfLogged()) {

                pfSelectAvatar(index);

            } else {

                PF.av = index;

                pfSaveLocal();

                decorProf();

                pfRefresh();

            }

        };

        grid.appendChild(button);

    });

}


/* ============================================================
   44 — RENDER PROFILE
   ============================================================ */

function renderProf() {

    if (typeof PF === 'undefined') return;

    var root = pfGet('prof');

    if (root) {

        root.classList.toggle(
            'pf-auth-locked',
            !pfLogged()
        );

    }

    if (!pfLogged()) {

        pfRenderAccount();

        return;

    }

    var nameInput = pfGet('pfName');

    var notice = pfGet('nameChangeNotice');

    if (nameInput) {

        nameInput.value = PF.name || '';
        nameInput.disabled = false;

    }

    if (notice) {
        notice.textContent = '';
    }

    var played = PF.played || 0;

    var winRate =
        (PF.w || 0) + (PF.l || 0)
            ? Math.round(
                (PF.w || 0) * 100 /
                ((PF.w || 0) + (PF.l || 0))
            )
            : 0;

    var stats = [

        ['مباريات', played],
        ['فوز', PF.w || 0],
        ['خسارة', PF.l || 0],
        ['تعادل', PF.d || 0],
        ['نسبة الفوز', winRate + '%']

    ];

    var box = pfGet('pfStats');

    if (box) {

        box.innerHTML = stats.map(function (item) {

            return `

                <div class="st">

                    <b>${pfEscape(item[1])}</b>

                    <small>${pfEscape(item[0])}</small>

                </div>

            `;

        }).join('');

    }

    decorProf();

    pfRenderAccount();

}


/* ============================================================
   45 — OPEN PROFILE
   ============================================================ */

function openProf() {

    var profile = pfGet('prof');

    if (!profile) {

        console.error('[OFESTRA] Profile element #prof not found.');

        return;

    }

    pfEnsureAccount();

    renderProf();

    profile.classList.add('on');

    document.body.classList.add('so');

    if (typeof X !== 'undefined' && X.ui) {
        X.ui();
    }

    if (!PF_AUTH.ready && pfToken()) {
        pfRestoreSession();
    }

}


/* ============================================================
   46 — CLOSE PROFILE
   ============================================================ */

function closeProf() {

    var profile = pfGet('prof');

    if (profile) {
        profile.classList.remove('on');
    }

    document.body.classList.remove('so');

    if (typeof X !== 'undefined' && X.sw) {
        X.sw();
    }

}


/* ============================================================
   47 — DISPLAY NAME CHANGE
   ============================================================ */

function pfChangeName() {

    var input = pfGet('pfName');

    if (!input || !pfLogged()) return;

    var value = input.value.trim();

    var error = pfDisplayNameError(value);

    if (error) {

        pfNotify(error);

        renderProf();

        return;

    }

    PF.name = value;

    pfSave();

    renderProf();

    pfPublish();

    pfNotify('تم تحديث اسم العرض.');

}


/* ============================================================
   48 — RESET STATISTICS
   ============================================================ */

function pfResetStats() {

    if (!pfLogged()) {

        pfNotify('يجب تسجيل الدخول أولاً.');

        return;

    }

    var accepted = confirm(
        'هل تريد إعادة تعيين إحصائيات حسابك؟'
    );

    if (!accepted) return;

    PF.played = 0;
    PF.w = 0;
    PF.l = 0;
    PF.d = 0;
    PF.mins = 0;

    pfSave();

    renderProf();

    pfPublish();

    pfNotify('تمت إعادة تعيين الإحصائيات.');

}


/* ============================================================
   49 — ONLINE ACCOUNT PROTECTION
   ============================================================ */

function pfRequireLogin() {

    if (pfLogged()) {
        return true;
    }

    pfNotify(
        'يجب تسجيل الدخول قبل استخدام اللعب عبر الإنترنت.'
    );

    PF_VIEW = 'login';

    openProf();

    pfRenderAccount();

    return false;

}


/* ============================================================
   50 — PUBLIC PROFILE DATA
   ============================================================ */

function profilePublicData() {

    var level = calcLv();

    return {

        name: PF.name,

        username: PF_AUTH.user
            ? PF_AUTH.user.username || ''
            : '',

        av: PF.av,

        avatar_url:
            PF_AVATARS[PF.av] ||
            PF_AVATARS[0],

        info: PF.info || '',

        level: level.lv,

        title: titleOf(level.lv),

        wins: PF.w || 0,

        losses: PF.l || 0,

        draws: PF.d || 0,

        played: PF.played || 0,

        winRate: myInfo().wr,

        minutes: PF.mins || 0

    };

}


/* ============================================================
   51 — INITIALIZATION
   ============================================================ */

function initProfile() {

    var closeButton = pfGet('xP');

    var backButton = pfGet('bkP');

    var nameInput = pfGet('pfName');

    var resetButton = pfGet('pfReset');

    if (closeButton) {
        closeButton.onclick = closeProf;
    }

    if (backButton) {
        backButton.onclick = closeProf;
    }

    if (nameInput) {
        nameInput.onchange = pfChangeName;
    }

    if (resetButton) {
        resetButton.onclick = pfResetStats;
    }

    pfEnsureAccount();

    /*
       لا نعلن استعادة الجلسة قبل محاولة فحصها.
       إذا لا يوجد token، نبدأ كضيف.
    */

    if (pfToken()) {

        PF_AUTH.ready = false;

        pfRestoreSession();

    } else {

        PF_AUTH.ready = true;

    }

    renderProf();

    if (PF_PROFILE_TIMER) {
        clearInterval(PF_PROFILE_TIMER);
    }

    PF_PROFILE_TIMER = setInterval(function () {

        if (
            !document.hidden &&
            typeof PF !== 'undefined'
        ) {

            PF.mins = (PF.mins || 0) + 1;

            pfSave();

        }

    }, 60000);

}


/* ============================================================
   52 — FIRST RUN
   ============================================================ */

function firstRunProfile() {

    if (!PF.seen) {

        PF.seen = 1;

        pfSaveLocal();

        setTimeout(function () {
            openProf();
        }, 600);

    }

}


/* ============================================================
   53 — OPEN ACCOUNT HOME
   ============================================================ */

function pfOpenAccount() {

    PF_VIEW = 'home';

    openProf();

    pfRenderAccount();

}


/* ============================================================
   END OF OFESTRA PROFILE ENGINE
   ============================================================ */
