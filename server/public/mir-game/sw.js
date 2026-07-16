// AI传奇 Service Worker - 离线缓存
const CACHE_NAME = 'mir-legacy-v1';
const ASSETS_TO_CACHE = [
  '/mir-game/',
  '/mir-game/index.html',
  '/mir-game/css/style.css',
  '/mir-game/js/phaser.min.js',
  '/mir-game/js/game.js',
  '/mir-game/js/config.js',
  '/mir-game/js/scenes/BootScene.js',
  '/mir-game/js/scenes/MenuScene.js',
  '/mir-game/js/scenes/CharacterSelectScene.js',
  '/mir-game/js/scenes/GameScene.js',
  '/mir-game/js/scenes/ShopScene.js',
  '/mir-game/icons/icon-192.png',
  '/mir-game/icons/icon-512.png',
  '/mir-game/manifest.json'
];

// 安装 - 缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 缓存核心资源');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] 部分资源缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活 - 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截 - 网络优先，失败时用缓存
self.addEventListener('fetch', (event) => {
  // 只缓存GET请求
  if (event.request.method !== 'GET') return;
  
  // API请求不走缓存
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 克隆响应并缓存
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败，使用缓存
        return caches.match(event.request).then((response) => {
          return response || caches.match('/mir-game/');
        });
      })
  );
});
