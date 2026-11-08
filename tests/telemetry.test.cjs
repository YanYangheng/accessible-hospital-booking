const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../telemetry.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function environment(storage = new Map()) {
  const timers = new Map(), calls = [], listeners = {};
  let timerId = 0;
  const localStorage = {get length(){return storage.size;}, key:i=>[...storage.keys()][i],
    getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k)};
  const env = {location:{protocol:'http:'}, crypto:webcrypto, AbortController, localStorage,
    window:{BOOKING_DATA:{version:'test'},addEventListener(k,fn){listeners[k]=fn;}},
    document:{addEventListener(k,fn){listeners[k]=fn;}},navigator:{sendBeacon(){calls.push({path:'beacon'});return true;}},
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
  const control = {fail:false, rejectHttp:false, resumeSeq:100};
  env.fetch = async (path, options) => {
    const body = JSON.parse(options.body); calls.push({path,body});
    if(path==='/api/resume') return {ok:true,status:200,json:async()=>({last_seq:control.resumeSeq})};
    if(path==='/api/events' && control.fail==='hang') return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))));
    if(path==='/api/events' && control.fail) throw Error('offline');
    if(path==='/api/events') {
      if(control.rejectHttp && body.events.some(e=>e.control==='bad')) return {ok:false,status:400};
      const accepted=[],rejected=[];
      body.events.forEach((e,i)=>e.control==='bad'?rejected.push({index:i,reason:'invalid_event'}):accepted.push(i));
      return {ok:true,status:200,json:async()=>({accepted,rejected})};
    }
    return {ok:true,status:204};
  };
  vm.createContext(env);vm.runInContext(source,env);
  return {study:vm.runInContext('study',env),calls,storage,timers,control,listeners,
    async next(){
      const next=[...timers.entries()].sort((a,b)=>a[1].delay-b[1].delay)[0];
      assert.ok(next,'expected scheduled work');timers.delete(next[0]);next[1].fn();await settle();
    }};
}
const flags={expiry:true,delayed:false};
const pending=env=>[...env.storage.keys()].filter(k=>k.startsWith('booking.event.'));

test('debug performs no upload or persistence',async()=>{
  const e=environment();await e.study.begin('',true);await e.study.beginAttempt(flags);
  e.study.log('view','home');assert.equal(await e.study.save([],[],0,{}),true);
  e.listeners.pagehide({persisted:false});assert.equal(e.calls.length,0);assert.equal(e.storage.size,0);
});

test('submissions share a participant session but use separate attempts',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);
  await e.study.beginAttempt(flags);await e.study.save([],[],0,{});
  await e.study.beginAttempt(flags);await e.study.save([],[],0,{});
  const saves=e.calls.filter(c=>c.path==='/api/submissions');
  assert.equal(saves[0].body.session,saves[1].body.session);
  assert.notEqual(saves[0].body.attempt,saves[1].body.attempt);
  assert.deepEqual(e.calls[0].body.conditions,flags);
});

test('logs survive reload and receive acknowledgements; later events still flush',async()=>{
  const storage=new Map(),first=environment(storage);
  await first.study.begin('Tester',false,flags);first.control.fail=true;
  first.study.log('view','home');await first.next();assert.equal(pending(first).length,1);
  const second=environment(storage);await second.study.begin('Other',false,flags);
  await second.next();assert.equal(pending(second).length,0);
  second.study.log('view','campus');await second.next();assert.equal(pending(second).length,0);
});

test('invalid events are isolated without blocking valid events',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);
  e.study.log('click','home','bad');e.study.log('view','campus');await e.next();
  assert.equal(pending(e).length,0);
  assert.equal([...e.storage.keys()].filter(k=>k.startsWith('booking.rejected.')).length,1);
});

test('a rejected batch is reduced to individual events',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);e.control.rejectHttp=true;
  e.study.log('click','home','bad');e.study.log('view','campus');await e.next();
  await e.next();await e.next();assert.equal(pending(e).length,0);
});

test('a stalled request times out, keeps its logs and retries',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);e.control.fail='hang';
  e.study.log('view','home');await e.next();await e.next();
  assert.equal(pending(e).length,1);e.control.fail=false;
  await e.next();assert.equal(pending(e).length,0);
});


test('progress is captured at transmission time and resume retains identity and sequence',async()=>{
  const storage=new Map(), first=environment(storage);
  let snapshot={state:{page:'home',profile:{}},scenario:flags,history:[]};
  first.study.setSnapshotReader(()=>snapshot);
  await first.study.begin('Tester',false,flags);await first.study.beginAttempt(flags);
  first.study.log('view','campus');
  snapshot={state:{page:'department',profile:{name:'已填写'}},scenario:flags,history:['campus']};
  await first.next();
  const saved=first.study.getProgress();
  assert.equal(saved.snapshot.state.page,'department');
  const prior=first.study.identity();
  const second=environment(storage);second.study.setSnapshotReader(()=>snapshot);
  assert.equal(await second.study.resume(second.study.getProgress()),true);
  assert.equal(second.study.identity().session,prior.session);
  assert.equal(second.study.identity().attempt,prior.attempt);
  assert.ok(second.study.identity().sequence>100);
  await second.study.save([],[],0,{});
  const body=second.calls.find(c=>c.path==='/api/submissions').body;
  assert.equal(body.session,prior.session);assert.equal(body.attempt,prior.attempt);
  await second.next();
  assert.ok(second.calls.filter(c=>c.path==='/api/events').some(c=>c.body.events.some(e=>e.control==='resume')));
});

test('restart and debug clear only this system storage and reset identifiers',async()=>{
  const e=environment();e.storage.set('other-app','retained');
  await e.study.begin('Tester',false,flags);
  e.study.setSnapshotReader(()=>({state:{page:'home'},scenario:flags,history:[]}));
  e.study.log('view','home');await e.next();assert.ok(e.study.getProgress());
  e.study.clear();assert.equal(e.study.identity(),null);assert.equal(e.study.getProgress(),null);
  assert.deepEqual([...e.storage.keys()],['other-app']);
  await e.study.begin('Tester',false,flags);e.study.log('view','home');await e.next();
  await e.study.begin('',true);assert.equal(e.study.identity(),null);
  assert.deepEqual([...e.storage.keys()],['other-app']);
});

test('page exit persists the latest form data and logs departure before beacon upload',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);
  e.study.setSnapshotReader(()=>({state:{page:'archive',profile:{name:'退出前输入'}},scenario:flags,history:[]}));
  e.listeners.pagehide({persisted:false});
  assert.equal(e.study.getProgress().snapshot.state.profile.name,'退出前输入');
  assert.ok(e.calls.some(c=>c.path==='beacon'));
});

test('clearing during an upload prevents the old request from recreating local records',async()=>{
  const e=environment();await e.study.begin('Tester',false,flags);e.control.fail='hang';
  e.study.log('view','home');await e.next();e.study.clear();await settle();
  assert.equal(e.storage.size,0);assert.equal(e.study.identity(),null);
  assert.equal(e.timers.size,0);
});
