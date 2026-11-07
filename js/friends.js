/* ============================================================
 * friends.js
 * الأصدقاء والمتصلين: القوائم، البحث، الحظر، الدعوات، طلبات الصداقة، المحادثة المباشرة
 * يعتمد على: core.js, storage.js, online.js, profile.js, ui.js
 * ============================================================ */

function isFriend(u){ return MY_FRIENDS.some(function(f){ return f.uid === u; }); }

function friendsOpen(){ return $('friendsModal').classList.contains('on'); }

var activeChatFriend = null;

var typingTimer = null;

var lastTyp = 0;

function blockUser(uid){
  BLOCKED[uid] = (MY_FRIENDS.filter(function(f){ return f.uid === uid; })[0] || {}).name || (SEEN[uid] && SEEN[uid].name) || 'مستخدم'; saveBlocked();
  MY_FRIENDS = MY_FRIENDS.filter(function(f){ return f.uid !== uid; }); saveFriends();
  delete CHAT_HISTORY[uid]; saveChats(); delete UNREAD_MSGS[uid]; saveUnread(); delete ONLINE_PLAYERS[uid];
  renderMyFriendsList(); renderOnlineUsersList(); showToastNotification('تم حظر اللاعب');
}

function onDirect(o){
  var t = o.t, n = cleanName(o.name), now = Date.now();
  if(RL[o.u] && now - RL[o.u] < 300) return; RL[o.u] = now;
  if(t === 'invite_match'){
    var room = String(o.room || '').replace(/\W/g, '').slice(0, 12);
    if(!room || screen === 'game' || ONL.matched) return;
    showToastNotification('دعوة مباراة من ' + n, function(){
      if(screen === 'game') return;
      sendDirect(o.u, { t: 'accept_invite', room: room, name: PF.name });
      ONL.code = room; ONL.matched = true; ONL.host = false; oppName = n; oppUid = o.u; OPP = infoOf(o.u);
      NET.c.subscribe(GT + room, { qos: 1 }); beginOnlineGame('B');
    });
  } else if(t === 'accept_invite'){
    var pd = PEND[o.u];
    if(!pd || pd.room !== o.room || now - pd.t > 60000 || screen === 'game') return;
    delete PEND[o.u]; ONL.code = pd.room; ONL.matched = true; ONL.host = true; oppName = n; oppUid = o.u; OPP = infoOf(o.u);
    NET.c.subscribe(GT + pd.room, { qos: 1 }); beginOnlineGame('R');
  } else if(t === 'friend_req'){
    if(isFriend(o.u)) return;
    showToastNotification(n + ' يريد إضافتك كصديق', function(){ addMutualFriend(o.u, n); sendDirect(o.u, { t: 'friend_ok', name: PF.name }); });
  } else if(t === 'friend_ok'){
    if(PEND['f' + o.u] && now - PEND['f' + o.u] < 300000){ delete PEND['f' + o.u]; addMutualFriend(o.u, n); showToastNotification('أصبح ' + n + ' صديقك'); }
  } else if(t === 'direct_msg'){
    var m = String(o.msg || '').slice(0, 200);
    if(!m || !isFriend(o.u)) return;
    saveMessageToHistory(o.u, n, m, false);
    if(activeChatFriend && activeChatFriend.uid === o.u){ appendDirectMessage(n, m, false); }
    else { UNREAD_MSGS[o.u] = true; saveUnread(); renderMyFriendsList(); renderOnlineUsersList(); showToastNotification('رسالة من ' + n + ': ' + m.slice(0, 40)); }
  } else if(t === 'typing'){
    if(activeChatFriend && activeChatFriend.uid === o.u){
      var el = $('dcTyping'); el.classList.add('active'); clearTimeout(typingTimer);
      typingTimer = setTimeout(function(){ el.classList.remove('active'); }, 2000);
    }
  }
}

function addMutualFriend(friendUid, friendName){
  if(!MY_FRIENDS.find(function(f){ return f.uid === friendUid; })){
    MY_FRIENDS.push({ uid: friendUid, name: friendName });
    saveFriends();
    renderMyFriendsList();
  }
}

function saveMessageToHistory(u, n, m, isMe){
  var h = CHAT_HISTORY[u] || (CHAT_HISTORY[u] = []);
  h.push({ sender: isMe ? 'me' : n, msg: m, time: Date.now() });
  if(h.length > 100) h.splice(0, h.length - 100);
  saveChats();
}

function getDotsHTML(uid){
  var now = Date.now();
  var isOnline = (ONLINE_PLAYERS[uid] && (now - ONLINE_PLAYERS[uid].lastSeen < 10000));
  var isUnread = !!UNREAD_MSGS[uid];
  var dots = '';
  if(isUnread) dots += '<span class="dot unread" title="رسالة جديدة"></span>';
  if(isOnline) dots += '<span class="dot online" title="متصل الآن"></span>';
  return dots;
}

function uItem(uid, name, sub, btns, info, on){
  var d = document.createElement('div'); d.className = 'user-item';
  if(info){ var a = document.createElement('span'); a.className = 'uav'; a.textContent = AV[info.av] || '👤'; d.appendChild(a); }
  var i = document.createElement('div'); i.className = 'user-item-info';
  var s = document.createElement('strong'); s.innerHTML = on ? '<span class="dot online"></span>' : getDotsHTML(uid);
  s.appendChild(document.createTextNode(name));
  if(info){ var p = document.createElement('span'); p.className = 'lvp'; p.textContent = 'Lv ' + info.lv; s.appendChild(p); }
  var sm = document.createElement('small'); sm.className = on ? '' : 'off';
  sm.textContent = sub + (info ? ' • ' + titleOf(info.lv) + ' • فوز ' + info.wr + '%' : '');
  i.appendChild(s); i.appendChild(sm);
  var ac = document.createElement('div'); ac.className = 'user-actions';
  btns.filter(Boolean).forEach(function(b){ var e = document.createElement('button'); e.className = 'btn-sm' + (b[2] ? ' sec' : ''); e.textContent = b[0]; e.onclick = b[1]; ac.appendChild(e); });
  d.appendChild(i); d.appendChild(ac); return d;
}

function runSearch(){
  var q = $('usrSearch').value.trim().toLowerCase(), box = $('searchResults');
  if(!q){ box.style.display = 'none'; box.textContent = ''; $('tabOnlineUsers').onclick(); return; }
  $('onlineUsersContainer').style.display = $('myFriendsContainer').style.display = 'none'; box.style.display = 'block'; box.textContent = '';
  var now = Date.now(), c = {}, rs = [], id;
  for(id in SEEN) if(now - SEEN[id].seen < 2592e6) c[id] = { name: SEEN[id].name, info: SEEN[id].info, seen: SEEN[id].seen };
  MY_FRIENDS.forEach(function(f){ if(!c[f.uid]) c[f.uid] = { name: f.name, info: null, seen: 0 }; });
  for(id in ONLINE_PLAYERS) c[id] = { name: ONLINE_PLAYERS[id].name, info: ONLINE_PLAYERS[id].info, seen: ONLINE_PLAYERS[id].lastSeen };
  for(id in c){ if(id === UID || BLOCKED[id] || c[id].name.toLowerCase().indexOf(q) < 0) continue; c[id].id = id; c[id].on = !!(ONLINE_PLAYERS[id] && now - ONLINE_PLAYERS[id].lastSeen < 10000); rs.push(c[id]); }
  rs.sort(function(a, b){ return (b.on - a.on) || (b.seen - a.seen); });
  rs.slice(0, 20).forEach(function(u){
    box.appendChild(uItem(u.id, u.name, u.on ? 'متصل الآن' : 'غير متصل' + (u.seen ? ' • ' + ago(u.seen) : ''), [
      u.on ? ['طلب لعب ⚔️', function(){ invitePlayer(u.id, u.name); }] : null,
      u.on && !isFriend(u.id) ? ['+ صديق', function(){ PEND['f' + u.id] = Date.now(); sendDirect(u.id, { t: 'friend_req', name: PF.name }); showToastNotification('تم إرسال طلب الصداقة'); }, 1] : null,
      ['حظر', function(){ blockUser(u.id); runSearch(); }, 1]
    ], u.info, u.on));
  });
  if(!rs.length) box.innerHTML = '<div class="nt" style="text-align:center;padding:20px">لم يتم العثور على مستخدم بهذا الاسم.</div>';
  stag(box);
}

function renderOnlineUsersList(){
  var box = $('onlineUsersContainer'); box.textContent = ''; var now = Date.now(), n = 0;
  for(var uid in ONLINE_PLAYERS){
    var u = ONLINE_PLAYERS[uid]; if(now - u.lastSeen > 10000 || BLOCKED[uid]) continue; n++;
    (function(id, u){ box.appendChild(uItem(id, u.name, 'متصل الآن', [
      ['دعوة ⚔️', function(){ invitePlayer(id, u.name); }],
      ['+ صديق', function(){ PEND['f' + id] = Date.now(); sendDirect(id, { t: 'friend_req', name: PF.name }); showToastNotification('تم إرسال طلب الصداقة'); }, 1]
    ], u.info, true)); })(uid, u);
  }
  if(!n) box.innerHTML = '<div class="nt" style="text-align:center;padding:20px">لا يوجد متصلون حالياً...</div>';
  stag(box);
}

function renderMyFriendsList(){
  var box = $('myFriendsContainer'); box.textContent = ''; var now = Date.now();
  if(!MY_FRIENDS.length){ box.innerHTML = '<div class="nt" style="text-align:center;padding:20px">لا يوجد أصدقاء بعد. أضفهم من البحث أو المتصلين.</div>'; return; }
  MY_FRIENDS.forEach(function(f){
    var on = !!(ONLINE_PLAYERS[f.uid] && now - ONLINE_PLAYERS[f.uid].lastSeen < 10000);
    box.appendChild(uItem(f.uid, f.name, on ? 'متصل الآن' : 'غير متصل', [
      ['محادثة 💬', function(){ openDirectChat(f.uid, f.name); }],
      on ? ['دعوة ⚔️', function(){ invitePlayer(f.uid, f.name); }] : null,
      ['حظر', function(){ blockUser(f.uid); }, 1]
    ], infoOf(f.uid), on));
  });
  stag(box);
}

function invitePlayer(uid, name){
  if(BLOCKED[uid]) return;
  var room = String(100000 + Math.floor(Math.random() * 900000));
  PEND[uid] = { room: room, t: Date.now() };
  sendDirect(uid, { t: 'invite_match', name: PF.name, room: room });
  showToastNotification('تم إرسال الدعوة إلى ' + name);
}

function openDirectChat(friendUid, friendName){
  activeChatFriend = { uid: friendUid, name: friendName };
  delete UNREAD_MSGS[friendUid];
  saveUnread();
  renderMyFriendsList();
  renderOnlineUsersList();
  
  $('dcTitle').textContent = 'محادثة ' + friendName;
  $('dcMessages').innerHTML = '';
  
  if(CHAT_HISTORY[friendUid]){
    CHAT_HISTORY[friendUid].forEach(function(m){
      appendDirectMessage(m.sender === 'me' ? 'أنت' : m.sender, m.msg, m.sender === 'me');
    });
  }
  
  $('friendsModal').classList.remove('on');
  $('directChatModal').classList.add('on');
}

function sendDirectMessage(){
  var inp = $('dcInput'), msg = inp.value.trim();
  if(!msg || !activeChatFriend) return;
  inp.value = '';
  appendDirectMessage('أنت', msg, true);
  saveMessageToHistory(activeChatFriend.uid, activeChatFriend.name, msg, true);
  sendDirect(activeChatFriend.uid, { t: 'direct_msg', name: PF.name, msg: msg });
}

function appendDirectMessage(sender, msg, isMe){
  var box = $('dcMessages');
  var div = document.createElement('div');
  div.className = 'msg-bubble ' + (isMe ? 'me' : 'them');
  div.textContent = sender + ': ' + msg;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

/* ربط نافذة الأصدقاء + بطاقة الخصم + المحادثة المباشرة + البحث */
function initFriends(){
  $('cB').onclick = function(){
    if(mode === 'online' && oppName){
      $('oppCardName').textContent = AV[OPP.av] + ' ' + oppName;
      $('oppCardLevel').textContent = titleOf(OPP.lv) + ' • المستوى ' + OPP.lv + ' • فوز ' + OPP.wr + '% • ' + OPP.pl + ' مباراة';
      $('oppCardModal').classList.add('on');
    }
  };
  $('xOppCard').onclick = function(){ $('oppCardModal').classList.remove('on'); };
  $('bkOppCard').onclick = function(){ $('oppCardModal').classList.remove('on'); };
  $('btnAddFriendOpp').onclick = function(){
    if(!oppUid) return;
    if(isFriend(oppUid)){ showToastNotification('هو صديقك بالفعل'); return; }
    PEND['f' + oppUid] = Date.now(); sendDirect(oppUid, { t: 'friend_req', name: PF.name });
    showToastNotification('تم إرسال طلب الصداقة'); $('oppCardModal').classList.remove('on');
  };
  $('btnFriendsList').onclick = function(){
    cx();
    $('friendsModal').classList.add('on');
    netConnect(function(){ renderOnlineUsersList(); renderMyFriendsList(); });
  };
  $('xFriends').onclick = function(){ $('friendsModal').classList.remove('on'); };
  $('bkFriends').onclick = function(){ $('friendsModal').classList.remove('on'); };
  $('tabOnlineUsers').onclick = function(){
    $('tabOnlineUsers').className = 'btn-sm';
    $('tabMyFriends').className = 'btn-sm sec';
    $('onlineUsersContainer').style.display = 'block';
    $('myFriendsContainer').style.display = 'none';
  };
  $('tabMyFriends').onclick = function(){
    $('tabMyFriends').className = 'btn-sm';
    $('tabOnlineUsers').className = 'btn-sm sec';
    $('myFriendsContainer').style.display = 'block';
    $('onlineUsersContainer').style.display = 'none';
    renderMyFriendsList();
  };
  $('xDirectChat').onclick = function(){ $('directChatModal').classList.remove('on'); activeChatFriend = null; };
  $('bkDirectChat').onclick = function(){ $('directChatModal').classList.remove('on'); activeChatFriend = null; };
  $('dcSend').onclick = sendDirectMessage;
  $('dcInput').onkeydown = function(e){
    if(e.key === 'Enter') sendDirectMessage();
    else if(activeChatFriend && Date.now() - lastTyp > 1500){ lastTyp = Date.now(); sendDirect(activeChatFriend.uid, { t: 'typing' }); }
  };
  $('btnInviteDirectMatch').onclick = function(){
    if(activeChatFriend){
      invitePlayer(activeChatFriend.uid, activeChatFriend.name);
    }
  };
  $('usrSearch').oninput = runSearch;
}
