/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    🧠 CÉREBRO - Service Worker PWA                           ║
 * ║                                                                              ║
 * ║  Gerencia cache, offline e atualizações automáticas                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

const CACHE_VERSION = 'cerebro-v4.0';
const CACHE_NAME = `${CACHE_VERSION}-main`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// Arquivos essenciais para funcionamento offline
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    
    // Ícones
    '/assets/icons/favicon.svg',
    '/assets/icons/cerebro-icon-192.png',
    '/assets/icons/cerebro-icon-512.png',
    
    // CSS
    '/css/variables.css',
    '/css/base.css',
    '/css/sidebar.css',
    '/css/dark-theme.css',
    '/css/animations.css',
    '/css/responsive.css',
    '/css/login.css',
    '/css/pages/_base.css',
    '/css/pages/home.css',
    '/css/pages/coffee.css',
    '/css/pages/chat.css',
    '/css/pages/team.css',
    '/css/pages/modals.css',
    '/css/pages/stats.css',
    '/css/pages/achievements.css',
    '/css/pages/levels.css',
    '/css/pages/admin.css',
    
    // JavaScript
    '/js/main.js',
    '/js/api.js',
    '/js/auth.js',
    '/js/chat.js',
    '/js/coffee.js',
    '/js/easter-eggs.js',
    '/js/navigation.js',
    '/js/quotes.js',
    '/js/state.js',
    '/js/user.js',
    '/js/utils.js',
    '/js/theme.js',
    '/js/notifications.js',
    '/js/socket.js',
    '/js/achievements/index.js',
    '/js/achievements/definitions.js',
    '/js/achievements/storage.js',
    '/js/achievements/checker.js',
    '/js/achievements/notifier.js',
    '/js/levels/index.js',
    '/js/logger.js',
    '/js/lottery.js',
    '/js/stats.js',
    '/js/preferences.js',
    '/js/shortcuts.js',
    '/js/admin.js',
    '/js/chat-moderation.js',
    '/js/chat-moderation-config.js'
];

// URLs que NÃO devem ser cacheadas (sempre buscar da rede)
const NETWORK_ONLY = [
    '/api/',
    '/socket.io/',
    '/auth/'
];

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ INSTALL - Cachear arquivos essenciais                                        │
// └──────────────────────────────────────────────────────────────────────────────┘
self.addEventListener('install', (event) => {
    console.log('🧠 Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cacheando arquivos estáticos...');
                // Cachear arquivos um por um para não falhar todos se um falhar
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn(`⚠️  Não foi possível cachear: ${url}`, err.message);
                        })
                    )
                );
            })
            .then(() => {
                console.log('✅ Service Worker instalado com sucesso!');
                return self.skipWaiting(); // Ativa imediatamente
            })
            .catch((error) => {
                console.error('❌ Erro ao instalar Service Worker:', error);
            })
    );
});

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ ACTIVATE - Limpar caches antigos                                             │
// └──────────────────────────────────────────────────────────────────────────────┘
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Remover caches antigos
                const cachesToDelete = cacheNames.filter(cacheName => 
                    cacheName.startsWith('cerebro-') && 
                    cacheName !== CACHE_NAME && 
                    cacheName !== CACHE_DYNAMIC
                );
                
                return Promise.all(
                    cachesToDelete.map((cacheName) => {
                        console.log('🗑️  Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker ativado e assumiu controle!');
                return self.clients.claim(); // Assume controle imediatamente
            })
    );
});

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ FETCH - Estratégia de cache                                                  │
// └──────────────────────────────────────────────────────────────────────────────┘
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requisições não-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignorar URLs não-HTTP(S)
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK ONLY - API, WebSocket, Auth
    // ═══════════════════════════════════════════════════════════════════════
    if (NETWORK_ONLY.some(pattern => request.url.includes(pattern))) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ 
                        error: 'Sem conexão', 
                        offline: true 
                    }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CACHE FIRST - Arquivos estáticos (CSS, JS, imagens, fontes)
    // ═══════════════════════════════════════════════════════════════════════
    if (
        request.url.includes('.css') ||
        request.url.includes('.js') ||
        request.url.includes('.png') ||
        request.url.includes('.jpg') ||
        request.url.includes('.svg') ||
        request.url.includes('.woff') ||
        request.url.includes('.woff2') ||
        request.url.includes('fonts.googleapis.com') ||
        request.url.includes('fonts.gstatic.com')
    ) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // Não está no cache, buscar da rede e cachear
                    return fetch(request)
                        .then(networkResponse => {
                            // Cachear dinamicamente
                            if (networkResponse && networkResponse.status === 200) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_DYNAMIC).then(cache => {
                                    cache.put(request, responseToCache);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // Offline e não tem cache
                            console.warn('⚠️  Arquivo não disponível offline:', request.url);
                        });
                })
        );
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK FIRST - HTML (para sempre pegar atualizações)
    // ═══════════════════════════════════════════════════════════════════════
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                // Cachear a resposta
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Offline, tentar buscar do cache
                return caches.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // Se for página HTML e não tem no cache, retornar página offline
                    if (request.headers.get('accept').includes('text/html')) {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ MESSAGE - Comunicação com a página                                           │
// └──────────────────────────────────────────────────────────────────────────────┘
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('🗑️  Cache limpo!');
            })
        );
    }
});

console.log('🧠 Cérebro Service Worker v4.0 carregado!');
                .catch(() => {
                    return new Response(JSON.stringify({ error: 'Offline' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    // Fetch in background to update cache
                    fetch(event.request)
                        .then((response) => {
                            if (response.ok) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, response);
                                    });
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-ok responses
                        if (!response.ok) {
                            return response;
                        }
                        
                        // Clone the response
                        const responseClone = response.clone();
                        
                        // Add to cache (only if valid http/https URL)
                        if (event.request.url.startsWith('http')) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                })
                                .catch((error) => {
                                    console.warn('Failed to cache:', event.request.url, error);
                                });
                        }
                        
                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('🧠 Service Worker: Push received');
    
    let data = { title: 'Cérebro', body: 'Nova notificação' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-72.png',
        vibrate: [200, 100, 200],
        data: data.url || '/',
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Fechar' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('🧠 Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data || '/');
                }
            })
    );
});

// Background sync event (for offline actions)
self.addEventListener('sync', (event) => {
    console.log('🧠 Service Worker: Sync event', event.tag);
    
    if (event.tag === 'sync-coffee') {
        event.waitUntil(syncCoffeeData());
    }
    
    if (event.tag === 'sync-chat') {
        event.waitUntil(syncChatData());
    }
});

async function syncCoffeeData() {
    // Sync offline coffee registrations when back online
    console.log('🧠 Syncing coffee data...');
}

async function syncChatData() {
    // Sync offline chat messages when back online
    console.log('🧠 Syncing chat data...');
}
