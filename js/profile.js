
/* ============================================================
   OFESTRA PRO — PROFILE.JS
   WFESC ENGINE

   PROFILE SYSTEM
   - Player statistics
   - Levels and ranks
   - Avatar selection
   - Display name
   - Player information card
   - Guest mode
   - Account login / registration
   - Account logout
   - Server connection
   - Remote profile synchronization

   Dependencies:
   core.js
   storage.js
   audio.js
   online.js

   ============================================================ */


/* ============================================================
   01 — SERVER CONFIGURATION
   ============================================================ */

var PF_API = {

    BASE_URL:
        localStorage.getItem('OFESTRA_API_URL') ||
        'http://127.0.0.1:8000',

    REGISTER: '/auth/register',

    LOGIN: '/auth/login',

    ME: '/auth/me',

    PROFILE: '/profile'

};


/* ============================================================
   02 — ACCOUNT STATE
   ============================================================ */

var PF_AUTH = {

    token:
        localStorage.getItem('OFESTRA_AUTH_TOKEN') || '',

    user: null,

    ready: false,

    busy: false,

    restoring: false

};

var PF_AUTH_MODE = 'login';

var PF_PROFILE_TIMER = null;


/* ============================================================
   03 — GENERAL HELPERS
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


function pfSave() {

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


function pfBase() {

    return PF_API.BASE_URL.replace(/\/+$/, '');

}


function pfUID() {

    var user = PF_AUTH.user || {};

    return String(

        user.uid ||

        user.player_uid ||

        user.id ||

        user.player_id ||

        ''

    );

}


function pfToken() {

    return PF_AUTH.token ||

        localStorage.getItem('OFESTRA_AUTH_TOKEN') ||

        '';

}


function pfSetToken(token) {

    PF_AUTH.token = token || '';

    if (token) {

        localStorage.setItem(

            'OFESTRA_AUTH_TOKEN',

            token

        );

    } else {

        localStorage.removeItem(

            'OFESTRA_AUTH_TOKEN'

        );

    }

}


function pfLogged() {

    return !!(

        PF_AUTH.token &&

        PF_AUTH.user

    );

}


/* ============================================================
   04 — SERVER REQUEST
   ============================================================ */

async function pfRequest(path, options) {

    options = options || {};

    var headers = {

        Accept: 'application/json'

    };

    var token = pfToken();

    if (token && options.auth !== false) {

        headers.Authorization = 'Bearer ' + token;

    }

    if (options.body !== undefined) {

        headers['Content-Type'] = 'application/json';

    }

    var response = await fetch(

        pfBase() + path,

        {

            method: options.method || 'GET',

            headers: headers,

            body: options.body !== undefined

                ? JSON.stringify(options.body)

                : undefined

        }

    );

    var text = await response.text();

    var data = {};

    try {

        data = text ? JSON.parse(text) : {};

    } catch (error) {

        data = {

            message: text

        };

    }

    if (!response.ok) {

        var message =

            data.detail ||

            data.message ||

            data.error ||

            'HTTP ' + response.status;

        var err = new Error(message);

        err.status = response.status;

        throw err;

    }

    return data;

}


/* ============================================================
   05 — RESPONSE PARSING
   ============================================================ */

function pfReadToken(data) {

    if (!data) return '';

    return (

        data.access_token ||

        data.token ||

        data.session_token ||

        data.session?.access_token ||

        data.data?.access_token ||

        data.data?.token ||

        ''

    );

}


function pfReadUser(data) {

    if (!data) return null;

    return (

        data.user ||

        data.player ||

        data.account ||

        data.data?.user ||

        data.data?.player ||

        data

    );

}


function pfReadProfile(data) {

    if (!data) return null;

    return (

        data.profile ||

        data.player_profile ||

        data.data?.profile ||

        data.data ||

        data

    );

}


/* ============================================================
   06 — LOGIN
   ============================================================ */

async function pfLogin(email, password) {

    if (PF_AUTH.busy) return false;

    PF_AUTH.busy = true;

    pfRenderAccount();

    try {

        var response;

        try {

            response = await pfRequest(

                PF_API.LOGIN,

                {

                    method: 'POST',

                    auth: false,

                    body: {

                        email: email,

                        username: email,

                        password: password

                    }

                }

            );

        } catch (error) {

            if (

                error.status !== 422 &&

                error.status !== 415

            ) {

                throw error;

            }

            /* دعم تسجيل الدخول بصيغة OAuth2 */

            var form = new URLSearchParams();

            form.set('username', email);

            form.set('password', password);

            var raw = await fetch(

                pfBase() + PF_API.LOGIN,

                {

                    method: 'POST',

                    headers: {

                        'Content-Type':

                            'application/x-www-form-urlencoded',

                        Accept: 'application/json'

                    },

                    body: form.toString()

                }

            );

            response = await raw.json();

            if (!raw.ok) {

                throw new Error(

                    response.detail ||

                    response.message ||

                    'فشل تسجيل الدخول.'

                );

            }

        }

        var token = pfReadToken(response);

        if (!token) {

            throw new Error(

                'لم يرجع السيرفر رمز تسجيل الدخول.'

            );

        }

        pfSetToken(token);

        PF_AUTH.user = pfReadUser(response);

        if (!PF_AUTH.user || !pfUID()) {

            var account = await pfRequest(

                PF_API.ME,

                {

                    method: 'GET'

                }

            );

            PF_AUTH.user = pfReadUser(account);

        }

        if (!pfUID()) {

            throw new Error(

                'لم يتم استلام UID صالح من السيرفر.'

            );

        }

        PF_AUTH.ready = true;

        await pfLoadRemote();

        pfSave();

        renderProf();

        pfPublish();

        pfNotify('تم تسجيل الدخول بنجاح.');

        return true;

    } catch (error) {

        pfNotify(

            'تعذر تسجيل الدخول: ' + error.message

        );

        return false;

    } finally {

        PF_AUTH.busy = false;

        pfRenderAccount();

    }

}


/* ============================================================
   07 — REGISTRATION
   ============================================================ */

async function pfRegister(name, email, password) {

    if (PF_AUTH.busy) return false;

    name = String(name || '').trim();

    email = String(email || '').trim();

    if (name.length < 3) {

        pfNotify('اسم اللاعب يجب أن يحتوي على 3 أحرف على الأقل.');

        return false;

    }

    if (!email || !email.includes('@')) {

        pfNotify('يرجى إدخال بريد إلكتروني صحيح.');

        return false;

    }

    if (password.length < 6) {

        pfNotify('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');

        return false;

    }

    PF_AUTH.busy = true;

    pfRenderAccount();

    try {

        var response = await pfRequest(

            PF_API.REGISTER,

            {

                method: 'POST',

                auth: false,

                body: {

                    username: name,

                    name: name,

                    display_name: name,

                    email: email,

                    password: password

                }

            }

        );

        var token = pfReadToken(response);

        if (!token) {

            pfNotify(

                'تم إرسال طلب إنشاء الحساب. تحقق من استجابة السيرفر أو البريد الإلكتروني.'

            );

            return false;

        }

        pfSetToken(token);

        PF_AUTH.user = pfReadUser(response);

        if (!pfUID()) {

            var me = await pfRequest(

                PF_API.ME,

                {

                    method: 'GET'

                }

            );

            PF_AUTH.user = pfReadUser(me);

        }

        if (!pfUID()) {

            throw new Error(

                'الحساب تم إنشاؤه لكن UID غير متوفر.'

            );

        }

        PF_AUTH.ready = true;

        PF.name = name.slice(0, 14);

        pfSave();

        await pfLoadRemote();

        renderProf();

        pfPublish();

        pfNotify('تم إنشاء حساب OFESTRA بنجاح.');

        return true;

    } catch (error) {

        pfNotify(

            'تعذر إنشاء الحساب: ' + error.message

        );

        return false;

    } finally {

        PF_AUTH.busy = false;

        pfRenderAccount();

    }

}


/* ============================================================
   08 — RESTORE SESSION
   ============================================================ */

async function pfRestoreSession() {

    if (

        PF_AUTH.restoring ||

        !pfToken()

    ) {

        return false;

    }

    PF_AUTH.restoring = true;

    try {

        var response = await pfRequest(

            PF_API.ME,

            {

                method: 'GET'

            }

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

            PF_AUTH.ready = true;

        } else {

            console.warn(

                '[OFESTRA] Session restore:',

                error.message

            );

        }

        return false;

    } finally {

        PF_AUTH.restoring = false;

        pfRenderAccount();

        renderProf();

    }

}


/* ============================================================
   09 — LOGOUT
   ============================================================ */

async function pfLogout() {

    pfSetToken('');

    PF_AUTH.user = null;

    PF_AUTH.ready = true;

    pfSave();

    pfRenderAccount();

    renderProf();

    pfNotify(

        'تم تسجيل الخروج. يمكنك الاستمرار بوضع الزائر.'

    );

}


/* ============================================================
   10 — REMOTE PROFILE
   ============================================================ */

function pfRemoteURL() {

    return PF_API.PROFILE + '/' +

        encodeURIComponent(pfUID());

}


async function pfLoadRemote() {

    if (!pfLogged()) return false;

    try {

        var response = await pfRequest(

            pfRemoteURL(),

            {

                method: 'GET'

            }

        );

        var remote = pfReadProfile(response);

        pfApplyRemote(remote);

        return true;

    } catch (error) {

        console.warn(

            '[OFESTRA] Profile loading:',

            error.message

        );

        return false;

    }

}


function pfApplyRemote(remote) {

    if (!remote || typeof remote !== 'object') {

        return;

    }

    var name =

        remote.display_name ||

        remote.username ||

        remote.name;

    if (name) {

        PF.name = String(name).slice(0, 14);

    }

    var avatar =

        remote.avatar_index !== undefined

            ? remote.avatar_index

            : remote.av;

    if (

        Number.isInteger(avatar) &&

        avatar >= 0 &&

        avatar < AV.length

    ) {

        PF.av = avatar;

    }

    if (typeof remote.info === 'string') {

        PF.info = remote.info.slice(0, 250);

    }

    if (typeof remote.wins === 'number') {

        PF.w = remote.wins;

    }

    if (typeof remote.losses === 'number') {

        PF.l = remote.losses;

    }

    if (typeof remote.draws === 'number') {

        PF.d = remote.draws;

    }

    if (typeof remote.played === 'number') {

        PF.played = remote.played;

    }

    pfSave();

}


/* ============================================================
   11 — REMOTE PROFILE SAVE
   ============================================================ */

function pfRemoteData() {

    var level = calcLv();

    var played = PF.played || 0;

    return {

        username: PF.name,

        display_name: PF.name,

        name: PF.name,

        avatar_index: PF.av,

        av: PF.av,

        info: PF.info || '',

        level: level.lv,

        wins: PF.w || 0,

        losses: PF.l || 0,

        draws: PF.d || 0,

        played: played,

        win_rate: played

            ? Math.round(

                (PF.w || 0) * 100 / played

            )

            : 0

    };

}


async function pfSyncRemote() {

    if (!pfLogged()) {

        return false;

    }

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

            error.message

        );

        return false;

    }

}


/* ============================================================
   12 — ACCOUNT STYLES
   ============================================================ */

function pfAccountStyles() {

    if (pfGet('pfAccountStyles')) return;

    var style = document.createElement('style');

    style.id = 'pfAccountStyles';

    style.textContent = `

    .pf-account {

        direction:rtl;

        box-sizing:border-box;

        width:100%;

        margin-top:18px;

        padding:17px;

        border-radius:19px;

        background:linear-gradient(

            145deg,

            rgba(27,37,58,.97),

            rgba(9,15,28,.98)

        );

        border:1px solid rgba(125,153,200,.18);

        color:#edf3ff;

        font-family:inherit;

    }

    .pf-account-head {

        display:flex;

        align-items:center;

        justify-content:space-between;

        gap:12px;

        margin-bottom:15px;

    }

    .pf-account-title {

        font-size:15px;

        font-weight:900;

    }

    .pf-account-caption {

        color:#8d9bb3;

        font-size:11px;

        margin-top:4px;

    }

    .pf-account-status {

        padding:6px 10px;

        border-radius:30px;

        font-size:10px;

        white-space:nowrap;

        background:rgba(130,150,180,.13);

        color:#a9b8ce;

    }

    .pf-account-status.online {

        background:rgba(46,190,130,.13);

        color:#6ce5ad;

    }

    .pf-account-status.guest {

        background:rgba(224,171,71,.13);

        color:#e6c37e;

    }

    .pf-account-input {

        width:100%;

        box-sizing:border-box;

        display:block;

        margin-top:10px;

        padding:12px 13px;

        border-radius:11px;

        border:1px solid rgba(130,155,195,.2);

        outline:none;

        background:rgba(3,8,17,.55);

        color:#fff;

        font-family:inherit;

        font-size:13px;

    }

    .pf-account-input:focus {

        border-color:#6f9cf4;

        box-shadow:0 0 0 3px rgba(90,140,240,.12);

    }

    .pf-account textarea {

        resize:vertical;

        min-height:78px;

    }

    .pf-account-btn {

        border:0;

        border-radius:11px;

        padding:11px 13px;

        font-family:inherit;

        font-size:12px;

        font-weight:800;

        color:white;

        cursor:pointer;

    }

    .pf-account-primary {

        background:linear-gradient(120deg,#397bea,#6d8df2);

    }

    .pf-account-secondary {

        background:rgba(105,139,190,.16);

        border:1px solid rgba(125,155,200,.15);

    }

    .pf-account-danger {

        background:rgba(220,70,80,.15);

        border:1px solid rgba(220,70,80,.2);

        color:#ff9aa2;

    }

    .pf-account-actions {

        display:flex;

        gap:8px;

        margin-top:12px;

    }

    .pf-account-actions button {

        flex:1;

    }

    .pf-account-divider {

        height:1px;

        background:rgba(130,155,195,.13);

        margin:15px 0;

    }

    .pf-account-id {

        direction:ltr;

        text-align:left;

        overflow-wrap:anywhere;

        font-size:11px;

        color:#a9bddc;

        padding:10px;

        border-radius:9px;

        background:rgba(3,8,17,.4);

        margin-top:10px;

    }

    .pf-account-tabs {

        display:flex;

        gap:8px;

        margin-bottom:12px;

    }

    .pf-account-tabs button {

        flex:1;

    }

    .pf-account-hint {

        color:#8596b1;

        font-size:11px;

        line-height:1.8;

        margin-top:12px;

    }

    `;

    document.head.appendChild(style);

}


/* ============================================================
   13 — ACCOUNT PANEL
   ============================================================ */

function pfEnsureAccount() {

    pfAccountStyles();

    var panel = pfGet('pfAccountPanel');

    if (panel) return panel;

    var root = pfGet('prof');

    if (!root) return null;

    panel = document.createElement('section');

    panel.id = 'pfAccountPanel';

    panel.className = 'pf-account';

    var card = pfGet('pfCard');

    if (card && card.parentNode) {

        card.insertAdjacentElement(

            'afterend',

            panel

        );

    } else {

        root.appendChild(panel);

    }

    panel.addEventListener('submit', function(event) {

        var form = event.target.closest('[data-pf-form]');

        if (!form) return;

        event.preventDefault();

        var action = form.getAttribute('data-pf-form');

        if (action === 'login') {

            pfAccountAction('login');

        } else if (action === 'register') {

            pfAccountAction('register');

        }

    });

    panel.addEventListener('click', function(event) {

        var button = event.target.closest('[data-pf-action]');

        if (!button) return;

        pfAccountAction(

            button.getAttribute('data-pf-action')

        );

    });

    return panel;

}


/* ============================================================
   14 — ACCOUNT RENDER
   ============================================================ */

function pfRenderAccount() {

    var panel = pfEnsureAccount();

    if (!panel) return;

    if (PF_AUTH.busy) {

        panel.innerHTML = `

            <div class="pf-account-head">

                <div>

                    <div class="pf-account-title">

                        حساب OFESTRA

                    </div>

                    <div class="pf-account-caption">

                        جارٍ تنفيذ العملية...

                    </div>

                </div>

                <span class="pf-account-status">

                    PROCESSING

                </span>

            </div>

        `;

        return;

    }

    if (pfLogged()) {

        var user = PF_AUTH.user || {};

        panel.innerHTML = `

            <div class="pf-account-head">

                <div>

                    <div class="pf-account-title">

                        حساب OFESTRA

                    </div>

                    <div class="pf-account-caption">

                        إدارة حساب اللاعب

                    </div>

                </div>

                <span class="pf-account-status online">

                    ● متصل

                </span>

            </div>

            <div style="font-size:11px;color:#96a9c5;">

                البريد الإلكتروني

            </div>

            <div style="font-size:13px;margin-top:5px;">

                ${pfEscape(user.email || 'غير متوفر')}

            </div>

            <div class="pf-account-id">

                UID: ${pfEscape(pfUID())}

            </div>

            <div class="pf-account-divider"></div>

            <label style="font-size:11px;color:#9aabc4;">

                اسم العرض

            </label>

            <input

                class="pf-account-input"

                id="pfCloudName"

                maxlength="14"

                value="${pfEscape(PF.name)}"

            >

            <label style="display:block;margin-top:12px;font-size:11px;color:#9aabc4;">

                نبذة اللاعب

            </label>

            <textarea

                class="pf-account-input"

                id="pfCloudInfo"

                maxlength="250"

                placeholder="اكتب نبذة عن نفسك..."

            >${pfEscape(PF.info || '')}</textarea>

            <div class="pf-account-actions">

                <button

                    class="pf-account-btn pf-account-primary"

                    data-pf-action="save"

                    type="button"

                >

                    حفظ البيانات

                </button>

                <button

                    class="pf-account-btn pf-account-secondary"

                    data-pf-action="sync"

                    type="button"

                >

                    مزامنة

                </button>

            </div>

            <div class="pf-account-divider"></div>

            <button

                class="pf-account-btn pf-account-danger"

                data-pf-action="logout"

                style="width:100%;"

                type="button"

            >

                تسجيل الخروج

            </button>

            <div class="pf-account-hint">

                بيانات حسابك مرتبطة بمعرّف UID الخاص بك.

            </div>

        `;

        return;

    }

    var register = PF_AUTH_MODE === 'register';

    panel.innerHTML = `

        <div class="pf-account-head">

            <div>

                <div class="pf-account-title">

                    حساب OFESTRA

                </div>

                <div class="pf-account-caption">

                    احفظ هويتك وتقدمك في اللعبة

                </div>

            </div>

            <span class="pf-account-status guest">

                ● زائر

            </span>

        </div>

        <div class="pf-account-tabs">

            <button

                class="pf-account-btn ${

                    register

                        ? 'pf-account-secondary'

                        : 'pf-account-primary'

                }"

                data-pf-action="login-tab"

                type="button"

            >

                تسجيل الدخول

            </button>

            <button

                class="pf-account-btn ${

                    register

                        ? 'pf-account-primary'

                        : 'pf-account-secondary'

                }"

                data-pf-action="register-tab"

                type="button"

            >

                إنشاء حساب

            </button>

        </div>

        <form data-pf-form="${register ? 'register' : 'login'}">

            ${register ? `

                <input

                    class="pf-account-input"

                    id="pfAuthName"

                    maxlength="14"

                    placeholder="اسم اللاعب"

                    autocomplete="nickname"

                    required

                >

            ` : ''}

            <input

                class="pf-account-input"

                id="pfAuthEmail"

                type="email"

                placeholder="البريد الإلكتروني"

                autocomplete="email"

                required

            >

            <input

                class="pf-account-input"

                id="pfAuthPassword"

                type="password"

                minlength="6"

                placeholder="كلمة المرور"

                autocomplete="${

                    register

                        ? 'new-password'

                        : 'current-password'

                }"

                required

            >

            <button

                class="pf-account-btn pf-account-primary"

                type="submit"

                style="width:100%;margin-top:13px;"

            >

                ${

                    register

                        ? 'إنشاء حساب OFESTRA'

                        : 'تسجيل الدخول'

                }

            </button>

        </form>

        <div class="pf-account-hint">

            ${

                register

                    ? 'أنشئ حساباً للحصول على UID خاص بك.'

                    : 'يمكنك اللعب كزائر، لكن اللعب عبر الإنترنت يتطلب تسجيل الدخول.'

            }

        </div>

    `;

}


/* ============================================================
   15 — ACCOUNT ACTIONS
   ============================================================ */

async function pfAccountAction(action) {

    if (action === 'login-tab') {

        PF_AUTH_MODE = 'login';

        pfRenderAccount();

        return;

    }

    if (action === 'register-tab') {

        PF_AUTH_MODE = 'register';

        pfRenderAccount();

        return;

    }

    if (action === 'login') {

        var email = pfGet('pfAuthEmail')?.value.trim();

        var password = pfGet('pfAuthPassword')?.value;

        await pfLogin(email, password);

        return;

    }

    if (action === 'register') {

        var name = pfGet('pfAuthName')?.value.trim();

        var emailRegister = pfGet('pfAuthEmail')?.value.trim();

        var passwordRegister = pfGet('pfAuthPassword')?.value;

        await pfRegister(

            name,

            emailRegister,

            passwordRegister

        );

        return;

    }

    if (action === 'logout') {

        await pfLogout();

        return;

    }

    if (action === 'save') {

        await pfSaveAccount();

        return;

    }

    if (action === 'sync') {

        var result = await pfSyncRemote();

        pfNotify(

            result

                ? 'تمت مزامنة الملف الشخصي.'

                : 'تعذرت المزامنة. تحقق من API.'

        );

    }

}


/* ============================================================
   16 — SAVE ACCOUNT PROFILE
   ============================================================ */

async function pfSaveAccount() {

    if (!pfLogged()) {

        pfNotify('يجب تسجيل الدخول أولاً.');

        return;

    }

    var nameInput = pfGet('pfCloudName');

    var infoInput = pfGet('pfCloudInfo');

    var name = nameInput

        ? nameInput.value.trim().slice(0, 14)

        : PF.name;

    var info = infoInput

        ? infoInput.value.trim().slice(0, 250)

        : PF.info || '';

    if (!name) {

        pfNotify('اسم العرض لا يمكن أن يكون فارغاً.');

        return;

    }

    if (

        name !== PF.name &&

        Date.now() - (PF.lastNamed || 0) < 3600000

    ) {

        pfNotify('انتظر انتهاء مدة تغيير الاسم.');

        return;

    }

    if (name !== PF.name) {

        PF.name = name;

        PF.lastNamed = Date.now();

    }

    PF.info = info;

    pfSave();

    renderProf();

    var synced = await pfSyncRemote();

    if (synced) {

        pfNotify('تم حفظ بيانات الحساب ومزامنتها.');

    } else {

        pfNotify(

            'تم الحفظ محلياً، لكن تعذرت مزامنة السيرفر.'

        );

    }

    pfPublish();

}


/* ============================================================
   17 — LEVEL CALCULATOR
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
   18 — TITLES
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
   19 — PLAYER INFO
   ============================================================ */

function myInfo() {

    var played = PF.played || 0;

    return {

        av: PF.av,

        lv: calcLv().lv,

        wr: played

            ? Math.round(

                (PF.w || 0) * 100 / played

            )

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

            info.av < AV.length

        )

            ? info.av

            : 0,

        lv: Math.max(

            1,

            Math.min(

                99,

                parseInt(info.lv) || 1

            )

        ),

        wr: Math.max(

            0,

            Math.min(

                100,

                parseInt(info.wr) || 0

            )

        ),

        pl: Math.max(

            0,

            Math.min(

                99999,

                parseInt(info.pl) || 0

            )

        )

    };

}


function infoOf(uid) {

    var player =

        ONLINE_PLAYERS[uid] ||

        SEEN[uid];

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
   20 — PROFILE DECORATION
   ============================================================ */

function decorProf() {

    var card = pfGet('pfCard');

    if (!card) return;

    var level = calcLv();

    var played = PF.played || 0;

    var winRate = played

        ? Math.round(

            (PF.w || 0) * 100 / played

        )

        : 0;

    card.innerHTML = `

        <div class="lvcard">

            <div class="avbig">

                ${AV[PF.av] || AV[0]}

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

    AV.forEach(function (avatar, index) {

        var button = document.createElement('button');

        button.textContent = avatar;

        button.className =

            index === PF.av ? 'on' : '';

        button.type = 'button';

        button.onclick = function () {

            PF.av = index;

            pfSave();

            pfSound();

            decorProf();

            pfRefresh();

            pfPublish();

            if (pfLogged()) {

                pfSyncRemote();

            }

        };

        grid.appendChild(button);

    });

}


/* ============================================================
   21 — RENDER PROFILE
   ============================================================ */

function renderProf() {

    if (typeof PF === 'undefined') return;

    var nameInput = pfGet('pfName');

    var notice = pfGet('nameChangeNotice');

    if (nameInput) {

        nameInput.value = PF.name || '';

    }

    var remaining =

        3600000 - (

            Date.now() - (PF.lastNamed || 0)

        );

    if (remaining > 0) {

        if (notice) {

            notice.textContent =

                'متبقي ' +

                Math.ceil(remaining / 60000) +

                ' دقيقة لتغيير الاسم مجدداً.';

        }

        if (nameInput) {

            nameInput.disabled = true;

        }

    } else {

        if (notice) {

            notice.textContent = '';

        }

        if (nameInput) {

            nameInput.disabled = false;

        }

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
   22 — OPEN PROFILE
   ============================================================ */

function openProf() {

    renderProf();

    var profile = pfGet('prof');

    if (profile) {

        profile.classList.add('on');

    }

    document.body.classList.add('so');

    if (typeof X !== 'undefined' && X.ui) {

        X.ui();

    }

    if (!PF_AUTH.ready) {

        pfRestoreSession();

    }

}


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
   23 — NAME CHANGE
   ============================================================ */

function pfChangeName() {

    var input = pfGet('pfName');

    if (!input) return;

    var now = Date.now();

    if (

        now - (PF.lastNamed || 0) < 3600000

    ) {

        pfNotify(

            'لا يمكنك تغيير اسمك إلا بعد مرور ساعة كاملة.'

        );

        renderProf();

        return;

    }

    var value = input.value

        .trim()

        .slice(0, 14);

    if (!value) {

        pfNotify('أدخل اسماً صالحاً.');

        renderProf();

        return;

    }

    PF.name = value;

    PF.lastNamed = now;

    pfSave();

    renderProf();

    pfPublish();

    if (pfLogged()) {

        pfSyncRemote();

    }

    pfNotify('تم تحديث اسم اللاعب.');

}


/* ============================================================
   24 — RESET STATISTICS
   ============================================================ */

function pfResetStats() {

    pfNotify(

        'مسح الإحصائيات بالكامل؟',

        function () {}

    );

    if (typeof showToastNotification === 'function') {

        showToastNotification(

            'مسح الإحصائيات بالكامل؟',

            function () {

                PF.played = 0;

                PF.w = 0;

                PF.l = 0;

                PF.d = 0;

                pfSave();

                renderProf();

                pfPublish();

            }

        );

    }

}


/* ============================================================
   25 — PROFILE INITIALIZATION
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

    renderProf();

    if (!PF_AUTH.ready) {

        pfRestoreSession();

    }

    if (PF_PROFILE_TIMER) {

        clearInterval(PF_PROFILE_TIMER);

    }

    PF_PROFILE_TIMER = setInterval(function () {

        if (!document.hidden) {

            PF.mins = (PF.mins || 0) + 1;

            pfSave();

        }

    }, 60000);

}


/* ============================================================
   26 — FIRST RUN
   ============================================================ */

function firstRunProfile() {

    if (!PF.seen) {

        PF.seen = 1;

        pfSave();

        setTimeout(function () {

            openProf();

        }, 600);

    }

}


/* ============================================================
   27 — ONLINE ACCOUNT PROTECTION
   ============================================================ */

function pfRequireLogin() {

    if (pfLogged()) {

        return true;

    }

    pfNotify(

        'يجب تسجيل الدخول قبل استخدام اللعب عبر الإنترنت.'

    );

    PF_AUTH_MODE = 'login';

    openProf();

    pfRenderAccount();

    return false;

}


/* ============================================================
   28 — PUBLIC PROFILE EXPORT
   ============================================================ */

function profilePublicData() {

    return {

        name: PF.name,

        av: PF.av,

        info: PF.info || '',

        level: calcLv().lv,

        title: titleOf(calcLv().lv),

        wins: PF.w || 0,

        losses: PF.l || 0,

        draws: PF.d || 0,

        played: PF.played || 0,

        winRate: myInfo().wr,

        minutes: PF.mins || 0

    };

}


/* ============================================================
   END OF OFESTRA PROFILE ENGINE
   ============================================================ */
