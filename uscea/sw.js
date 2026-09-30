/* =====================================================================
 * sw.js —— Service Worker（六站共用同一份，复制即生效）
 * 策略：同源静态资源「网络优先 + 缓存兜底」（保证改版后一定是新代码），
 *       跨域请求（LCD / RPC / CDN）一律不拦截，避免缓存脏的链上数据。
 *
 * 【多站隔离】GitHub Pages 的所有项目站点共享同一 origin，而 Cache Storage
 * 是跨目录共享的：六站若用同一个缓存名，任一站升版本时 activate 里的清理会
 * 把另外五站的缓存一起删掉。所以缓存名从 sw.js 自身路径推导应用名
 * （/paxi-choujiang-danbi/paxi/sw.js → paxi），清理时只动自己的前缀。
 * ===================================================================== */
const APP = (self.location.pathname.replace(/\/sw\.js$/, '').split('/').filter(Boolean).pop()) || 'root';
const PREFIX = 'paxi-lottery-' + APP + '-';
// v2 -> v3：单币版移除了 session.js，SHELL 清单变了，缓存名同步升。
const CACHE = PREFIX + 'v8';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './chain.js',
  './lottery.js',
  './hash.js',
  './config.js',
  './i18n.js',
  './manifest.json',
  './icon-192.png',
  // ---- 本地 vendor 加密 / 交易库 ----
  './vendor/bech32.mjs',
  './vendor/secp256k1.mjs',
  './vendor/long.umd.js',
  './vendor/paxi-cosmjs.umd.js',
  './vendor/hashes/sha256.js',
  './vendor/hashes/ripemd160.js',
  './vendor/hashes/crypto.js',
  './vendor/hashes/utils.js',
  './vendor/hashes/_md.js',
  './vendor/hashes/_assert.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 跨域（链上 API / CDN）不缓存，直接放行
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'offline' });
      })
  );
});
