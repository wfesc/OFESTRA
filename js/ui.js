/* ============================================================
 * ui.js
 * واجهة المستخدم العامة: الإشعارات، الإيموجي، شات المباراة، شارة اللاعب، النوافذ، تأثير الضغط، زر الرجوع، ملاءمة اللوحة
 * يعتمد على: core.js, storage.js, audio.js, game.js
 * ============================================================ */

var toastT = 0; /* مؤقّت الإشعار */

function showToastNotification(text, onA, onD){
  var el = $('toastNotif'); $('toastText').textContent = text;
  $('toastBtns').style.display = (onA || onD) ? 'flex' : 'none';
  el.classList.add('show'); X.ui(); clearTimeout(toastT);
  var hide = function(){ el.classList.remove('show'); };
  toastT = setTimeout(hide, (onA || onD) ? 15000 : 3500);
  $('toastAccept').onclick = function(){ clearTimeout(toastT); hide(); if(onA) onA(); };
  $('toastDecline').onclick = function(){ clearTimeout(toastT); hide(); if(onD) onD(); };
}

function triggerEmojiEffect(emo, p){
  X.emoji();
  var box = $('sq' + p);
  if(box){
    box.innerHTML = '<span class="emo-avatar">' + EMOJI_MAP[emo] + '</span>';
    box.classList.add('shake-chip');
    setTimeout(function(){ box.innerHTML = ''; refresh(); box.classList.remove('shake-chip'); }, 3000);
  }
}

function sendChatMsg(){
  var inp = $('chatInp'), msg = inp.value.trim().slice(0, 28);
  if(!msg) return; inp.value = '';
  showChatBanner(PF.name, msg);
  if(mode === 'online') gsend({ t: 'chat', msg: msg });
}

function showChatBanner(n, m){
  var box = $('chatBannerBox'); box.textContent = '';
  var d = document.createElement('div'); d.className = 'chat-banner'; d.textContent = n + ': ' + m; box.appendChild(d);
  clearTimeout(showChatBanner.t); showChatBanner.t = setTimeout(function(){ box.textContent = ''; }, 5000);
}

function chipDecor(p){
  var me = (mode === 'online' ? myRole : 'R'), e, lv = null;
  if(p === me){ e = AV[PF.av]; lv = calcLv().lv; }
  else if(mode === 'online'){ e = AV[OPP.av]; lv = OPP.lv; }
  else if(mode === 'ai'){ e = '🤖'; lv = ({ easy: 3, medium: 8, hard: 15, adaptive: calcLv().lv })[diff] || 10; }
  else e = '👤';
  var box = $('sq' + p); if(!box.querySelector('.emo-avatar')) box.textContent = e;
  if(lv){ var s = document.createElement('span'); s.className = 'lvp'; s.textContent = 'Lv ' + lv; $('n' + p).appendChild(s); }
}

function fitBoard(){
  var k = Math.min(1, (window.innerWidth - 28) / 360);
  boardBox.style.width = '360px'; boardBox.style.transformOrigin = 'top center';
  boardBox.style.transform = k < 1 ? 'scale(' + k + ')' : ''; boardBox.style.marginBottom = k < 1 ? (-360 * (1 - k)) + 'px' : '';
}

/* ربط عناصر الواجهة العامة (شات، خروج من المباراة، إيموجي، شرح اللعبة، ripple، زر الرجوع) */
function initUI(){
  $('chatSend').onclick = sendChatMsg;
  $('chatInp').onkeydown = function(e){ if(e.key === 'Enter') sendChatMsg(); };
  $('bHome').onclick = function(){
    cx(); X.sw();
    if(screen === 'game'){ $('ingameModal').classList.add('on'); }
    else { openProf(); }
  };
  $('ingameCancel').onclick = function(){ $('ingameModal').classList.remove('on'); };
  $('btnSurrender').onclick = function(){
    $('ingameModal').classList.remove('on');
    if(mode === 'online') gsend({ t: 'sur' });
    endMatch('surrender', mode === 'online' ? other(myRole) : (mode === 'ai' ? 'B' : other(turn)));
  };
  $('bkIngame').onclick = function(){ $('ingameModal').classList.remove('on'); };
  $('emojiToggle').onclick = function(e){ e.stopPropagation(); $('emojiPicker').classList.toggle('open'); };
  document.addEventListener('click', function(e){ if(!e.target.closest('#emojiWrap')) $('emojiPicker').classList.remove('open'); });
  document.querySelectorAll('#emojiPicker span').forEach(function(sp){
    sp.onclick = function(){
      var emo = sp.getAttribute('data-e');
      if(mode === 'online'){ gsend({ t: 'em', e: emo }); triggerEmojiEffect(emo, myRole); }
      else triggerEmojiEffect(emo, turn);
      $('emojiPicker').classList.remove('open');
    };
  });
  document.addEventListener('pointerdown', function(e){
    var t = e.target.closest && e.target.closest('.m,.big,.btn-sm,.ai-choice-btn,.ib,.chat-send-btn,.emoji-btn'); if(!t) return;
    var r = t.getBoundingClientRect(), z = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'rpl'; s.style.cssText = 'width:' + z + 'px;height:' + z + 'px;left:' + (e.clientX - r.left - z / 2) + 'px;top:' + (e.clientY - r.top - z / 2) + 'px';
    if(getComputedStyle(t).position === 'static') t.style.position = 'relative'; t.style.overflow = 'hidden';
    t.appendChild(s); setTimeout(function(){ s.remove(); }, 650);
  });
  document.querySelectorAll('#home,#rows,.md,.pn').forEach(stag);
  window.ofBack = function(){
    var ids = ['directChatModal','friendsModal','oppCardModal','onModal','aiModal','howModal','sheet','prof','ingameModal'];
    for(var i = 0; i < ids.length; i++){
      var el = $(ids[i]);
      if(el.classList.contains('on')){
        el.classList.remove('on'); document.body.classList.remove('so');
        if(ids[i] === 'onModal') netCancel(); if(ids[i] === 'directChatModal') activeChatFriend = null;
        return true;
      }
    }
    if($('end').classList.contains('on')){ $('eH').onclick(); return true; }
    if(screen === 'game'){ $('ingameModal').classList.add('on'); return true; }
    return false;
  };
  window.addEventListener('resize', fitBoard); fitBoard();
  $('btnHow').onclick = function(){ cx(); X.ui(); $('howModal').classList.add('on'); };
  $('xHow').onclick = $('bkHow').onclick = function(){ $('howModal').classList.remove('on'); };
}
