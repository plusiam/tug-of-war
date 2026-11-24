// 폰 교사 화면·연결 안정화 시험용 도구: index.html의 스크립트를 가짜 화면(DOM)과 가짜 실시간 통신 위에서 돌린다.
// 브라우저·네트워크를 쓰지 않는다. 시간은 SPEED배로 빨리 흐른다(타이머와 Date.now 모두).
const fs = require('fs'), path = require('path'), vm = require('vm');
const SPEED = 20;
const t0 = Date.now(), p0 = performance.now(); // 모든 페이지가 같은 (빨리 가는) 시계를 쓴다
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>\n([\s\S]*?)<\/script>\n<\/body>/)[1];

class El {
  constructor(doc, id) {
    this.doc = doc; this.id = id || ''; this._cls = new Set(); this._q = {}; this.parent = null;
    this.classList = {
      add: (...a) => a.forEach(x => this._cls.add(x)), remove: (...a) => a.forEach(x => this._cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !this._cls.has(c) : !!f; on ? this._cls.add(c) : this._cls.delete(c); return on; },
      contains: c => this._cls.has(c),
    };
    this.style = { setProperty() {} }; this.dataset = {}; this.value = ''; this.textContent = ''; this.innerHTML = '';
    this.children = []; this.scrollTop = 0; this.listeners = {}; this.disabled = false; this.clientHeight = 600; this.clientWidth = 360;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  fire(t, e = {}) { (this.listeners[t] || []).forEach(f => f(e)); }
  querySelector(sel) { return this._q[sel] ??= new El(this.doc); }
  querySelectorAll() { return []; }
  setAttribute() {} getAttribute() { return null; } focus() {} closest() { return null; } setPointerCapture() {}
  click() { if (this.onclick) this.onclick(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

// 가짜 실시간 통신: 한 '버스'를 여러 페이지가 함께 쓴다(Supabase Broadcast + HTTP 방송 흉내).
function makeBus() {
  const bus = {
    subs: new Set(), sent: [], opened: [], subscribeDelay: 15, // 구독 완료까지 걸리는 시간(앱 시간 ms)
    subscribeMode: 'ok',            // 'ok' | 'error' | 'never'
    http: true,                     // false면 HTTP 방송이 실패한다
    drop: () => false,              // (msg) => true면 그 메시지는 전달하지 않는다(HTTP는 성공)
    deliver(msg) { for (const ch of [...bus.subs]) ch._deliver(msg); },
    liveOn(topic) { return [...bus.subs].filter(ch => ch.topic === topic).length; },
  };
  return bus;
}

function makePage(bus, { search = '', width = 360, storage = {}, wakeLock } = {}) {
  const doc = { els: {}, visibilityState: 'visible', listeners: {} };
  const get = sel => doc.els[sel] ??= new El(doc, sel.startsWith('#') ? sel.slice(1) : '');
  const body = new El(doc, 'body');
  const sections = ['home-view', 'setup-view', 'board-view', 'sum-view', 'join-view', 'student-view'].map(id => { const e = get('#' + id); e.classList.add('hide'); return e; });
  get('#resume-box').classList.add('hide'); get('#selbar').classList.add('hide');
  const document = {
    get visibilityState() { return doc.visibilityState; },
    documentElement: new El(doc), body, head: new El(doc),
    querySelector: get,
    querySelectorAll(sel) {
      if (sel === 'body > section') return sections;
      const cls = sel.split('.').filter(Boolean);
      return body.children.filter(c => cls.every(k => c.classList.contains(k)));
    },
    createElement: () => new El(doc),
    addEventListener(t, f) { (doc.listeners[t] ??= []).push(f); },
  };
  const store = (data) => ({
    get length() { return Object.keys(data).length; }, key: i => Object.keys(data)[i],
    getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; },
  });
  const winListeners = {};
  const location = { search, pathname: '/tug/', origin: 'https://example.test' };
  const page = { bus, doc, body, get, toasts: [], storage, winListeners, location, wakeRequests: 0, wakeReleases: 0 };
  const supabase = {
    createClient: () => ({
      channel(topic) {
        const handlers = {};
        const ch = {
          topic, page,
          on(_t, { event }, fn) { handlers[event] = fn; return ch; },
          subscribe(fn) {
            bus.opened.push(topic);
            if (bus.subscribeMode === 'ok') setTimeout(() => { if (ch._closed) return; bus.subs.add(ch); fn && fn('SUBSCRIBED'); }, bus.subscribeDelay / SPEED);
            else if (bus.subscribeMode === 'error') setTimeout(() => fn && fn('CHANNEL_ERROR'), 15 / SPEED);
            return ch;
          },
          _deliver(msg) { if (msg.topic === topic && handlers[msg.event]) handlers[msg.event]({ payload: msg.payload }); },
          unsubscribe() { ch._closed = true; bus.subs.delete(ch); },
        };
        return ch;
      },
      removeChannel(ch) { ch.unsubscribe(); return Promise.resolve(); },
    }),
  };
  const navigator = { clipboard: { writeText: async () => {} } };
  if (wakeLock !== false) {
    navigator.wakeLock = wakeLock || {
      request: async () => {
        page.wakeRequests++;
        const lock = { released: false, release: async () => { lock.released = true; page.wakeReleases++; }, addEventListener() {} };
        return lock;
      },
    };
  }
  const ctx = {
    console, URLSearchParams, URL, Blob, performance,
    setTimeout: (fn, ms = 0, ...a) => setTimeout(fn, ms / SPEED, ...a), clearTimeout,
    setInterval: (fn, ms = 0, ...a) => setInterval(fn, ms / SPEED, ...a), clearInterval,
    document, location, navigator, supabase,
    localStorage: store(storage), sessionStorage: store({}),
    history: { replaceState(_a, _b, url) { page.url = url; } },
    qrcode: () => ({ addData() {}, make() {}, getModuleCount: () => 1, isDark: () => false }),
    fetch: async (url, opts) => {
      if (!bus.http) throw Error('offline');
      for (const msg of JSON.parse(opts.body).messages) {
        bus.sent.push({ ...msg, from: page });
        if (!bus.drop(msg, page)) setTimeout(() => bus.deliver(msg), 1);
      }
      return { ok: true };
    },
    // 폭 조건은 page.width, 손가락 화면 조건은 page.coarse로 흉내 낸다
    matchMedia: q => ({ matches: /pointer:\s*coarse/.test(q) ? !!page.coarse : page.width <= +q.match(/(\d+)px/)[1] }),
    get innerHeight() { return page.height; },
    get screen() { return page.screen; },
    addEventListener(t, f) { (winListeners[t] ??= []).push(f); },
    scrollTo() {}, prompt: () => '',
  };
  ctx.window = ctx; page.width = width;
  vm.createContext(ctx);
  vm.runInContext(`Date.now = () => Math.floor(${t0} + (performance.now() - ${p0}) * ${SPEED});`, ctx);
  vm.runInContext(script + '\n;globalThis.__T = T; globalThis.__S = S;', ctx, { filename: 'index.html<script>' });
  const realToast = ctx.toast;
  ctx.toast = (msg, ms) => { page.toasts.push(msg); };
  page.realToast = realToast; // 화면에 실제로 띄우는 원래 toast(겹침 시험용)
  Object.assign(page, {
    ctx, T: ctx.__T, S: ctx.__S,
    $: get,
    shown: () => sections.find(s => !s.classList.contains('hide'))?.id,
    setVisible(v) { doc.visibilityState = v ? 'visible' : 'hidden'; (doc.listeners.visibilitychange || []).forEach(f => f()); },
    fireWindow(t, e = {}) { (winListeners[t] || []).forEach(f => f(e)); },
    overlays: () => body.children.filter(c => c.classList.contains('overlay')),
  });
  return page;
}

const rejections = [];
process.on('unhandledRejection', e => rejections.push(String(e && e.message || e)));
const sleep = ms => new Promise(r => setTimeout(r, ms / SPEED)); // 앱 시간 기준
async function until(cond, ms = 8000, label = 'condition') {
  const end = Date.now() + ms / SPEED + 200;
  while (Date.now() < end) { if (cond()) return true; await new Promise(r => setTimeout(r, 5)); }
  throw Error('시간 안에 일어나지 않음: ' + label);
}
let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}
function summary() { console.log(`\n${passed} passed, ${failed} failed`); if (failed) process.exitCode = 1; return failed === 0; }

module.exports = { rejections, SPEED, makeBus, makePage, sleep, until, check, summary };
