'use strict';
const crypto=require('node:crypto');
function executeTask(type,input){
 switch(type){
 case'echo':return input;
 case'sha256':return crypto.createHash('sha256').update(typeof input==='string'?input:JSON.stringify(input)).digest('hex');
 case'sum':if(!Array.isArray(input)||input.length>100000||input.some(n=>!Number.isFinite(n)))throw Error('sum expects up to 100000 finite numbers');return input.reduce((a,b)=>a+b,0);
 default:throw Error('unsupported_task_type');
 }
}
module.exports={executeTask};
