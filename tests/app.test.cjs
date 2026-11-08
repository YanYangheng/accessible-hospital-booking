const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function environment() {
  const handlers={},nodes={},logs=[];
  function node(key){return nodes[key] ||= {innerHTML:'',scrollTop:0,classList:{toggle(){}},
    focus(){},querySelectorAll(){return []},querySelector(){return null;}};}
  const document={querySelector:node,addEventListener(type,fn){(handlers[type] ||= []).push(fn);}};
  const e={window:{},document,location:{search:''},URLSearchParams,Date,
    ResizeObserver:class {observe(){} disconnect(){}},setTimeout,clearTimeout,
    study:{log(...args){logs.push(args);},async begin(){return true;},async beginAttempt(){return true;},async save(){return true;}}};
  vm.createContext(e);
  for(const file of ['booking-data.js','regions.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),e);
  return {e,handlers,nodes,logs,run(code){return vm.runInContext(code,e);}};
}

test('dialog forms retain the native confirm/cancel submit action',async()=>{
  const app=environment();let prevented=false;
  const event={target:{getAttribute:k=>k==='method'?'dialog':null},preventDefault(){prevented=true;}};
  for(const handler of app.handlers.submit) await handler(event);
  assert.equal(prevented,false);
});

test('both booking modes retain fixed dates, prices and special clinic selection',async()=>{
  const app=environment();
  app.run("state.page='doctors';state.dept=departments[0];state.campus=campusData[0][0];render();");
  const click=async action=>{
    const target={dataset:{action},disabled:false};
    for(const fn of app.handlers.click)await fn({target:{closest(){return target;}}});
  };
  await click('date:1');await click('doctor:0');
  assert.equal(app.run('state.page'),'slots');
  assert.equal((app.nodes['#view'].innerHTML.match(/class="slot-price"/g)||[]).length,4);
  assert.ok(app.nodes['#view'].innerHTML.includes('¥82.50'));
  await click('slot:3');assert.equal(app.run('state.page'),'login');
  assert.ok(app.nodes['#view'].innerHTML.includes('特需门诊'));
  app.run("go('doctors');state.mode='doctor';state.doctor=null;render();");
  await click('doctor:1');assert.ok(app.nodes['#view'].innerHTML.includes('id="doctor-dates-1"'));
  await click('doctor-next');assert.equal(app.run('state.page'),'slots');
});

test('starting again creates a new attempt before resetting the booking state',async()=>{
  const app=environment();let attempts=0;
  app.e.study.beginAttempt=async()=>{attempts++;return true;};
  app.run("state.page='home';state.archived=true;state.receipt=true;");
  const target={dataset:{action:'start'},disabled:false};
  for(const fn of app.handlers.click)await fn({target:{closest(){return target;}}});
  assert.equal(attempts,1);assert.equal(app.run('state.page'),'campus');
  assert.equal(app.run('state.archived'),false);
});

test('SMS countdown schedules only while a visible resend deadline is active',()=>{
  const app=environment(), timers=new Map();let id=0;
  app.e.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};
  app.e.clearTimeout=key=>timers.delete(key);
  app.run('state.resendAt=0;refreshSms();');assert.equal(timers.size,0);
  app.run('state.resendAt=Date.now()+30000;refreshSms();');
  assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,1000);
  app.run('state.resendAt=0;refreshSms();');assert.equal(timers.size,0);
});
