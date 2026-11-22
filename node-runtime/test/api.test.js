'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

process.env.OPENRAG_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'openrag-api-'));
process.env.OPENRAG_API_TOKEN='test-admin-secret';
process.env.OPENRAG_NODE_TOKEN='test-node-secret';
const{server}=require('../src/server');

test('authenticated coordinator API registers a node, leases and completes a task',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const admin={authorization:'Bearer test-admin-secret','content-type':'application/json'};
 const node={'x-openrag-node-token':'test-node-secret','content-type':'application/json'};
 try{
  const denied=await fetch(base+'/v1/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'sum',input:[1,2]})});
  assert.equal(denied.status,401);
  const registered=await fetch(base+'/v1/nodes/register',{method:'POST',headers:node,body:JSON.stringify({label:'test-node'})});
  assert.equal(registered.status,201);
  const{nodeId}=await registered.json();
  const submitted=await fetch(base+'/v1/tasks',{method:'POST',headers:admin,body:JSON.stringify({type:'sum',input:[1,2,3],idempotencyKey:'api-test'})});
  assert.equal(submitted.status,202);
  const{taskId}=await submitted.json();
  const claimed=await fetch(base+'/v1/nodes/'+nodeId+'/claim',{method:'POST',headers:node,body:'{}'});
  const{task}=await claimed.json();
  assert.equal(task.taskId,taskId);
  const completed=await fetch(base+'/v1/nodes/'+nodeId+'/tasks/'+taskId+'/complete',{method:'POST',headers:node,body:JSON.stringify({leaseToken:task.leaseToken,result:6})});
  assert.equal(completed.status,200);
  const status=await fetch(base+'/v1/tasks/'+taskId,{headers:admin});
  const result=await status.json();
  assert.equal(result.status,'completed');
  assert.equal(result.result,6);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
