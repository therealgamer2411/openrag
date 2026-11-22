/* OpenRAG Persistence Lab — SW / Workbox background sync adapter */
'use strict';
const CACHE='or-persistence-v030';
const ASSETS=['./','./index.html','./manifest.webmanifest','./probe-worker.js','./icon.svg'];
let witnessQueue=null;
try{
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
  workbox.setConfig({debug:false});
  workbox.loadModule('workbox-background-sync');
  witnessQueue=new workbox.backgroundSync.Queue('or-persistence-witness-v1',{maxRetentionTime:24*60});
}catch(e){console.warn('[OpenRAG] Workbox unavailable; using native fallback queue',e);}
function openDB(){
 return new Promise((resolve,reject)=>{const r=indexedDB.open('openrag-persistence-lab',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('events'))d.createObjectStore('events',{keyPath:'id',autoIncrement:true});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
async function save(record){
 const d=await openDB();await new Promise((resolve,reject)=>{const tx=d.transaction('events','readwrite');tx.objectStore('events').add(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function notifyClients(record){
 const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const c of clientsList)c.postMessage({type:'OR_SW_EVENT',at:record.at,eventType:record.type,detail:record.detail});
}
async function postWitness(record){
 const req=new Request('./api/witness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
 try{const res=await fetch(req.clone());if(!res.ok)throw new Error('HTTP '+res.status);}
 catch(e){
   if(witnessQueue){await witnessQueue.pushRequest({request:req});}
   else {await save({at:new Date().toISOString(),source:'service-worker',type:'witness-queued',detail:{eventId:record.eventId||record.id,message:String(e)}});}
 }
}
async function eventRecord(type,detail){
 const rec={id:'sw-'+Date.now()+'-'+Math.random().toString(16).slice(2),eventId:'sw-'+Date.now(),at:new Date().toISOString(),source:'service-worker',type,detail:detail||{}};
 await save(rec);await notifyClients(rec);await postWitness(rec);
}
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();await eventRecord('service-worker-activated',{workbox:!!witnessQueue});})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;try{return await fetch(event.request);}catch(e){return cached||Response.error();}})());
});
self.addEventListener('message',event=>{
 const d=event.data||{};
 if(d.type==='OR_SW_LOG')event.waitUntil(eventRecord(d.eventType||'message-event',d.detail||{}));
 if(d.type==='OR_SW_SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('sync',event=>{
 if(event.tag==='or-persistence-probe')event.waitUntil(eventRecord('background-sync-fired',{tag:event.tag,source:'browser-scheduled-sync'}));
 if(event.tag==='or-persistence-witness-flush')event.waitUntil(eventRecord('fallback-queue-sync-fired',{tag:event.tag}));
});
self.addEventListener('periodicsync',event=>{
 if(event.tag==='or-persistence-periodic')event.waitUntil(eventRecord('periodic-sync-fired',{tag:event.tag,source:'browser-scheduled-periodic-sync'}));
});
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?event.data.json():{};}catch(e){}
 event.waitUntil(eventRecord('push-event-received',{hasPayload:!!event.data,payloadType:payload.type||null}));
});
