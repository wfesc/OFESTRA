/* ============================================================
 * audio.js
 * الصوت والاهتزاز: AudioContext، توليد النغمات، كائن المؤثرات X
 * يعتمد على: core.js, storage.js (S)
 * ============================================================ */

var AC;

function cx(){ try{ if(!AC) AC = new(window.AudioContext||window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume(); }catch(e){} return AC; }

function vibrate(ms){
  if(S.vib && navigator.vibrate){
    try { navigator.vibrate(ms || 40); } catch(e){}
  }
}

/* Sound synthesis with Boosted Gain Volume */

function tn(f, d, v, to, dl){
  if(!S.snd) return; var c = cx(); if(!c) return;
  var userVol = (S.sfxVol !== undefined ? S.sfxVol : 1.0);
  var vol = (v || 0.1) * userVol * 2.8;
  if(vol <= 0) return;
  var t = c.currentTime + (dl||0), o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f, t);
  if(to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.min(vol, 1.0), t + .02);
  g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + d + .05);
}

function softChord(freqs, d, v){ freqs.forEach(function(f, i){ tn(f, d, v, 0, i * .04); }); }

var X = {
  sel: function(p){ vibrate(30); tn(p==='B'?320:440, .15, .15, p==='B'?280:580); },
  put: function(p){ vibrate(50); tn(p==='B'?180:220, .2, .25, 80); softChord(p==='B'?[200,300]:[300,420], .22, .1); },
  mov: function(p){ vibrate(40); tn(p==='B'?240:320, .22, .15, p==='B'?580:720); },
  hb: function(v){ vibrate(60); tn(68, .12, v||.25, 44); },
  out: function(){ vibrate(80); tn(220, .3, .2, 90); },
  pt: function(){ tn(300, .12, .15, 160); },
  ui: function(){ tn(580, .06, .12, 800); },
  sw: function(){ tn(480, .05, .12, 720); },
  win: function(){ vibrate([80, 80, 150]); softChord([440,554,659,880], .7, .2); },
  lose: function(){ vibrate(120); softChord([349,311,277,220], .6, .18); },
  emoji: function(){ vibrate(25); softChord([440,587,740], .18, .15); }
};
