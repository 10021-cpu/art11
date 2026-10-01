(() => {
  'use strict';
  const SIZE = 300, TIME = 30, CELL = 5, TOL = 1; // ตารางตรวจคะแนน 60x60, ยอมคลาดเคลื่อน 1 ช่อง
  const $ = (id) => document.getElementById(id);
  const target = $('targetCanvas'), draw = $('drawCanvas');
  const tctx = target.getContext('2d'), dctx = draw.getContext('2d', { willReadFrequently: true });

  // ---------- แบบให้วาด 5 ด่าน (เส้นหนา 10px) ----------
  const LEVELS = [
    { name: 'วงกลม', fn: (c) => { c.arc(150, 150, 90, 0, Math.PI * 2); } },
    { name: 'สามเหลี่ยม', fn: (c) => { c.moveTo(150, 55); c.lineTo(250, 235); c.lineTo(50, 235); c.closePath(); } },
    { name: 'บ้าน', fn: (c) => { c.rect(70, 140, 160, 110); c.moveTo(55, 145); c.lineTo(150, 60); c.lineTo(245, 145);
      c.moveTo(130, 250); c.lineTo(130, 190); c.lineTo(170, 190); c.lineTo(170, 250); } },
    { name: 'ดาว', fn: (c) => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5;
      const x = 150 + 100 * Math.cos(a), y = 160 + 100 * Math.sin(a); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); } },
    { name: 'หน้ายิ้ม', fn: (c) => { c.arc(150, 150, 100, 0, Math.PI * 2); c.moveTo(120, 115); c.arc(110, 115, 10, 0, Math.PI * 2);
      c.moveTo(200, 115); c.arc(190, 115, 10, 0, Math.PI * 2); c.moveTo(95, 175); c.arc(150, 165, 60, 0.3, Math.PI - 0.3); } },
  ];

  function paintShape(ctx, lvl, color, width) {
    ctx.save(); ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); LEVELS[lvl].fn(ctx); ctx.stroke(); ctx.restore();
  }

  // ---------- สถานะเกม ----------
  let level = 0, timeLeft = TIME, timer = null, running = false, scores = [];
  let color = '#000000', size = 5, erasing = false, drawing = false, last = null;
  const best = () => +localStorage.getItem('copyDrawBest') || 0;
  const showBest = () => { $('bestScore').textContent = best() ? `สถิติสูงสุด: ${best()}%` : 'สถิติสูงสุด: -'; };

  function startLevel() {
    dctx.clearRect(0, 0, SIZE, SIZE);
    // แสดงแบบเป็นสีเทาเข้มบนพื้นขาว
    tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, SIZE, SIZE);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = SIZE;
    paintShape(tmp.getContext('2d'), level, '#334155', 10); tctx.drawImage(tmp, 0, 0);
    $('levelBadge').textContent = `ด่านที่ ${level + 1} / ${LEVELS.length}`;
    timeLeft = TIME; updateTimer(); running = true;
    clearInterval(timer);
    timer = setInterval(() => { if (--timeLeft <= 0) finish(true); else updateTimer(); }, 1000);
  }

  function updateTimer() {
    $('timerLabel').textContent = `⏱️ เวลาเหลือ: ${timeLeft} วินาที`;
    const f = $('progressFill'); f.style.width = (timeLeft / TIME * 100) + '%';
    f.classList.toggle('warn', timeLeft <= 15 && timeLeft > 7);
    f.classList.toggle('danger', timeLeft <= 7);
  }

  // ---------- ระบบคะแนน: เทียบตารางจุด (precision + recall → F1) ----------
  function grid(ctx) {
    const d = ctx.getImageData(0, 0, SIZE, SIZE).data, n = SIZE / CELL, g = new Uint8Array(n * n);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
      if (d[(y * SIZE + x) * 4 + 3] > 40) g[((y / CELL) | 0) * n + ((x / CELL) | 0)] = 1;
    return g;
  }
  const near = (g, n, x, y) => {
    for (let dy = -TOL; dy <= TOL; dy++) for (let dx = -TOL; dx <= TOL; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < n && yy < n && g[yy * n + xx]) return true;
    } return false;
  };
  function score() {
    const tc = document.createElement('canvas'); tc.width = tc.height = SIZE;
    const t = tc.getContext('2d', { willReadFrequently: true }); paintShape(t, level, '#000', 10);
    const T = grid(t), U = grid(dctx), n = SIZE / CELL;
    let tn = 0, un = 0, hit = 0, ok = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (T[y * n + x]) { tn++; if (near(U, n, x, y)) hit++; }
      if (U[y * n + x]) { un++; if (near(T, n, x, y)) ok++; }
    }
    if (!un || !tn) return 0;
    const r = hit / tn, p = ok / un;
    return Math.round(200 * p * r / (p + r) || 0) / 2 | 0;
  }

  // ---------- จบด่าน / สรุปผล ----------
  function finish(timeUp) {
    if (!running) return; running = false; clearInterval(timer);
    const s = Math.min(100, score()); scores.push(s);
    const last = level === LEVELS.length - 1;
    $('modalTitle').textContent = timeUp ? 'หมดเวลา! ⏰' : 'ส่งผลงานแล้ว 🚀';
    setScore(s);
    $('modalDesc').textContent = (s >= 80 ? 'ยอดเยี่ยม! เหมือนมาก 🎉' : s >= 50 ? 'ใช้ได้เลย ลองอีกนิด 👍' : 'ยังไม่เหมือนนัก ด่านหน้าสู้ใหม่ 💪') + ` (${LEVELS[level].name})`;
    $('nextBtn').textContent = last ? 'ดูคะแนนรวม 🏆' : 'ไปด่านถัดไป ➔';
    $('resultModal').classList.add('show');
  }
  function setScore(s) {
    const c = document.querySelector('.score-circle'); $('scoreText').textContent = s + '%';
    c.className = 'score-circle ' + (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');
  }
  function next() {
    if (level < LEVELS.length - 1) { level++; $('resultModal').classList.remove('show'); startLevel(); return; }
    if ($('nextBtn').dataset.end) { restart(); return; }
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    if (avg > best()) { localStorage.setItem('copyDrawBest', avg); showBest(); }
    $('modalTitle').textContent = 'สรุปผลทั้งหมด 🏆'; setScore(avg);
    $('modalDesc').textContent = 'คะแนนแต่ละด่าน: ' + scores.map((s) => s + '%').join(' · ');
    $('nextBtn').textContent = 'เล่นอีกครั้ง 🔄'; $('nextBtn').dataset.end = '1';
  }
  function restart() {
    delete $('nextBtn').dataset.end; level = 0; scores = [];
    $('resultModal').classList.remove('show'); startLevel();
  }

  // ---------- การวาด (เมาส์/นิ้ว/ปากกา) ----------
  const pos = (e) => { const r = draw.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };
  function stroke(a, b) {
    dctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    dctx.strokeStyle = color; dctx.lineWidth = size; dctx.lineCap = dctx.lineJoin = 'round';
    dctx.beginPath(); dctx.moveTo(a.x, a.y); dctx.lineTo(b.x, b.y); dctx.stroke();
  }
  draw.addEventListener('pointerdown', (e) => { if (!running) return; drawing = true; draw.setPointerCapture(e.pointerId);
    last = pos(e); stroke(last, { x: last.x + .01, y: last.y }); });
  draw.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); stroke(last, p); last = p; });
  ['pointerup', 'pointercancel'].forEach((ev) => draw.addEventListener(ev, () => { drawing = false; }));

  $('colorPicker').oninput = (e) => { color = e.target.value; erasing = false; $('eraserBtn').classList.remove('active'); };
  $('brushSize').oninput = (e) => { size = +e.target.value; $('brushSizeVal').textContent = size + 'px'; };
  $('eraserBtn').onclick = () => { erasing = !erasing; $('eraserBtn').classList.toggle('active', erasing); };
  $('clearBtn').onclick = () => dctx.clearRect(0, 0, SIZE, SIZE);
  $('submitBtn').onclick = () => finish(false);
  $('nextBtn').onclick = next;

  // ---------- ปุ่มติดตั้ง PWA ----------
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBtn').hidden = false; });
  $('installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('installBtn').hidden = true; };
  window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });

  showBest(); startLevel();
})();
