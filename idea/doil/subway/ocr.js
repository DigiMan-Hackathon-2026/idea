/* SubStamp GO — camera + on-device OCR
 *
 * Engine order:
 *  1. TextDetector (Shape Detection API)
 *     - iPhone / iPad Safari: WebKit runs it on Apple Vision (VNRecognizeTextRequest), on the device.
 *       Needs Settings → Apps → Safari → Advanced → Feature Flags → "Shape Detection API" ON.
 *     - Mac Chrome: also Apple Vision. Needs chrome://flags/#enable-experimental-web-platform-features
 *  2. Tesseract.js (WebAssembly, kor+eng). Also runs in the browser; only the engine/language data is downloaded once.
 * If engine 1 returns no Hangul, engine 2 is tried on the same frame.
 * Images never leave the device.
 */
(function(){
  const $ = s => document.querySelector(s);
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const APPLE = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

  /* Line 2 at Sindorim, going to Hongik Univ.
     ok = outer loop (Mullae / Hapjeong side), ng = inner loop or the Kkachisan branch */
  const KW = {
    ok:['문래','영등포구청','당산','합정','홍대입구','홍대','외선','mullae','yeongdeungpo','dangsan','hapjeong','hongik'],
    ng:['대림','구로디지털단지','구로','신대방','신림','내선','까치산','도림천','양천구청','daerim','guro','sindaebang','sillim','kkachisan','dorimcheon'],
  };

  let stream = null, starting = null, engine = null, tess = null, tessLoading = null, onProgress = null;
  const video = () => $('#cam');

  /* ---------- camera ---------- */
  async function start(){
    if (stream) return true;
    if (starting) return starting;
    const vf = $('#vf');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ setMsg('camNone'); return false; }
    setMsg('camStarting');
    starting = (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video:{ facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080} }, audio:false });
        // user may have left the screen while the permission prompt was open
        if (S.cur !== 'scan' || S.scanMode !== 'cam'){ s.getTracks().forEach(t => t.stop()); return false; }
        stream = s;
        const v = video(); v.srcObject = s; await v.play().catch(()=>{});
        vf.classList.add('live'); setMsg(null);
        return true;
      } catch(e){
        setMsg(e && e.name === 'NotAllowedError' ? 'camDenied' : 'camNone');
        return false;
      } finally { starting = null; }
    })();
    return starting;
  }
  function stop(){
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    const v = video(); if (v) v.srcObject = null;
    const vf = $('#vf'); if (vf) vf.classList.remove('live');
  }
  function setMsg(key){
    const m = $('#camMsg'); if (!m) return;
    m.dataset.k = key || ''; m.innerHTML = key ? t(key) : ''; m.classList.toggle('show', !!key);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (S.cur === 'scan' && S.scanMode === 'cam') start();
  });

  /* ---------- frame capture ---------- */
  // crop to the white corner guide, mapping CSS pixels back through object-fit:cover
  function grabFrame(){
    const v = video(), vw = v.videoWidth, vh = v.videoHeight;
    if (!vw) return null;
    const box = $('#vf').getBoundingClientRect(), g = $('#vf .corners').getBoundingClientRect();
    const k = Math.max(box.width / vw, box.height / vh);
    const ox = (box.width - vw * k) / 2, oy = (box.height - vh * k) / 2;
    let sx = (g.left - box.left - ox) / k, sy = (g.top - box.top - oy) / k, sw = g.width / k, sh = g.height / k;
    sx = Math.max(0, sx); sy = Math.max(0, sy); sw = Math.min(vw - sx, sw); sh = Math.min(vh - sy, sh);
    const up = Math.min(2, 1600 / sw);
    const c = document.createElement('canvas');
    c.width = Math.round(sw * up); c.height = Math.round(sh * up);
    c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }
  async function fileToCanvas(file){
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  // grayscale + contrast stretch, and invert if the sign is light text on a dark plate (Tesseract prefers dark on light)
  function prep(src){
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    let lo = 255, hi = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4){ const y = d[i]*.299 + d[i+1]*.587 + d[i+2]*.114; d[i] = y; if (y < lo) lo = y; if (y > hi) hi = y; sum += y; }
    const inv = sum / (d.length / 4) < 110, span = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4){ let y = (d[i] - lo) * 255 / span; if (inv) y = 255 - y; d[i] = d[i+1] = d[i+2] = y; }
    x.putImageData(im, 0, 0);
    return c;
  }

  /* ---------- engines ---------- */
  async function pickEngine(){
    if (engine) return engine;
    if ('TextDetector' in window){
      try { const c = document.createElement('canvas'); c.width = c.height = 8; await new TextDetector().detect(c); engine = APPLE ? 'vision' : 'os'; return engine; }
      catch(e){}
    }
    return engine = 'tess';
  }
  async function viaTextDetector(canvas){
    const r = await new TextDetector().detect(canvas);
    // sort top-to-bottom, left-to-right so the joined text reads naturally
    r.sort((a, b) => (a.boundingBox.y - b.boundingBox.y) || (a.boundingBox.x - b.boundingBox.x));
    return r.map(x => x.rawValue).join(' ');
  }
  function loadScript(src){
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function getTess(){
    if (tess) return tess;
    if (!tessLoading) tessLoading = (async () => {
      if (!window.Tesseract) await loadScript(TESS_URL);
      return Tesseract.createWorker(['kor', 'eng'], 1, {
        logger: m => onProgress && onProgress(m.status, m.progress) });
    })().catch(e => { tessLoading = null; throw e; });
    return tess = await tessLoading;
  }
  async function viaTess(canvas){
    const w = await getTess();
    const { data } = await w.recognize(prep(canvas));
    return data.text;
  }

  /* ---------- verdict ---------- */
  function judge(text){
    const n = (text || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
    const hit = { ok:[], ng:[] };
    for (const side of ['ok', 'ng']) for (const k of KW[side]) if (n.includes(k)) hit[side].push(k);
    // both directions on one frame (e.g. a split sign) → don't guess
    const verdict = hit.ok.length && !hit.ng.length ? 'ok' : hit.ng.length && !hit.ok.length ? 'ng' : 'unk';
    return { verdict, hits: hit[verdict] || [] };
  }
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const hasHangul = s => /[가-힣]/.test(s || '');

  async function read(canvas, progress){
    onProgress = progress;
    const first = await pickEngine();
    let text = '', used = first, firstPass = null;
    if (first !== 'tess'){
      try { text = clean(await viaTextDetector(canvas)); } catch(e){ text = ''; }
      // Vision may be limited to Latin script in this browser → second pass with Tesseract
      firstPass = text;
      if (!hasHangul(text) && judge(text).verdict === 'unk'){ used = 'tess'; text = clean(await viaTess(canvas)); }
    } else {
      text = clean(await viaTess(canvas));
    }
    onProgress = null;
    return { text, engine:used, firstPass, ...judge(text) };
  }

  /* ---------- public ---------- */
  window.OCR = {
    start, stop, pickEngine, judge,
    get live(){ return !!stream; },
    async shoot(progress){ const c = grabFrame(); if (!c) return null; return read(c, progress); },
    async fromFile(file, progress){ return read(await fileToCanvas(file), progress); },
    refreshMsg(){ const m = $('#camMsg'); if (m && m.dataset.k) m.innerHTML = t(m.dataset.k); },
  };
})();
