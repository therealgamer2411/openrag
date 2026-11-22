'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const TASK_TYPES=new Set(['echo','sha256','sum']);
const now=()=>Date.now(),id=p=>p+'_'+crypto.randomUUID(),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
class OpenRAGEngine{
 constructor({dataDir=process.env.OPENRAG_DATA_DIR||path.join(process.cwd(),'data'),leaseMs=30000,maxRetries=3}={}){
  this.dataDir=dataDir;this.file=path.join(dataDir,'grid-state.json');this.leaseMs=leaseMs;this.maxRetries=maxRetries;
  fs.mkdirSync(dataDir,{recursive:true});this.state=this.load();
 }
 load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return{version:1,nodes:{},tasks:{},idempotency:{}};}}
 save(){const tmp=this.file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state),{mode:0o600});fs.renameSync(tmp,this.file);}
 registerNode({label='OpenRAG Node',runtimes=['native-js'],tags=[]}={}){
  if(!Array.isArray(runtimes)||!Array.isArray(tags))throw Error('runtimes and tags must be arrays');
  const nodeId=id('node');this.state.nodes[nodeId]={nodeId,label:String(label).slice(0,80),runtimes:runtimes.slice(0,20),tags:tags.slice(0,50),status:'idle',registeredAt:now(),lastSeenAt:now(),currentTaskId:null,completed:0,failed:0};this.save();return{nodeId};
 }
 heartbeat(nodeId){const n=this.state.nodes[nodeId];if(!n)throw Error('unknown_node');n.lastSeenAt=now();if(!n.currentTaskId)n.status='idle';this.save();return{nodeId,status:n.status,lastSeenAt:n.lastSeenAt};}
 submitTask({type,input,idempotencyKey,maxAttempts=this.maxRetries+1}={}){
  if(!TASK_TYPES.has(type))throw Error('unsupported_task_type');if(input===undefined)throw Error('task_input_required');
  if(Buffer.byteLength(JSON.stringify(input))>262144)throw Error('task_input_too_large');
  if(idempotencyKey&&this.state.idempotency[idempotencyKey])return this.state.tasks[this.state.idempotency[idempotencyKey]];
  const taskId=id('task'),task={taskId,type,input,status:'queued',createdAt:now(),attempts:0,maxAttempts:Math.max(1,Math.min(5,Number(maxAttempts)||1)),nodeId:null,leaseTokenHash:null,leaseExpiresAt:null,result:null,error:null};
  this.state.tasks[taskId]=task;if(idempotencyKey)this.state.idempotency[idempotencyKey]=taskId;this.save();return task;
 }
 expireLeases(){const t=now();for(const task of Object.values(this.state.tasks)){if(task.status==='leased'&&task.leaseExpiresAt<=t){const n=this.state.nodes[task.nodeId];if(n){n.currentTaskId=null;n.status='idle';}task.nodeId=null;task.leaseTokenHash=null;task.leaseExpiresAt=null;task.status=task.attempts<task.maxAttempts?'queued':'failed';task.error='lease_expired';}}}
 claimTask(nodeId){const n=this.state.nodes[nodeId];if(!n)throw Error('unknown_node');this.expireLeases();if(n.currentTaskId){this.save();return null;}
  const task=Object.values(this.state.tasks).find(t=>t.status==='queued');if(!task){this.save();return null;}
  const token=crypto.randomBytes(32).toString('hex');task.status='leased';task.nodeId=nodeId;task.attempts++;task.leaseTokenHash=hash(token);task.leaseExpiresAt=now()+this.leaseMs;n.currentTaskId=task.taskId;n.status='busy';n.lastSeenAt=now();this.save();
  return{taskId:task.taskId,type:task.type,input:task.input,leaseToken:token,leaseExpiresAt:task.leaseExpiresAt};
 }
 assertLease(taskId,nodeId,token){const t=this.state.tasks[taskId];if(!t||t.status!=='leased'||t.nodeId!==nodeId||!t.leaseTokenHash)throw Error('invalid_lease');
  const a=Buffer.from(hash(String(token||''))),b=Buffer.from(t.leaseTokenHash);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Error('invalid_lease');
  if(t.leaseExpiresAt<=now()){this.expireLeases();this.save();throw Error('lease_expired');}return t;
 }
 renewLease(taskId,nodeId,token){const t=this.assertLease(taskId,nodeId,token);t.leaseExpiresAt=now()+this.leaseMs;this.state.nodes[nodeId].lastSeenAt=now();this.save();return{leaseExpiresAt:t.leaseExpiresAt};}
 completeTask(taskId,nodeId,token,result){const t=this.assertLease(taskId,nodeId,token);if(Buffer.byteLength(JSON.stringify(result))>262144)throw Error('result_too_large');
  t.status='completed';t.result=result;t.completedAt=now();t.leaseTokenHash=null;t.leaseExpiresAt=null;const n=this.state.nodes[nodeId];n.currentTaskId=null;n.status='idle';n.completed++;this.save();return t;
 }
 failTask(taskId,nodeId,token,error){const t=this.assertLease(taskId,nodeId,token);t.error=String(error||'worker_failed').slice(0,500);t.leaseTokenHash=null;t.leaseExpiresAt=null;t.nodeId=null;t.status=t.attempts<t.maxAttempts?'queued':'failed';
  const n=this.state.nodes[nodeId];n.currentTaskId=null;n.status='idle';n.failed++;this.save();return t;
 }
 getTask(taskId){const t=this.state.tasks[taskId];if(!t)return null;const{leaseTokenHash,...safe}=t;return safe;}
 stats(){const a=Object.values(this.state.tasks);return{nodes:Object.keys(this.state.nodes).length,onlineNodes:Object.values(this.state.nodes).filter(n=>now()-n.lastSeenAt<90000).length,tasks:a.length,queued:a.filter(t=>t.status==='queued').length,leased:a.filter(t=>t.status==='leased').length,completed:a.filter(t=>t.status==='completed').length,failed:a.filter(t=>t.status==='failed').length};}
}
module.exports={OpenRAGEngine,TASK_TYPES};
