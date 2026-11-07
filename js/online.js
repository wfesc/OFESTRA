/* ============================================================
 * online.js
 * اللعب أونلاين عبر MQTT: الاتصال، الغرف، المطابقة، نبض الاتصال، استقبال الرسائل، إعلان التواجد
 * يعتمد على: core.js, storage.js, game.js, friends.js, profile.js, ui.js
 * ============================================================ */

/* Online & Lobby State */

var NET = { c: null, ready: false }, myRole = 'R', oppName = '', oppUid = '';

var GT = 'ofestra-net-v6/';

var SEEN = {}, OPP = { av: 0, lv: 1, wr: 0, pl: 0 };

var PEND = {}, RL = {}, REM = { me: false, opp: false };

var GLOBAL_LOBBY_TOPIC = GT + 'GLOBAL_LOBBY';

var ONL = { code: '', matched: false, sid: 0, rin: 0, lastHeartbeat: 0, dcTimer: null, quickSearchTimer: null };

var ONLINE_PLAYERS = {};

function netConnect(cb, err){
  if(NET.c && NET.ready){ if(cb) cb(); return; }
  NET.q = NET.q || []; NET.eq = NET.eq || [];
  if(cb) NET.q.push(cb); if(err) NET.eq.push(err);
  if(NET.loading) return; NET.loading = true;
  var fail = function(m){ NET.loading = false; var e = NET.eq; NET.eq = []; NET.q = []; e.forEach(function(f){ f(m); }); };
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
  s.onerror = function(){ s.remove(); fail('تأكد من اتصالك بالإنترنت'); };
  s.onload = function(){
    if(!window.mqtt){ fail('تعذر تحميل حزمة الاتصال'); return; }
    var c = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: 'ofe_' + UID + '_' + Math.random().toString(36).slice(2,6), clean: true, connectTimeout: 8000, reconnectPeriod: 2000 });
    NET.c = c; c.on('message', onNetMsg);
    c.on('connect', function(){
      NET.ready = true; NET.loading = false; NET.eq = [];
      c.subscribe(GLOBAL_LOBBY_TOPIC, { qos: 0 }); c.subscribe(GT + 'user_' + UID, { qos: 1 });
      if(ONL.code) c.subscribe(GT + ONL.code, { qos: 1 });
      startPresenceAnnounce(); c.subscribe(GT + 'dir/+', { qos: 0 }); publishDir(); if(!NET.dirT) NET.dirT = setInterval(publishDir, 60000);
      var q = NET.q; NET.q = []; q.forEach(function(f){ f(); });
    });
    c.on('close', function(){ NET.ready = false; });
    c.on('error', function(){ fail('خطأ في الاتصال بالخادم'); });
  };
  document.head.appendChild(s);
}

function startPresenceAnnounce(){
  if(NET.pres) return;
  NET.pres = setInterval(function(){
    if(!(NET.c && NET.ready)) return;
    var lv = PF.w > 20 ? 'محترف' : (PF.w > 5 ? 'متوسط' : 'مبتدئ');
    NET.c.publish(GLOBAL_LOBBY_TOPIC, JSON.stringify(Object.assign({ t: 'presence', u: UID, name: PF.name, level: lv }, myInfo())), { qos: 0 });
    var n = Date.now(); for(var k in ONLINE_PLAYERS) if(n - ONLINE_PLAYERS[k].lastSeen > 20000) delete ONLINE_PLAYERS[k];
  }, 5000);
}

function leaveRoom(){
  if(NET.c && ONL.code){ try{ NET.c.unsubscribe(GT + ONL.code); }catch(e){} }
  ONL.code = ''; ONL.matched = false; ONL.host = false; ONL.quick = false;
}

function netCancel(){ clearInterval(ONL.pingTimer); clearTimeout(ONL.quickSearchTimer); leaveRoom(); }

function validMove(m, p){
  if(!Array.isArray(m) || m.length !== 2) return false;
  var f = m[0], t = m[1];
  if(!Number.isInteger(f) || !Number.isInteger(t) || t < 0 || t > 8 || board[t]) return false;
  return placed[p] < 3 ? f === -1 : (f >= 0 && f < 9 && board[f] === p);
}

function checkRematch(){ if(REM.me && REM.opp){ REM.me = REM.opp = false; $('end').classList.remove('on'); start('online', 'R'); startHeartbeat(); } }

function sendDirect(targetUid, payload){
  if(!NET.c) return; payload.u = UID;
  try{ NET.c.publish(GT + 'user_' + targetUid, JSON.stringify(payload), { qos: 1 }); }catch(e){}
}

function gsend(o){
  if(!NET.c || !ONL.code) return; o.u = UID; o.i = ++ONL.sid;
  if(o.t === 'hello' || o.t === 'join' || o.t === 'start') Object.assign(o, myInfo());
  try{ NET.c.publish(GT + ONL.code, JSON.stringify(o), { qos: 1 }); }catch(e){}
}

function startHeartbeat(){
  ONL.lastHeartbeat = Date.now();
  if(ONL.dcTimer) clearInterval(ONL.dcTimer);
  ONL.dcTimer = setInterval(function(){
    if(!ONL.matched || ended || screen !== 'game') return;
    gsend({ t: 'hb' });
    if(Date.now() - ONL.lastHeartbeat > 15000){
      clearInterval(ONL.dcTimer);
      endMatch('disconnect', myRole);
    }
  }, 1500);
}

function onNetMsg(topic, payload){
  var o; try{ o = JSON.parse(payload.toString()); }catch(e){ return; }
  if(!o || typeof o !== 'object' || typeof o.u !== 'string' || o.u === UID || BLOCKED[o.u]) return;
  var t = o.t;
  if(topic.indexOf(GT + 'dir/') === 0){ SEEN[o.u] = { name: cleanName(o.name), info: cleanInfo(o), seen: Number(o.ts) || 0 }; return; }
  if(topic === GLOBAL_LOBBY_TOPIC){
    if(t === 'presence'){
      ONLINE_PLAYERS[o.u] = { name: cleanName(o.name), level: String(o.level || '').slice(0, 10), lastSeen: Date.now(), info: cleanInfo(o) };
      if(friendsOpen()){ renderOnlineUsersList(); renderMyFriendsList(); if($('usrSearch').value) runSearch(); }
    }
    return;
  }
  if(topic === GT + 'user_' + UID){ onDirect(o); return; }
  if(!ONL.code || topic !== GT + ONL.code) return;
  if(!ONL.matched){
    if(t === 'hello' && ONL.quick){
      var their = Number(o.r) || 0; clearInterval(ONL.pingTimer);
      ONL.matched = true; oppName = cleanName(o.n); oppUid = o.u; OPP = cleanInfo(o);
      gsend({ t: 'hello', n: PF.name, r: ONL.rnd });
      beginOnlineGame((ONL.rnd < their || (ONL.rnd === their && UID < o.u)) ? 'R' : 'B');
    } else if(t === 'join' && ONL.host){
      ONL.matched = true; oppName = cleanName(o.n); oppUid = o.u; OPP = cleanInfo(o);
      gsend({ t: 'start', n: PF.name, role: 'B' }); beginOnlineGame('R');
    } else if(t === 'start' && !ONL.host && !ONL.quick){
      ONL.matched = true; oppName = cleanName(o.n); oppUid = o.u; OPP = cleanInfo(o);
      beginOnlineGame(o.role === 'R' ? 'R' : 'B');
    }
    return;
  }
  if(o.u !== oppUid) return;
  if(t === 'join' && ONL.host){ gsend({ t: 'start', n: PF.name, role: 'B' }); return; }
  ONL.lastHeartbeat = Date.now();
  switch(t){
    case 'sel': if(!ended && !over && turn === other(myRole)){ oppSel = (Number.isInteger(o.sel) && o.sel >= 0 && o.sel < 9) ? o.sel : null; refresh(); } break;
    case 'mv': if(!ended && !over && turn === other(myRole) && validMove(o.m, turn)){ oppSel = null; apply(o.m); } break;
    case 'to': if(!ended && !over && turn === other(myRole)) timeout(); break;
    case 'sur': endMatch('surrender', myRole); break;
    case 'em': if(EMOJI_MAP[o.e]) triggerEmojiEffect(o.e, other(myRole)); break;
    case 'chat': showChatBanner(oppName, String(o.msg || '').slice(0, 40)); break;
    case 'rematch': REM.opp = true; checkRematch(); break;
    case 'left': if(ended){ $('eB').textContent += ' (غادر الخصم)'; $('eN').style.display = 'none'; } break;
  }
}

function beginOnlineGame(role){
  clearInterval(ONL.pingTimer); clearTimeout(ONL.quickSearchTimer); REM.me = REM.opp = false;
  myRole = role; $('onModal').classList.remove('on'); $('toastNotif').classList.remove('show');
  paint(); start('online', 'R'); startHeartbeat();
}

function setOnlineView(v){
  ['menu','create','join','wait'].forEach(function(n){ $('v-' + n).classList.toggle('on', n === v); });
  $('onT').textContent = { menu: '🌐 أونلاين', create: '➕ إنشاء غرفة', join: '🔑 دخول بررمز', wait: '⏳ انتظار الخصم' }[v];
}

function publishDir(){
  if(NET.c && NET.ready) NET.c.publish(GT + 'dir/' + UID, JSON.stringify(Object.assign({ u: UID, name: PF.name, ts: Date.now() }, myInfo())), { qos: 0, retain: true });
}

/* ربط نافذة الأونلاين (مطابقة تلقائية، إنشاء غرفة، دخول بالرمز) */
function initOnline(){
  $('btnOnline').onclick = function(){ cx(); setOnlineView('menu'); $('onMsg').textContent = ''; $('onModal').classList.add('on'); };
  $('bkOn').onclick = function(){ $('onModal').classList.remove('on'); netCancel(); };
  $('xOn').onclick = function(){ $('onModal').classList.remove('on'); netCancel(); };
  $('oQuick').onclick = function(){
    cx(); netCancel(); $('onMsg').textContent = 'جاري البحث عن لاعب...'; setOnlineView('wait'); $('wCode').style.display = 'none';
    netConnect(function(){
      ONL.code = 'QUICK_ROOM'; ONL.quick = true; ONL.matched = false; ONL.rnd = Math.random();
      NET.c.subscribe(GT + 'QUICK_ROOM', { qos: 1 });
      var ping = function(){ if(!ONL.matched) gsend({ t: 'hello', n: PF.name, r: ONL.rnd }); };
      ping(); ONL.pingTimer = setInterval(ping, 2000);
      ONL.quickSearchTimer = setTimeout(function(){
        if(!ONL.matched){ netCancel(); $('onModal').classList.remove('on'); diff = 'adaptive'; start('ai'); }
      }, 30000);
    }, function(e){ $('onMsg').textContent = e; setOnlineView('menu'); });
  };
  $('oCreate').onclick = function(){ setOnlineView('create'); };
  $('oJoin').onclick = function(){ setOnlineView('join'); };
  $('rmGo').onclick = function(){
    cx(); netCancel();
    var code = ($('rmCode').value.trim() || String(100000 + Math.floor(Math.random() * 900000))).replace(/\W/g, '').slice(0, 8);
    $('onMsg').textContent = 'شارك الرمز مع صديقك وانتظر دخوله...';
    $('wCode').textContent = code; $('wCode').style.display = 'block'; setOnlineView('wait');
    netConnect(function(){ ONL.code = code; ONL.host = true; ONL.matched = false; NET.c.subscribe(GT + code, { qos: 1 }); },
      function(e){ $('onMsg').textContent = e; setOnlineView('menu'); });
  };
  $('jnGo').onclick = function(){
    var code = $('jnCode').value.trim().replace(/\W/g, '');
    if(!code){ $('onMsg').textContent = 'يرجى إدخال رمز الغرفة'; return; }
    cx(); netCancel(); $('onMsg').textContent = 'جاري الانضمام للغرفة ' + code + '...';
    $('wCode').style.display = 'none'; setOnlineView('wait');
    netConnect(function(){
      ONL.code = code; ONL.host = false; ONL.quick = false; ONL.matched = false; NET.c.subscribe(GT + code, { qos: 1 });
      var p = function(){ if(!ONL.matched) gsend({ t: 'join', n: PF.name }); };
      p(); ONL.pingTimer = setInterval(p, 1500);
    }, function(e){ $('onMsg').textContent = e; setOnlineView('menu'); });
  };
  document.querySelectorAll('#onModal .back').forEach(function(b){
    b.onclick = function(){ netCancel(); setOnlineView('menu'); $('onMsg').textContent = ''; };
  });
}
