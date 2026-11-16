const CACHE='nkkams-shell-v82';
const ASSETS=['./','./index.html','./styles.css','./modern.css','./modern.css?v=13','./app.js','./app.js?v=76','./config.js','./manifest.webmanifest','./favicon.svg'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isAppShell=url.pathname.endsWith('/app.js')||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/config.js')||url.pathname.endsWith('/styles.css')||url.pathname.endsWith('/sw.js');
  if(isAppShell){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||new Response('Offline',{status:503}))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>cached||new Response('Offline',{status:503}))));
});