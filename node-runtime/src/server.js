'use strict';
require('dotenv').config();
const http=require('node:http'),crypto=require('node:crypto');
const{OpenRAGEngine}=require('./engine');
const engine=new OpenRAGEngine(),port=Number(process.env.OPENRAG_PORT||8787);
const adminToken=process.env.OPENRAG_API_TOKEN,nodeToken=process.env.OPENRAG_NODE_TOKEN;
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
function equal(a,b){if(!a||!b)return false;const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function auth(req,token,header='authorization'){const v=req.headers[header];const supplied=header==='authorization'&&v?.startsWith('Bearer ')?v.slice(7):v;return equal(supplied,token);}
async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>300*1024)throw Error('body_too_large');}return raw?JSON.parse(raw):{};}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'openrag-node-runtime',version:'0.1.0',stats:engine.stats()});
  if(req.method==='POST'&&url.pathname==='/v1/tasks'){
   if(!auth(req,adminToken))return json(res,401,{error:'unauthorized'});
   const t=engine.submitTask(await readBody(req));return json(res,202,{taskId:t.taskId,status:t.status});
  }
  if(req.method==='GET'&&url.pathname.startsWith('/v1/tasks/')){
   if(!auth(req,adminToken))return json(res,401,{error:'unauthorized'});
   const t=engine.getTask(url.pathname.split('/').pop());return t?json(res,200,t):json(res,404,{error:'not_found'});
  }
  if(req.method==='POST'&&url.pathname==='/v1/nodes/register'){
   if(!auth(req,nodeToken,'x-openrag-node-token'))return json(res,401,{error:'unauthorized'});
   return json(res,201,engine.registerNode(await readBody(req)));
  }
  const m=url.pathname.match(/^\/v1\/nodes\/([^/]+)\/(heartbeat|claim|tasks\/([^/]+)\/(renew|complete|fail))$/);
  if(req.method==='POST'&&m){
   if(!auth(req,nodeToken,'x-openrag-node-token'))return json(res,401,{error:'unauthorized'});
   const nodeId=decodeURIComponent(m[1]),action=m[2],data=await readBody(req);
   if(action==='heartbeat')return json(res,200,engine.heartbeat(nodeId));
   if(action==='claim')return json(res,200,{task:engine.claimTask(nodeId)});
   const taskId=m[3],op=m[4];
   if(op==='renew')return json(res,200,engine.renewLease(taskId,nodeId,data.leaseToken));
   if(op==='complete')return json(res,200,{task:engine.completeTask(taskId,nodeId,data.leaseToken,data.result)});
   if(op==='fail')return json(res,200,{task:engine.failTask(taskId,nodeId,data.leaseToken,data.error)});
  }
  return json(res,404,{error:'not_found'});
 }catch(e){const status=e.message==='body_too_large'?413:e.message==='unknown_node'?404:400;return json(res,status,{error:e.message||'bad_request'});}
});
if(require.main===module){if(!adminToken||!nodeToken){console.error('Set OPENRAG_API_TOKEN and OPENRAG_NODE_TOKEN.');process.exit(1);}server.listen(port,()=>console.log('OpenRAG Node Runtime listening on '+port));}
module.exports={server,engine};
