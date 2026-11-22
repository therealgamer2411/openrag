'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{OpenRAGEngine}=require('../src/engine');const{executeTask}=require('../src/execute');
function fixture(opts={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openrag-'));return{engine:new OpenRAGEngine({dataDir:dir,...opts}),dir};}
test('node registers and receives task lease',()=>{const{engine}=fixture();const{nodeId}=engine.registerNode();engine.submitTask({type:'sum',input:[2,3,5]});const lease=engine.claimTask(nodeId);assert.equal(lease.type,'sum');});
test('lease token required to complete',()=>{const{engine}=fixture();const{nodeId}=engine.registerNode();const task=engine.submitTask({type:'echo',input:'hello'});const lease=engine.claimTask(nodeId);assert.throws(()=>engine.completeTask(task.taskId,nodeId,'wrong','bad'),/invalid_lease/);assert.equal(engine.completeTask(task.taskId,nodeId,lease.leaseToken,'hello').status,'completed');});
test('idempotency prevents duplicate work',()=>{const{engine}=fixture();const a=engine.submitTask({type:'echo',input:1,idempotencyKey:'once'}),b=engine.submitTask({type:'echo',input:1,idempotencyKey:'once'});assert.equal(a.taskId,b.taskId);assert.equal(engine.stats().tasks,1);});
test('state survives restart',()=>{const{engine,dir}=fixture();const t=engine.submitTask({type:'sha256',input:'persist'});assert.equal(new OpenRAGEngine({dataDir:dir}).getTask(t.taskId).status,'queued');});
test('execution is allowlisted',()=>{assert.equal(executeTask('sum',[1,2,3]),6);assert.equal(executeTask('sha256','abc').length,64);assert.throws(()=>executeTask('eval','bad'),/unsupported/);});
