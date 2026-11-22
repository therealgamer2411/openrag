let timer=null,ticks=0,jobs=0,lastJob=Date.now();
function pulse(){ticks++;postMessage({type:'pulse',tick:ticks,at:Date.now()});}
function job(){
  jobs++;const start=performance.now();let x=(jobs*2654435761)>>>0;
  const until=start+35;
  while(performance.now()<until){x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;}
  postMessage({type:'job',job:jobs,durationMs:+(performance.now()-start).toFixed(2),checksum:x>>>0});
}
onmessage=e=>{
 const d=e.data||{};
 if(d.type==='start'){clearInterval(timer);ticks=0;jobs=0;lastJob=Date.now();timer=setInterval(()=>{pulse();if(Date.now()-lastJob>=5000){lastJob=Date.now();job();}},d.intervalMs||1000);pulse();}
 if(d.type==='pulse-now')pulse();
 if(d.type==='stop'){clearInterval(timer);timer=null;}
};