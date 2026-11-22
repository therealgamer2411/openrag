'use strict';
require('dotenv').config();
const{executeTask}=require('./execute'),os=require('node:os');
const base=(process.env.OPENRAG_COORDINATOR_URL||'http://127.0.0.1:8787').replace(/\/$/,'');
const token=process.env.OPENRAG_NODE_TOKEN,label=process.env.OPENRAG_NODE_LABEL||os.hostname();
const headers={'content-type':'application/json','x-openrag-node-token':token};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function post(path,data={}){const r=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error||'coordinator_error');return j;}
async function main(){
 if(!token)throw Error('OPENRAG_NODE_TOKEN is required');
 const{nodeId}=await post('/v1/nodes/register',{label,runtimes:['native-js'],tags:['cpu','verified-task-types']});
 console.log('Registered OpenRAG node',nodeId);
 while(true){
  try{
   const{task}=await post('/v1/nodes/'+encodeURIComponent(nodeId)+'/claim');
   if(!task){await post('/v1/nodes/'+encodeURIComponent(nodeId)+'/heartbeat');await wait(2500);continue;}
   try{
    const result=executeTask(task.type,task.input);
    await post('/v1/nodes/'+encodeURIComponent(nodeId)+'/tasks/'+encodeURIComponent(task.taskId)+'/complete',{leaseToken:task.leaseToken,result});
    console.log('Completed',task.taskId);
   }catch(e){await post('/v1/nodes/'+encodeURIComponent(nodeId)+'/tasks/'+encodeURIComponent(task.taskId)+'/fail',{leaseToken:task.leaseToken,error:e.message});}
  }catch(e){console.error('Worker cycle failed:',e.message);await wait(5000);}
 }
}
main().catch(e=>{console.error(e);process.exit(1);});
