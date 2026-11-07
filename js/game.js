/* ============================================================
 * game.js
 * منطق اللعبة: الحالة، الأدوار، المؤقت، الحركات، الجولات، نهاية المباراة، رسم اللوحة (refresh)
 * يعتمد على: core.js, storage.js, audio.js (+ ai.js / online.js / ui.js وقت التشغيل)
 * ============================================================ */

var boardBox = $('boardBox');

var nodeRings = [];

var els = { R: [], B: [] };

/* حالة اللعبة */
var mode = 'friend', diff = 'hard', pos, board, placed, turn = 'R', sel = null, oppSel = null, win = null, over = false, ended = false;

var score = { R: 0, B: 0 }, L = { R: 0, B: 0 }, starter = 'R', screen = 'home', armed = false, deadline = 0, mRem = 9e5;

var lastQ = 0, last = performance.now(), ct = '', fx = false, gid = 0;

var currentRound = 1, maxRounds = 6, inRoundTransition = false;

var tid = 0; /* معرّف الدور الحالي */

/* بناء عناصر اللوحة (النقاط + القطع) داخل الـ DOM — تُستدعى من main.js */
function buildBoard(){
  P.forEach(function(p, k){
    var nd = document.createElement('div');
    nd.className = 'board-node'; nd.style.left = p[0] + 'px'; nd.style.top = p[1] + 'px';
    boardBox.appendChild(nd);

    var rng = document.createElement('div');
    rng.className = 'board-node-ring'; rng.style.left = p[0] + 'px'; rng.style.top = p[1] + 'px';
    boardBox.appendChild(rng); nodeRings.push(rng);

    var hit = document.createElement('div');
    hit.className = 'board-hit-area'; hit.style.left = p[0] + 'px'; hit.style.top = p[1] + 'px';
    hit.addEventListener('click', function(){ click(k); });
    boardBox.appendChild(hit);
  });
  ['R','B'].forEach(function(p){
    for(var n = 0; n < 3; n++){
      var pc = document.createElement('div');
      pc.className = 'piece-card ' + p;
      boardBox.appendChild(pc);
      els[p].push(pc);
    }
  });
}

function nm(p){
  if(mode === 'online') return p === myRole ? (PF.name || 'أنت') : (oppName || 'الخصم');
  return mode === 'ai' ? (p === 'R' ? (PF.name || 'أنت') : 'الذكاء الاصطناعي') : (p === 'R' ? 'اللاعب ١' : 'اللاعب ٢');
}

function derive(){
  board = Array(9).fill(null); placed = { R: 0, B: 0 };
  ['R','B'].forEach(function(p){ pos[p].forEach(function(k){ if(k >= 0){ board[k] = p; placed[p]++; } }); });
}

function check(b, p){
  for(var i = 0; i < 6; i++){ var l = LINES[i]; if(b[l[0]]===p && b[l[1]]===p && b[l[2]]===p) return l; }
  return null;
}

function paused(){ return screen !== 'game' || ended || inRoundTransition || $('ingameModal').classList.contains('on'); }

function human(){ return !over && !ended && !inRoundTransition && screen === 'game' && (mode === 'online' ? turn === myRole : (mode === 'ai' ? turn === 'R' : true)); }

function show(s){
  screen = s;
  $('home').classList.toggle('on', s === 'home');
  $('game').classList.toggle('on', s === 'game');
  $('clk').classList.toggle('show', s === 'game');
  $('bSet').style.display = (s === 'game' ? 'none' : 'inline-flex');
  $('emojiWrap').style.display = (s === 'game' ? 'block' : 'none');
  $('chatInputWrap').style.display = (s === 'game' && mode === 'online' ? 'flex' : 'none');
  if(s === 'home') fxOff();
}

function start(m, fs){
  mode = m; if(m !== 'online'){ myRole = 'R'; oppName = ''; oppUid = ''; OPP = { av: 0, lv: 1, wr: 0, pl: 0 }; } paint();
  score = { R: 0, B: 0 }; L = { R: 0, B: 0 }; mRem = 9e5; ended = false; currentRound = 1;
  starter = fs || (Math.random() < 0.5 ? 'R' : 'B');
  $('end').classList.remove('on');
  show('game');
  round();
}

function round(){
  gid++; pos = { R: [-1,-1,-1], B: [-1,-1,-1] }; over = false; win = null; sel = null; oppSel = null; derive();
  $('rdBadge').textContent = 'الجولة ' + currentRound + ' من ' + maxRounds;
  setTurn(starter);
  starter = other(starter);
}

function arm(){
  armed = !over && !ended && !inRoundTransition;
  lastQ = 99; deadline = performance.now() + 30000;
  $('tm').classList.toggle('off', !armed);
  $('fill').style.transform = 'scaleX(1)';
  $('fill').style.background = 'var(--ok)';
  $('sec').textContent = armed ? 30 : '—';
  if(!armed) fxOff();
}

function setTurn(p){
  tid++; turn = p; sel = null; oppSel = null; derive(); arm(); refresh();
  if(over || ended || inRoundTransition) return;
  if(mode === 'ai' && p === 'B'){
    var g = gid;
    setTimeout(function(){ if(g === gid && !ended && !inRoundTransition) aiMove(); }, 600 + Math.random()*300);
  }
}

function fxOff(){ if(fx){ vig.style.opacity = 0; vig.classList.remove('vig-tremble'); fx = false; } }

function frame(now){
  var dt = Math.min(now - last, 100); last = now;
  var ps = paused();
  if(!ps && screen === 'game' && !ended){ mRem -= dt; if(mRem <= 0){ mRem = 0; endMatch('completed'); } }
  var s = Math.ceil(mRem/1000), t = Math.floor(s/60) + ':' + ('0' + s%60).slice(-2);
  if(t !== ct){ ct = t; $('clkT').textContent = t; $('clk').classList.toggle('low', mRem < 6e4 && screen === 'game'); }
  
  if(armed && !ps){
    var r = deadline - now, f = $('fill'), q = Math.ceil(r/1000);
    f.style.transform = 'scaleX(' + Math.max(0, r/3e4) + ')';
    f.style.background = r < 1e4 ? 'var(--bad)' : 'var(--ok)';
    if(q !== lastQ) $('sec').textContent = Math.max(q, 0);
    
    if(q <= 10 && q > 0){
      fx = true;
      var intensity = (10 - q) / 10;
      vig.style.opacity = 0.2 + intensity * 0.6;
      vig.classList.add('vig-tremble');
      if(q !== lastQ) X.hb(0.2 + intensity*0.3);
    } else {
      fxOff();
    }
    lastQ = q;
    if(r <= 0){ armed = false; fxOff();
      if(mode !== 'online'){ timeout(); }
      else if(turn === myRole){ gsend({t:'to'}); timeout(); }
      else { var t0 = tid; setTimeout(function(){ if(t0 === tid && !ended && !over && !inRoundTransition) timeout(); }, 4000); } }
  } else fxOff();
  requestAnimationFrame(frame);
}

function timeout(){
  var p = turn, f = $('flash'); X.out();
  f.textContent = (mode === 'online' ? (p === myRole ? 'خسرت دورك' : 'خسر الخصم دوره') : (mode==='ai'&&p==='R' ? 'خسرت دورك' : 'خسر ' + nm(p) + ' دوره'));
  f.className = 'on';
  setTimeout(function(){ f.className = ''; L[p]++; X.pt(); refresh(); }, 1000);
  setTurn(other(p));
}

function click(k){
  if(!human()) return; cx();
  if(placed[turn] < 3){
    if(!board[k]) apply([-1, k]);
    return;
  }
  if(board[k] === turn){
    sel = (sel === k) ? null : k;
    X.sel(turn);
    if(mode === 'online') {
      gsend({ t: 'sel', sel: sel });
    }
    refresh();
  } else if(!board[k] && sel !== null){
    apply([sel, k]);
  }
}

function apply(m){
  if(mode === 'online' && turn === myRole) gsend({ t: 'mv', m: m });
  var p = turn, n = m[0] < 0 ? pos[p].indexOf(-1) : pos[p].indexOf(m[0]);
  pos[p][n] = m[1]; derive(); sel = null; oppSel = null;
  if(m[0] < 0) setTimeout(function(){ X.put(p); }, 200); else X.mov(p);
  var l = check(board, p);
  if(l){
    over = true; win = l; score[p]++; arm(); refresh();
    setTimeout(function(){ (mode === 'ai' && p === 'B' ? X.lose : X.win)(); }, 350);
    setTimeout(function(){ handleRoundEnd(p); }, 1400);
    return;
  }
  setTurn(other(p));
}

function handleRoundEnd(winner){
  if(ended) return;
  if(currentRound < maxRounds){
    currentRound++; inRoundTransition = true; armed = false;
    $('rdNoticeTitle').textContent = currentRound === maxRounds ? "الجولة السادسة والحاسمة!" : "الجولة " + currentRound;
    $('rdNoticeCnt').textContent = "3"; $('roundNotice').classList.add('on');
    var c = 3;
    var interval = setInterval(function(){
      if(ended){ clearInterval(interval); $('roundNotice').classList.remove('on'); inRoundTransition = false; return; }
      c--;
      if(c > 0){ $('rdNoticeCnt').textContent = c; }
      else { clearInterval(interval); $('roundNotice').classList.remove('on'); inRoundTransition = false; round(); }
    }, 1000);
  } else { endMatch('completed'); }
}

function refresh(){
  var activeSel = sel;
  var oppActiveSel = oppSel;

  ['R','B'].forEach(function(p){
    pos[p].forEach(function(k, n){
      var e = els[p][n], xy = k >= 0 ? P[k] : [96 + n*60, p === (mode === 'online' ? myRole : 'R') ? 340 : 16];
      e.style.left = xy[0] + 'px'; e.style.top = xy[1] + 'px';
      e.classList.toggle('on', k >= 0);
      
      var isMySelection = (k >= 0 && p === turn && activeSel === k);
      var isOppSelection = (k >= 0 && p === other(turn) && oppActiveSel === k);
      
      e.classList.toggle('sel', isMySelection);
      e.classList.toggle('selected-pulse', isMySelection || isOppSelection);
    });
  });

  var h = human() && (placed[turn] < 3 || sel !== null);
  nodeRings.forEach(function(r, k){ r.classList.toggle('hint', h && !board[k]); });
  
  var wLine = $('winLineBar');
  if(win){
    var p1 = P[win[0]], p2 = P[win[2]];
    var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    var len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    wLine.style.width = len + 'px'; wLine.style.left = p1[0] + 'px'; wLine.style.top = p1[1] + 'px';
    wLine.style.transform = 'rotate(' + ang + 'deg)'; wLine.classList.add('on');
  } else wLine.classList.remove('on');

  ['R','B'].forEach(function(p){
    $('n' + p).textContent = nm(p); chipDecor(p);
    $('s' + p).textContent = score[p];
    $('l' + p).textContent = L[p];
    $('c' + p).classList.toggle('act', !over && turn === p);
  });
  
  var s;
  if(over){ s = (turn === (mode === 'online' ? myRole : 'R')) ? '🏆 فزت بهذه الجولة!' : '🏆 فاز ' + nm(turn) + ' بهذه الجولة!'; }
  else if(mode === 'online' && turn !== myRole){ s = 'بانتظار حركة ' + nm(turn) + '...'; }
  else if(mode === 'ai' && turn === 'B'){ s = 'الذكاء الاصطناعي يفكر...'; }
  else {
    s = ((mode === 'ai' || mode === 'online') ? 'دورك' : 'دور ' + nm(turn)) + ' — ' + (placed[turn] < 3 ? 'ضع مربعاً (' + (placed[turn]+1) + '/3)' : (sel === null ? 'اختر مربعك' : 'اختر أي نقطة فارغة'));
  }
  $('status').textContent = s;
}

function endMatch(reason, winnerOverride){
  if(ended) return; ended = true; armed = false; fxOff();
  if(ONL.dcTimer) clearInterval(ONL.dcTimer);
  if(ONL.quickSearchTimer) clearTimeout(ONL.quickSearchTimer);
  var title = "", body = "", wr = null;
  if(reason === 'disconnect'){
    title = '🏆 فزت بالمباراة!';
    body = 'انقطع اتصال الخصم لأكثر من 15 ثانية، فاعتُبر خاسراً وفزت بالمباراة!';
    wr = myRole;
  } else if(reason === 'surrender'){
    wr = winnerOverride;
    title = (wr === (mode === 'online' ? myRole : 'R')) ? '🏆 فزت بالمباراة!' : 'فاز الخصم!';
    body = 'استسلم اللاعب وأنهى المباراة.';
  } else {
    var winR = score.R, winB = score.B, lossR = L.R, lossB = L.B;
    if(winR > winB) wr = 'R'; else if(winB > winR) wr = 'B'; else if(lossR < lossB) wr = 'R'; else if(lossB < lossR) wr = 'B';
    if(wr === null){ title = 'تعادل تام!'; body = 'تساوت نقاط الفوز وخسائر الأدوار!'; }
    else {
      title = (wr === (mode === 'online' ? myRole : 'R')) ? '🏆 فزت بالمباراة!' : 'فاز ' + nm(wr);
      body = 'النتيجة النهائية: ' + nm('R') + ' (' + winR + ') - ' + nm('B') + ' (' + winB + ')';
    }
  }
  $('eT').textContent = title; $('eB').textContent = body;
  $('end').classList.add('on'); REM.me = REM.opp = false;
  $('eN').textContent = 'لعب مرة أخرى'; $('eN').style.display = (mode === 'online' && reason !== 'completed') ? 'none' : '';
  if(wr === (mode === 'online' ? myRole : 'R')) X.win(); else X.lose();
  var me = (mode === 'online' ? myRole : 'R'); if(mode === 'ai' || mode === 'online'){ if(wr === me) PF.w++; else if(wr) PF.l++; else PF.d++; PF.played++; savePF(); }
  refresh();
}

/* ربط أزرار نهاية المباراة ووضع اللعب مع صديق على نفس الجهاز */
function initGame(){
  $('eN').onclick = function(){
    if(mode !== 'online'){ $('end').classList.remove('on'); start(mode); return; }
    REM.me = true; gsend({ t: 'rematch' }); $('eN').textContent = 'بانتظار الخصم...'; checkRematch();
  };
  $('eH').onclick = function(){
    $('end').classList.remove('on');
    if(mode === 'online'){ gsend({ t: 'left' }); leaveRoom(); }
    show('home');
  };
  document.querySelectorAll('.m[data-m]').forEach(function(b){
    b.onclick = function(){ cx(); start(b.getAttribute('data-m')); };
  });
}
