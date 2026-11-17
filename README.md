# WFESCTRA

## تشغيل المشروع
افتح `index.html` من سيرفر محلي (مثلاً `python3 -m http.server`) وليس بالنقر المزدوج.

## ربط السيرفر (ملف واحد: `js/config.js`)
- عنوان السيرفر: غيّره بدون تعديل الملف بفتح الموقع هكذا:
  `index.html?server=https://عنوان-السيرفر`
  (روابط trycloudflare تتغير كل تشغيل، وهذا أكثر سبب لعدم الاتصال)
- كل المسارات في جدول `ENDPOINTS` داخل `config.js`.
- الأصدقاء والرسائل ونتائج المباريات والحساب والملف الشخصي كلها تمر من `WFESCTRA_SERVER`.
- المباراة الحية (الحركات/الحضور/الدردشة اللحظية) تبقى عبر MQTT، لكن هوية اللاعب = حساب السيرفر.

## تتبع الأخطاء
- افتح `index.html?debug=1` تظهر لوحة سجلات + زر **Diagnose** يفحص كل مسارات السيرفر ويقول أيها موجود.
- من الكونسول: `WFESCTRA_SERVER.logs()` و `WFESCTRA_SERVER.diagnose()`.
- كل خطأ له كود: `E-NET` اتصال، `E-AUTH` حساب، `E-PROFILE` ملف شخصي، `E-STATS` إحصائيات، `E-GAME` نتيجة مباراة، `E-MQTT` أونلاين.

## هيكل الملفات
config.js (السيرفر) → core/storage/audio → game/ai → online/friends →
profile/{core,server,auth,data,levels,ui} → settings/ui → main → debug
