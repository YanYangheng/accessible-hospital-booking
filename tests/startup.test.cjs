const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function startup(lockedHistory = false) {
  const nodes = new Map(), handlers = {};
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {innerHTML:'', scrollTop:0, classList:{toggle(){}},
      focus(){}, querySelectorAll(){return []}, querySelector(){return null;}});
    return nodes.get(key);
  };
  const storage = new Map();
  const env = {location:{protocol:'http:',search:''},URLSearchParams,AbortController,
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
  assert.equal(scripts.length,4);
  assert.ok(scripts.every(src=>src.includes('?v=')));
  assert.equal(new Set(scripts.map(src=>src.split('?v=')[1])).size,1);
  for (const src of scripts) vm.runInContext(fs.readFileSync(path.join(root,src.split('?')[0]),'utf8'),env,{filename:src});
  assert.ok(nodes.get('#view').innerHTML.includes('预约挂号系统v2原型测试'));
  assert.ok(nodes.get('#view').innerHTML.includes('id="test-entry"'));
}

test('all real scripts boot together in HTML order with native window globals',()=>startup());
test('restricted browser history cannot prevent the cover from rendering',()=>startup(true));
