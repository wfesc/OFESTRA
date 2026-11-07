/* ============================================================
 * ai.js
 * الذكاء الاصطناعي: توليد الحركات، Minimax مع Alpha-Beta، مستويات الصعوبة، نافذة اختيار المستوى
 * يعتمد على: core.js, game.js
 * ============================================================ */

function moves(b, p, pc){
  var e = [], r = [];
  b.forEach(function(v, k){ if(!v) e.push(k); });
  if(pc[p] < 3) e.forEach(function(t){ r.push([-1, t]); });
  else b.forEach(function(v, k){ if(v === p) e.forEach(function(t){ r.push([k, t]); }); });
  return r;
}

function heur(b){
  var s = 0;
  LINES.forEach(function(l){
    var r = 0, u = 0;
    l.forEach(function(k){ if(b[k]==='R') r++; else if(b[k]==='B') u++; });
    if(!r && u === 2) s += 4; if(!u && r === 2) s -= 4;
  });
  return s;
}

function srch(b, pc, p, d, a, be){
  if(check(b, 'B')) return 100 + d;
  if(check(b, 'R')) return -100 - d;
  if(!d) return heur(b);
  var ms = moves(b, p, pc), best = p === 'B' ? -1e9 : 1e9;
  for(var i = 0; i < ms.length; i++){
    var m = ms[i], nb = b.slice(), np = { R: pc.R, B: pc.B };
    if(m[0] < 0) np[p]++; else nb[m[0]] = null; nb[m[1]] = p;
    var v = srch(nb, np, other(p), d - 1, a, be);
    if(p === 'B'){ if(v > best) best = v; if(best > a) a = best; }
    else { if(v < best) best = v; if(best < be) be = best; }
    if(a >= be) break;
  }
  return best;
}

function aiMove(){
  if(over || ended || inRoundTransition || turn !== 'B' || screen !== 'game') return;
  var ms = moves(board, 'B', placed); if(!ms.length) return;
  var rate = PF.played ? PF.w / PF.played : .5;
  var C = ({ easy: [1, .45], medium: [2, .15], hard: [5, 0], adaptive: [rate > .6 ? 5 : (rate > .4 ? 3 : 2), rate > .6 ? 0 : .12] })[diff] || [3, 0];
  var pick, bs = -1e9, c = [];
  if(Math.random() < C[1]){ pick = ms[Math.floor(Math.random() * ms.length)]; }
  else {
    ms.forEach(function(m){
      var nb = board.slice(), np = { R: placed.R, B: placed.B };
      if(m[0] < 0) np.B++; else nb[m[0]] = null; nb[m[1]] = 'B';
      var v = srch(nb, np, 'R', C[0] - 1, -1e9, 1e9);
      if(v > bs){ bs = v; c = [m]; } else if(v === bs) c.push(m);
    });
    pick = c[Math.floor(Math.random() * c.length)];
  }
  apply(pick);
}

/* ربط نافذة اختيار مستوى الذكاء الاصطناعي */
function initAI(){
  $('btnAiStart').onclick = function(){ cx(); $('aiModal').classList.add('on'); };
  $('xAi').onclick = function(){ $('aiModal').classList.remove('on'); };
  $('bkAi').onclick = function(){ $('aiModal').classList.remove('on'); };
  document.querySelectorAll('.ai-choice-btn[data-diff]').forEach(function(btn){
    btn.onclick = function(){ diff = btn.getAttribute('data-diff'); $('aiModal').classList.remove('on'); start('ai'); };
  });
}
