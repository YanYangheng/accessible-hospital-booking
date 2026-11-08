const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function startup(lockedHistory = false, search = '', options = {}) {
  const nodes = new Map(), handlers = {};
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {innerHTML:'', scrollTop:0, classList:{toggle(){}},
      focus(){}, querySelectorAll(){return []}, querySelector(){return null;}});
    return nodes.get(key);
  };
  const storage = options.storage || new Map();
  const calls = [];
  const env = {location:{protocol:'http:',search,href:'http://localhost/'+search},URL,URLSearchParams,AbortController,
    crypto:require('node:crypto').webcrypto,
    fetch:async (route, request)=>{
      calls.push({route, body:JSON.parse(request.body)});
      const ok=options.fail !== route;
      return {ok,status:ok ? 204 : 400,json:async()=>route==='/api/resume'?{last_seq:0}:{accepted:[],rejected:[]}};
    },
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(k,v)=>storage.set(k,v),
      get length(){return storage.size;},key:i=>[...storage.keys()][i],removeItem:k=>storage.delete(k)},
    document:{querySelector:node,addEventListener(k,fn){handlers[k]=fn;}},
    ResizeObserver:class {disconnect(){} observe(){}},setTimeout,clearTimeout};
  env.window=env;
  env.addEventListener=(k,fn)=>{handlers[k]=fn;};
  if (lockedHistory) Object.defineProperty(env,'history',{get(){throw Error('History is unavailable');}});
  else env.history={state:null,replaceState(value){this.state=value;},pushState(value){this.state=value;}};
  vm.createContext(env);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match=>match[1]);
  assert.equal(scripts.at(-1).split('?')[0],'startup.js');
  assert.ok(scripts.every(src=>src.includes('?v=')));
  assert.equal(new Set(scripts.map(src=>src.split('?v=')[1])).size,1);
  for (const src of scripts) vm.runInContext(fs.readFileSync(path.join(root,src.split('?')[0]),'utf8'),env,{filename:src});
  return {env, calls, storage, html:()=>nodes.get('#view').innerHTML,
    state:()=>vm.runInContext('state',env), identity:()=>vm.runInContext('study.identity()',env),
    stop:()=>vm.runInContext('study.pause()',env)};
}

function assertCover(lockedHistory) {
  const app = startup(lockedHistory);
  assert.ok(app.html().includes('预约挂号系统v2原型测试'));
  assert.ok(app.html().includes('id="test-entry"'));
}

test('all real scripts boot together in HTML order with native window globals',()=>assertCover(false));
test('restricted browser history cannot prevent the cover from rendering',()=>assertCover(true));

const settle = () => new Promise(resolve=>setImmediate(resolve));
const link = '?mode=test&skip_cover=1&test_id=P03&name='+encodeURIComponent('测试用户');

test('valid formal link enters home and cannot deep link to confirmation',async()=>{
  const app=startup(false,link+'&page=confirm&expiry=1');
  await settle();
  try {
    assert.equal(app.state().page,'home');
    assert.equal(app.calls[0].body.test_id,'P03');
    assert.equal(app.calls[0].body.name,'测试用户');
    assert.equal(app.calls[0].body.conditions.expiry,true);
  } finally {app.stop();}
});

test('invalid and rejected links leave a usable cover',async()=>{
  const invalid=startup(false,'?mode=test&skip_cover=1&test_id=bad%20id');
  assert.match(invalid.html(),/需要有效的测试编号和姓名/);
  assert.equal(invalid.calls.length,0);
  const rejected=startup(false,link,{fail:'/api/sessions'});
  await settle();
  assert.match(rejected.html(),/暂时无法进入测试/);
  assert.match(rejected.html(),/data-action="link-retry"/);
});

test('every debug deep link renders with deterministic data and no requests',async()=>{
  for(const page of ['home','campus','department','doctors','slots','login','method','archive','expired','confirm','success','records','guide','settings','unknown']){
    const app=startup(false,'?mode=debug&page='+page,{storage:new Map([['booking.progress','{}'],['unrelated','value']])});
    await settle();
    assert.equal(app.state().page,page==='unknown'?'home':page);
    assert.ok(app.html().length>30);
    assert.equal(app.calls.length,0);
    assert.equal(app.identity(),null);
    assert.deepEqual([...app.storage.keys()],['unrelated']);
  }
});

test('matching linked checkpoint reuses the original session and attempt',async()=>{
  const debug=startup(false,'?mode=debug&page=archive');
  await settle();
  const identity={session:'a'.repeat(36),attempt:'b'.repeat(36),sequence:4,testId:'P03'};
  const saved={version:debug.env.BOOKING_DATA.version,identity,saved_ms:123,
    snapshot:{state:debug.state(),scenario:{expiry:false,delayed:false},history:[]}};
  const storage=new Map([['booking.progress',JSON.stringify(saved)]]);
  const app=startup(false,link,{storage});
  await settle();
  try {
    assert.equal(app.state().page,'archive');
    assert.equal(app.calls[0].route,'/api/resume');
    assert.equal(app.calls[0].body.test_id,'P03');
    assert.equal(app.identity().session,identity.session);
    assert.equal(app.identity().attempt,identity.attempt);
    assert.ok(app.identity().sequence>identity.sequence);
  } finally {app.stop();}
});

test('random confirmation preview uses available slots and renders a complete debug form',async()=>{
  const selections=new Set();
  for(let index=0;index<12;index++){
    const app=startup(false,'?mode=debug&page=confirm&random=1');
    await settle();
    const state=app.state(), booking=app.env.BOOKING_DATA;
    assert.equal(state.page,'confirm');
    assert.ok(state.archived && state.verified);
    assert.equal(booking.doctors[state.doctor].schedule[state.slot.day],'available');
    assert.ok(booking.dates[state.slot.day].slots[state.slot.index]);
    assert.match(app.html(),/确认预约信息/);
    assert.match(app.html(),/card summary doctor-summary/);
    assert.deepEqual([...app.html().matchAll(/<dt>(.*?)<\/dt>/g)].map(match=>match[1]),
      ['院区地址','就诊时间','就诊科室','科室位置','门诊类型','就诊人','手机号','就诊档案','挂号费用']);
    const {building, floor, number}=booking.doctors[state.doctor].room;
    assert.ok(app.html().includes(`<dd>${building}号楼 ${floor}层 ${number}室</dd>`));
    const address=booking.campuses.find(([name])=>name===state.campus)[1];
    assert.ok(app.html().includes(`<dd>${address} · ${state.campus}</dd>`));
    assert.match(app.html(),/测试用户/);
    assert.equal(app.calls.length,0);
    selections.add(JSON.stringify([state.campus,state.doctor,state.slot]));
  }
  assert.ok(selections.size>1);
});
