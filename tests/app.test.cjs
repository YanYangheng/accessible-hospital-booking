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
  const e={window:{addEventListener(type,fn){(handlers[type] ||= []).push(fn);}},document,location:{search:''},URLSearchParams,Date,
    ResizeObserver:class {observe(){} disconnect(){}},setTimeout,clearTimeout,
    study:{getProgress(){return null;},identity(){return null;},setSnapshotReader(){},selectAttempt(){},clear(){},pause(){},log(...args){logs.push(args);},async begin(){return true;},async beginAttempt(){return true;},async save(){return true;}}};
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

function nativeHistory(app) {
  const entries=[];let index=-1;
  const browser={get state(){return entries[index];},
    replaceState(value){if(index<0){entries.push(value);index=0;}else entries[index]=value;},
    pushState(value){entries.splice(index+1);entries.push(value);index++;},
    back(){if(index>0){index--;for(const fn of app.handlers.popstate)fn({state:entries[index]});}},
    forward(){if(index<entries.length-1){index++;for(const fn of app.handlers.popstate)fn({state:entries[index]});}}};
  app.e.window.history=browser;
  app.run('syncBrowserEntry()');
  return browser;
}
async function action(app,value) {
  const target={dataset:{action:value},disabled:false};
  for(const fn of app.handlers.click)await fn({target:{closest(){return target;}}});
}

test('page and browser back restore pages, preserve form input and record the actual source',async()=>{
  const app=environment(),browser=nativeHistory(app);
  app.e.document.querySelector=key=>key==='.region-dialog'?null:app.nodes[key];
  app.run("state.page='home';render();go('campus');state.campus=campusData[0][0];go('department');state.profile.name='已输入';");
  await action(app,'back');assert.equal(app.run('state.page'),'campus');
  assert.equal(app.run('state.profile.name'),'已输入');
  browser.back();assert.equal(app.run('state.page'),'home');
  browser.forward();assert.equal(app.run('state.page'),'campus');
  const moves=app.logs.filter(row=>row[2]==='browser-back'&&row[3].result==='history_navigation');
  assert.equal(moves[0][3].source,'page');assert.equal(moves[1][3].source,'browser');
  assert.equal(moves[2][3].direction,'forward');
});

test('returning cover offers resume, restores saved fields, and restart restores the entry form',async()=>{
  const app=environment();
  app.run("state.page='archive';state.campus=campusData[0][0];state.dept=departments[0];state.doctor=0;state.date=1;state.slot={day:1,index:0};state.profile.name='保留姓名';");
  let record={snapshot:app.run('captureProgress()')};
  app.e.study.getProgress=()=>record;app.e.study.resume=async()=>true;
  app.e.study.clear=()=>{record=null;};
  app.run('state=fresh();render();');
  assert.ok(app.nodes['#view'].innerHTML.includes('从离开位置继续'));
  assert.ok(!app.nodes['#view'].innerHTML.includes('id="test-entry"'));
  await action(app,'resume');assert.equal(app.run('state.page'),'archive');
  assert.equal(app.run('state.profile.name'),'保留姓名');
  app.run("state.page='cover';render();");await action(app,'restart');
  assert.ok(app.nodes['#view'].innerHTML.includes('id="test-entry"'));
  assert.ok(!app.nodes['#view'].innerHTML.includes('从离开位置继续'));
});

test('each campus opens its own illustrated guide and home preparation stays independent',async()=>{
  const app=environment();
  const images=new Set();
  for(let index=0;index<5;index++){
    app.run(`state.campus=campusData[${index}][0];state.page='method';`);
    await action(app,'guide');
    const image=app.run(`booking.guideImages.campuses[${index}]`);
    images.add(image);
    assert.ok(app.nodes['#view'].innerHTML.includes('src="'+image+'"'));
    assert.ok(app.nodes['#view'].innerHTML.includes('guide-card'));
  }
  assert.equal(images.size,5);
  await action(app,'home');await action(app,'guide:home');
  assert.ok(app.nodes['#view'].innerHTML.includes('src="assets/guide-home.webp"'));
  assert.ok(!app.nodes['#view'].innerHTML.includes('当前尚未预约'));
});
