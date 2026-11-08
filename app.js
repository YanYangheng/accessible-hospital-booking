'use strict';

const topBar = document.querySelector('#top');
const view = document.querySelector('#view');
const bottom = document.querySelector('#bottom');
const booking = window.BOOKING_DATA;
const campusData = booking.campuses;
const departments = booking.departments;
const divisions = window.BOOKING_REGIONS;
const defaultRegion = booking.defaultRegion;
const dates = booking.dates.map(day=>[day.label,day.weekday]);
const times = booking.dates.map(day=>day.slots.map(slot=>slot.time));
const clinicAt = (index,day=state.date)=>booking.clinics[booking.dates[day].slots[index].clinic];
const slotType = (index,day=state.date)=>clinicAt(index,day).label;
const slotFee = (index,day=state.date)=>'¥'+(clinicAt(index,day).fee_fen/100).toFixed(2);
const departmentIcons = ["internal", "senior", "general", "heart", "lungs", "stomach", "endocrine", "brain", "tooth"];
const paths = {
"internal":"<path d=\"M6 3v6a4 4 0 0 0 8 0V3M4 3h4m4 0h4m-6 10v3a4 4 0 0 0 8 0v-2\"/><circle cx=\"18\" cy=\"11\" r=\"3\"/>","senior":"<circle cx=\"10\" cy=\"5\" r=\"2\"/><path d=\"m9 10 3-1 3 4h3m-9-3-3 5m3-5 1 6-3 5m3-5 3 5m5-8v8\"/>","general":"<path d=\"m3 10 9-7 9 7v10H3Z\"/><path d=\"M12 10v7m-3-3.5h6\"/>","heart":"<path d=\"M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z\"/><path d=\"M4 12h4l2-4 3 8 2-4h5\"/>","lungs":"<path d=\"M12 3v7m0 0-4 3m4-3 4 3M9 6C6 6 2 13 3 18c1 4 6 2 7 0V9m5-3c3 0 7 7 6 12-1 4-6 2-7 0V9\"/>","stomach":"<path d=\"M10 3v5c0 3 3 4 5 2 5-4 8 4 4 8-3 4-8 2-10 0-3-3-4-1-4 3M7 3v6c0 4 2 6 5 6\"/>","endocrine":"<path d=\"M10 8C7 3 3 5 3 10s3 9 6 8l3-3 3 3c3 1 6-3 6-8s-4-7-7-2M10 8h4v7h-4Z\"/><path d=\"M12 2v3m0 14v3\"/>","brain":"<path d=\"M12 6c0-4-6-4-6 0-4 0-5 5-2 7-3 4 1 8 4 6 1 3 4 2 4-1V6Zm0 0c0-4 6-4 6 0 4 0 5 5 2 7 3 4-1 8-4 6-1 3-4 2-4-1\"/><path d=\"m6 10 3 2m-2 4 2-1m9-5-3 2m2 4-2-1\"/>","tooth":"<path d=\"M12 5C4 0 1 7 5 13c1 2 1 8 3 8s2-7 4-7 2 7 4 7 2-6 3-8c4-6 1-13-7-8Z\"/><path d=\"m9 5 4 2\"/>",

  search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
  code:'<rect x="4" y="5" width="16" height="14" rx="3"/><path d="m8 12 2 2 5-5"/>',
  id:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="M5.5 15c0-3 5-3 5 0M13 10h5m-5 4h5"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/>',
  success:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  back:'<path d="m14 6-6 6 6 6"/>', next:'<path d="m9 6 6 6-6 6"/>',
  special:'<path d="M12 2 4 5v6c0 5 8 11 8 11s8-6 8-11V5Z"/><path d="m12 6 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5L7 9.5l3.5-.5Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18m-13 5h2m4 0h2"/>',
  pin:'<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  file:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 9h6m-6 4h6m-6 4h3"/>',
  cross:'<path d="M12 5v14m-7-7h14"/>'
};
const icon = key => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fresh = () => ({
  page:'cover', guideContext:null, doctor:null, mode:'date', campus:'', dept:'', date:0, dateAnchor:0, slot:null, expired:null, recovery:false,
  verified:false, archived:false, phone:'', code:'', sends:0, resendAt:0, receipt:false,
  profile:{name:'',id:'',gender:'',birthday:'',height:'',weight:'',job:'',region:defaultRegion.join(''),address:''}
});
let state = fresh();
const params = new URLSearchParams(location.search);
let scenario = {expiry:params.has('expiry'), delayed:params.has('delay')};
let history = [];
let navigationRun = Date.now().toString(36)+Math.random().toString(36).slice(2);
let navigationStep = 0;
let backSource = null;
let recoveryRecord = study.getProgress();
let linkEntry = null;
let linkEntryError = '';
function readBrowserNavigation() {
  try { return window.history?.state?.booking; } catch { return null; }
}
const initialNavigation = readBrowserNavigation();

function captureProgress() {
  if(state.page==='cover') return null;
  return {state:JSON.parse(JSON.stringify(state)),scenario:{...scenario},history:[...history],
    scrollTop:view.scrollTop,navigation:{run:navigationRun,step:navigationStep}};
}
function browserEntry() {
  return {booking:{run:navigationRun,step:navigationStep,attempt:study.identity()?.attempt??null,
    snapshot:captureProgress()}};
}
function syncBrowserEntry() {
  try { window.history?.replaceState(browserEntry(),''); } catch { /* Some embedded browsers restrict history. */ }
}
function pushBrowserEntry() {
  navigationStep++;
  try { window.history?.pushState(browserEntry(),''); } catch { /* Internal navigation still works. */ }
}
function clearTest() {
  study.clear();
  recoveryRecord=null;
  linkEntry=null;
  linkEntryError='';
  navigationRun=Date.now().toString(36)+Math.random().toString(36).slice(2);
  navigationStep=0;
  state=fresh();
  history=[];
}
function validProgress(snapshot) {
  const saved=snapshot?.state;
  const pages=['home','campus','department','doctors','slots','login','method','archive','expired','confirm','success','records','guide','settings'];
  if(!saved||!pages.includes(saved.page)||!snapshot.scenario||!Array.isArray(snapshot.history)) return false;
  if(typeof snapshot.scenario.expiry!=='boolean'||typeof snapshot.scenario.delayed!=='boolean') return false;
  if(!snapshot.history.every(page=>pages.includes(page)||page==='cover')) return false;
  if(!saved.profile||Object.keys(fresh().profile).some(key=>typeof saved.profile[key]!=='string')) return false;
  if(!Number.isInteger(saved.date)||!booking.dates[saved.date] ||
    !Number.isInteger(saved.dateAnchor)||!booking.dates[saved.dateAnchor]) return false;
  if(saved.doctor!==null && (!Number.isInteger(saved.doctor)||!booking.doctors[saved.doctor])) return false;
  if(saved.slot && (!Number.isInteger(saved.slot.day)||!Number.isInteger(saved.slot.index)||!booking.dates[saved.slot.day]?.slots[saved.slot.index])) return false;
  if(['slots','login','method','archive','expired','confirm','success'].includes(saved.page)&&!booking.doctors[saved.doctor]) return false;
  if(['login','method','archive','expired','confirm','success'].includes(saved.page)&&
    (!saved.slot||!booking.dates[saved.slot.day]?.slots[saved.slot.index])) return false;
  return true;
}
function showRestoredTest(record) {
  state={...fresh(),...record.snapshot.state};
  scenario={...record.snapshot.scenario};history=[...record.snapshot.history];
  navigationRun=record.snapshot.navigation?.run||navigationRun;
  navigationStep=initialNavigation?.run===navigationRun ? initialNavigation.step : 0;
  study.log('view',state.page,'background',{result:'resumed_page'});
  render();view.scrollTop=record.snapshot.scrollTop||0;
}

function internalBack() {
  if(backSource) return;
  study.log('result',state.page,'back',{result:'back_requested',source:'page'});
  if(window.history?.back && readBrowserNavigation()?.run===navigationRun && navigationStep>0) {
    syncBrowserEntry();backSource='page';window.history.back();return;
  }
  if(state.page==='confirm') {go('slots',false);return;}
  if(state.page==='expired') {state.recovery=false;go('slots',false);return;}
  if(state.page==='success') {history=[];go('home',false);return;}
  if(state.page==='slots') {go('doctors',false);return;}
  go(history.pop()||'home',false);
}
window.addEventListener('popstate',event=>{
  const entry=event.state?.booking;
  const from=state.page;
  const source=backSource||'browser';backSource=null;
  document.querySelector('.region-dialog')?.close();
  if(!entry||entry.run!==navigationRun) {
    study.log('result',from,'browser-back',{result:'history_boundary',source});
    syncBrowserEntry();return;
  }
  const direction=entry.step<navigationStep?'back':'forward';
  const latest=state;
  const sameAttempt=entry.attempt===(study.identity()?.attempt??null);
  if(entry.snapshot && validProgress(entry.snapshot)) {
    state={...fresh(),...entry.snapshot.state};
    if(sameAttempt) {
      state.profile={...state.profile,...latest.profile};
      for(const key of ['phone','code','verified','archived','receipt']) state[key]=latest[key];
    }
    scenario={...entry.snapshot.scenario};history=[...entry.snapshot.history];
  } else { state=fresh();history=[]; }
  navigationStep=entry.step;
  study.selectAttempt(entry.attempt);
  study.log('result',state.page,'browser-back',{result:'history_navigation',source,direction,from,to:state.page});
  study.log('view',state.page,'background');
  render();
  view.scrollTop=entry.snapshot?.scrollTop||0;
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted) return;
  study.pause();state=fresh();history=[];recoveryRecord=study.getProgress();render();
});

const btn = (label, action, cls='primary') => `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
const intro = (title, note, tag='') => `<div class="intro">${tag ? `<div class="eyebrow">${tag}</div>` : ''}<h1>${title}</h1><p class="muted">${note}</p></div>`;
const choice = (title, note, action, symbol, price='') => `<button type="button" class="choice" data-action="${action}"><span class="choiceIcon">${icon(symbol)}</span><span><strong>${title}</strong><small>${note}</small></span><span class="arrow">${price?'<span class="slot-price">'+price+'</span>':''}${icon('next')}</span></button>`;
const callout = (title, note, tone='') => `<section class="callout ${tone}"><h2>${title}</h2><p class="muted">${note}</p></section>`;
const pairList = pairs => `<dl class="kv">${pairs.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>`;

function progress(step) {
  return `<ol class="progress" aria-label="预约进度">${['选择号源','登录核验','患者信息','确认预约'].map((label,index)=>`<li class="${index === step ? 'active' : index < step ? 'done' : ''}" ${index === step ? 'aria-current="step"' : ''}>${index+1} ${label}</li>`).join('')}</ol>`;
}

function appointmentLines(selected) {
  const day = dates[selected.day].join(' ');
  const time = times[selected.day][selected.index];
  return `<p>${day} · ${time}<br>${esc(state.dept)} · ${slotType(selected.index, selected.day)}</p>`;
}

function summary(label, selected=state.slot) {
  if (!selected) return '';
  const doctor = booking.doctors[selected.doctor ?? state.doctor];
  return `<section class="card summary"><span class="state">${label}</span><h2>${esc(doctor?.name || '预约信息')} · ${esc(state.campus)}</h2>${appointmentLines(selected)}</section>`;
}

function doctorSummary(selected=null) {
  const doctor = booking.doctors[state.doctor];
  const details = selected ? appointmentLines(selected) : `<p>${dates[state.date].join(' ')} · ${esc(state.dept)}</p>`;
  return `<section class="card summary doctor-summary"><span class="doctor-avatar" role="img" aria-label="${esc(doctor.name)}医生头像" style="background-position:${(doctor.portrait%5)*25}% ${Math.floor(doctor.portrait/5)*25}%"></span><div class="doctor-summary-copy"><div class="doctor-heading"><h2>${esc(doctor.name)}</h2><span class="doctor-title">${esc(doctor.title)}</span></div>${details}</div></section>`;
}

const withIcon = (input, symbol) => `<span class="input-icon">${icon(symbol)}${input}</span>`;

function field(label, key, options={}) {
  const value = state.profile[key];
  const id = 'field-' + key;
  const input = options.choices
    ? `<select name="${key}" id="${id}" required><option value="">请选择</option>${options.choices.map(item=>`<option ${item===value?'selected':''}>${item}</option>`).join('')}</select>`
    : `<input id="${id}" name="${key}" value="${esc(value)}" type="${options.type || 'text'}" ${options.attrs || ''} required>`;
  return `<label class="field" for="${id}"><span>${label}</span>${withIcon(input, {name:"person",id:"id",gender:"person",birthday:"calendar",region:"pin",address:"pin"}[key] || "file")}<span class="err" aria-live="polite"></span>${options.note ? `<small>${options.note}</small>` : ''}</label>`;
}

const artwork = `<svg class="hero-art" viewBox="0 0 180 170" aria-hidden="true">
<circle cx="105" cy="83" r="70" fill="#8dc0ff" opacity=".19"/><circle cx="105" cy="83" r="54" fill="none" stroke="#c9e5ff" opacity=".35"/>
<g transform="rotate(10 103 82)"><rect x="55" y="43" width="99" height="92" rx="17" fill="#103a99" opacity=".43"/>
<rect x="49" y="36" width="99" height="92" rx="17" fill="#e5f2ff"/><path d="M49 63h99v-9a18 18 0 0 0-18-18H67a18 18 0 0 0-18 18Z" fill="#a9d4ff"/>
<path d="M75 30v17m48-17v17" stroke="white" stroke-width="7" stroke-linecap="round"/>
<g fill="#b1d4ff"><rect x="64" y="77" width="15" height="12" rx="3"/><rect x="89" y="77" width="15" height="12" rx="3"/><rect x="64" y="98" width="15" height="12" rx="3"/><rect x="89" y="98" width="15" height="12" rx="3"/></g>
<circle cx="131" cy="108" r="23" fill="#104cc3"/><path d="m121 108 7 7 13-14" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="M35 91v19m-9-9h18m109-74v13m-6-6h12" stroke="#d9edff" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

const portraitObserver = new ResizeObserver(entries => {
  for (const {target} of entries) {
    const row=target.closest('.doctor-row');
    const size=target.getBoundingClientRect().height+'px';
    if(row.style.getPropertyValue('--portrait-size')!==size) row.style.setProperty('--portrait-size',size);
  }
});

function render(preserveScroll=false) {
  if(state.page==='cover') recoveryRecord=study.getProgress();
  const previousScroll=view.scrollTop;
  const isCover=state.page==='cover';
  const isHome = state.page === 'home';
  const device = document.querySelector('.device');
  device.classList.toggle('test-cover',isCover);
  device.classList.toggle('home-background',isHome);
  const showHomeButton = state.page === 'success' || (state.page === 'records' && state.receipt);
  const headerButton = showHomeButton
    ? `<button type="button" class="back" data-action="home" aria-label="返回首页">${icon('home')}</button>`
    : `<button type="button" class="back" data-action="back" aria-label="返回">${icon('back')}</button>`;
  topBar.innerHTML = `<div class="topline">${isHome ? '<img class="brand-icon" src="assets/hospital-logo.webp" alt="">' : headerButton}<div><strong>浙大二院</strong><small>互联网医院 · 就医服务</small></div><span class="badge">预约挂号</span></div>`;
  topBar.hidden=isCover;
  const {content, footer} = pageViews[state.page]();
  portraitObserver.disconnect();
  view.innerHTML = content;
  view.querySelectorAll('.doctor-copy').forEach(copy => portraitObserver.observe(copy));
  bottom.innerHTML = footer;
  view.scrollTop = preserveScroll ? previousScroll : 0;
  view.focus({preventScroll:true});
  refreshSms();
  syncBrowserEntry();
}

function visibleDateIndices(selected) {
  const first=Math.max(0,Math.min(selected-1,dates.length-3));
  return [first,first+1,first+2];
}
function dateChoices(expanded=false) {
  return `<div class="days doctor-days">${(expanded?dates.map((_,index)=>index):visibleDateIndices(state.dateAnchor)).map(index=>{
    const [date,day]=dates[index];
    const status=state.mode==='doctor'&&state.doctor!==null ? booking.doctors[state.doctor].schedule[index] : null;
    return `<button type="button" class="day" ${status&&status!=='available'?'disabled':''} aria-pressed="${state.date===index}" data-action="date:${index}">${day}<small>${date}</small>${status?'<small>'+({available:'有号',full:'约满',off:'停诊'}[status])+'</small>':''}</button>`;
  }).join('')}${expanded?'':`<label class="day more-date">${icon('calendar')}<small>更多</small>
  <input id="booking-date" type="date" aria-label="选择更多预约日期" min="${booking.dates[0].iso}" max="${booking.dates.at(-1).iso}" value="${booking.dates[state.date].iso}">
  </label>`}</div>`;
}
document.addEventListener('change',event=>{
  if(event.target.id!=='booking-date') return;
  const day=booking.dates.map(day=>day.iso).indexOf(event.target.value);
  if(day<0) {
    event.target.value=booking.dates[state.date].iso;
    return;
  }
  state.date=day;
  state.dateAnchor=day;
  study.log('click',state.page,'date:'+day);
  render();
  view.querySelector('#booking-date')?.focus({preventScroll:true});
});
function departmentList(query) {
  return departments.map((name,index)=>name.includes(query)?choice(name,'查看普通门诊号源','department:'+index,departmentIcons[index]):'').join('') || '<p class="muted">没有匹配科室，请试试其他关键词。</p>';
}
function smsStatus() {
  if (!state.sends) return '';
  if (scenario.delayed && state.sends===1) return '验证码已发送。若未收到，等待后可重新发送。';
  return '验证码已发送。请查收短信。';
}
let smsTimer;
function refreshSms() {
  clearTimeout(smsTimer);
  const send = document.querySelector('#send-code');
  if (!send) return;
  const seconds = Math.max(0,Math.ceil((state.resendAt-Date.now())/1000));
  send.disabled = seconds>0;
  if(seconds>0) smsTimer=setTimeout(refreshSms,1000);
  send.textContent = seconds ? `${seconds} 秒后可重发` : state.sends ? '重新发送' : '发送验证码';
}
function go(page, remember=true) {
  const previousPage=state.page;
  if(page==='doctors' && state.page!=='doctors') state.mode='date';
  if (remember && page!==state.page) history.push(state.page);
  state.page=page;
  if(page!==previousPage) pushBrowserEntry();
  study.log("view",page);
  render();
}
function finishArchive() {
  state.archived=true;
  if (scenario.expiry && !state.expired) {
    state.expired={...state.slot,doctor:state.doctor};
    go('expired',false);
  } else go('confirm',false);
}
function reset() {
  state=fresh();
  history=[];
  render();
}
document.addEventListener('invalid', event => {
  const input = event.target;
  if (input.id) study.log('invalid',state.page,input.id,{
    reason:input.validity.valueMissing?'required':input.validity.patternMismatch?'format':input.validity.rangeUnderflow||input.validity.rangeOverflow?'range':input.validity.stepMismatch?'step':'custom'
  });
  const error = input.closest('.field')?.querySelector('.err');
  if (error) {
    input.setAttribute('aria-invalid','true');
    error.textContent = input.validity.valueMissing ? '请填写或选择此项。' : input.validationMessage;
  }
}, true);
function openRegion(trigger) {
  study.log('dialog',state.page,'region-dialog',{result:'opened'});
  const dialog=document.createElement('dialog');
  dialog.className='region-dialog';
  dialog.setAttribute('aria-labelledby','region-title');
  dialog.innerHTML=`<form method="dialog"><h2 id="region-title">选择所在地区</h2>
    <label class="field">省份<select name="province"></select></label>
    <label class="field">城市<select name="city"></select></label>
    <label class="field">区县<select name="district"></select></label>
    <div class="row below"><button class="ghost" value="cancel">取消</button><button class="primary" value="confirm">确定</button></div>
  </form>`;
  const [province,city,district]=dialog.querySelectorAll('select');
  const options=(select,items,value)=>{
    select.replaceChildren(...items.map(item=>new Option(item,item,false,item===value)));
  };
  const districts=(selected)=>options(district,divisions[province.value][city.value],selected);
  const cities=(selected)=>options(city,Object.keys(divisions[province.value]),selected);
  const initial=Object.entries(divisions).flatMap(([p,groups])=>
    Object.entries(groups).flatMap(([c,areas])=>areas.map(d=>[p,c,d])))
    .find(parts=>parts.join('')===state.profile.region) || defaultRegion;
  options(province,Object.keys(divisions),initial[0]);
  cities(initial[1]);
  districts(initial[2]);
  province.addEventListener('change',()=>{cities();districts();study.log('dialog',state.page,'region-province',{result:'changed'});});
  city.addEventListener('change',()=>{districts();study.log('dialog',state.page,'region-city',{result:'changed'});});
  district.addEventListener('change',()=>study.log('dialog',state.page,'region-district',{result:'changed'}));
  dialog.addEventListener('close',()=>{
    study.log('dialog',state.page,'region-dialog',{result:dialog.returnValue==='confirm'?'confirmed':'cancelled'});
    if(dialog.returnValue==='confirm'){
      const value=province.value+city.value+district.value;
      state.profile.region=value;
      trigger.textContent=value;
      trigger.closest('.field').querySelector('input').value=value;
    }
    dialog.remove();
    trigger.focus();
  });
  document.querySelector('.device').append(dialog);
  dialog.showModal();
}

function updateIdentity(input) {
  const value=input.value;
  const error=input.closest('.field').querySelector('.err');
  let message='', birthday='', gender='';
  if (value.length===18) {
    const weights=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
    const sum=weights.reduce((total,weight,i)=>total+Number(value[i])*weight,0);
    const date=value.slice(6,10)+'-'+value.slice(10,12)+'-'+value.slice(12,14);
    const parsed=new Date(date);
    if (!/^[0-9]{17}[0-9Xx]$/.test(value)) message='身份证号错误';
    else if ('10X98765432'[sum%11]!==value[17].toUpperCase()) message='身份证号错误';
    else if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || parsed>Date.now()) message='身份证号错误';
    else {
      birthday=date;
      gender=Number(value[16])%2?'男':'女';
    }
  }
  if (value && value.length!==18) input.setCustomValidity('身份证号错误');
  else input.setCustomValidity(message);
  if(message && error.textContent!==message) study.log('invalid',state.page,input.id,{reason:'identity'});
  error.textContent=message;
  input.toggleAttribute('aria-invalid',Boolean(message));
  if (message) input.setAttribute('aria-invalid','true');
  state.profile.birthday=input.form.elements.namedItem('birthday').value=birthday;
  state.profile.gender=input.form.elements.namedItem('gender').value=gender;
}

function handleInput(event) {
  const input=event.target;
  if (input.id==='search') document.querySelector('#dept-list').innerHTML=departmentList(input.value.trim());
  if (input.form?.matches('#archive-form')) {
    input.setCustomValidity('');
    state.profile[input.name]=input.value;
    input.removeAttribute('aria-invalid');
    input.closest('.field').querySelector('.err').textContent='';
    if (input.name==='id') updateIdentity(input);
  }
  if (input.form?.id==='login-form') {
    input.setCustomValidity('');
    if (input.name==='phone' && state.phone!==input.value) {
      state.sends=0;
      state.resendAt=0;
      document.querySelector('#sms-status').textContent=smsStatus();
      document.querySelector('#code').setCustomValidity('');
      refreshSms();
    }
    state[input.name]=input.value;
  }
}
document.addEventListener('input',handleInput);
document.addEventListener('change',handleInput);
document.addEventListener('submit',async event=>{
  if(event.target.getAttribute('method')==='dialog') return;
  event.preventDefault();
  if(event.target.id!=='test-entry') study.log('submit',state.page,event.target.getAttribute('id').replace('-form','-submit'));
  if(event.target.id==='test-entry') {
    const name=event.target.elements.namedItem('participant').value.trim();
    if(!name) {
      document.querySelector('#entry-error').textContent='请填写姓名。';
      return;
    }
    const button=event.target.querySelector('button');
    if(button.disabled) return;
    button.disabled=true;
    if(await study.begin(name,false,scenario)) {
      history=[];
      go('home',false);
    } else {
      button.disabled=false;
      const notice=document.querySelector('#entry-error');
      if(notice) notice.textContent='暂时无法开始测试，请检查网络后重试。';
    }
    return;
  }
  if (event.target.matches('#archive-form')) {
    const form=event.target;
    for(const key of ['name','address']) {
      const field=form.elements.namedItem(key);
      field.value=field.value.trim();
    }
    const id=form.elements.namedItem('id');
    updateIdentity(id);
    if (!form.reportValidity()) return;
    for (const [key,value] of new FormData(form)) state.profile[key]=value;
    study.log('result',state.page,'archive-submit',{result:'archive_completed'});
    finishArchive();
  }
  if (event.target.id==='login-form') {
    study.log('result',state.page,'login-submit',{result:'login_completed'});
    state.verified=true;
    go('method',false);
  }
});
document.addEventListener('click',async event=>{
  if(event.target.id==='booking-date' && event.target.showPicker) {
    try { event.target.showPicker(); } catch { /* Native focus opens the picker on supported mobile browsers. */ }
  }
  const target=event.target.closest('[data-action]');
  const control=event.target.closest('input,select,button');
  const code=target?.dataset.action || (control?.form?.id && control.type==='submit'
    ? control.form.getAttribute('id').replace('-form','-submit') : control?.id || 'background');
  if (code==='archive-submit') document.activeElement?.blur();

  study.log('click',state.page,code);
  if (!target) return;
  const [action,index]=target.dataset.action.split(':');
  switch(action) {
    case 'link-retry': await enterLinkedTest();break;
    case 'link-cancel':
      linkEntry=null;linkEntryError='';removeLinkParameters();render();break;
    case 'restart':
      clearTest();render();
      break;
    case 'resume': {
      const record=recoveryRecord;
      target.disabled=true;
      if(!record || !validProgress(record.snapshot) || !await study.resume(record)) {
        target.disabled=false;
        const notice=document.querySelector('#resume-error');
        if(notice) notice.textContent='暂时无法恢复，请检查网络后重试或重新开始。';
        break;
      }
      showRestoredTest(record);
      break;
    }
    case 'debug':
      clearTest();
      await study.begin('',true);
      history=[];
      go('home',false);
      break;
    case 'home': history=[];go('home',false);break;
    case 'start':
      target.disabled=true;
      if(await study.beginAttempt(scenario)) {
        syncBrowserEntry();
        state=fresh();history=[];
        go('campus',false);
      } else {
        target.disabled=false;
        study.log('result',state.page,'start',{result:'attempt_start_failed'});
        if(!view.querySelector('.attempt-error')) target.insertAdjacentHTML('afterend','<p class="err attempt-error" role="alert">暂时无法开始，请稍后重试。</p>');
      }
      break;
    case 'back': internalBack();break;
    case 'campus': state.campus=campusData[index][0];state.expired=null;go('department');break;
    case 'department': if(state.dept!==departments[index]) state.expired=null;state.dept=departments[index];state.date=0;state.dateAnchor=0;state.doctor=null;go('doctors');break;
    case 'mode':
      state.mode=index;
      if(index==='doctor'&&state.doctor!==null&&booking.doctors[state.doctor].schedule[state.date]!=='available') {
        state.date=booking.doctors[state.doctor].schedule.indexOf('available');
        state.dateAnchor=state.date;
      }
      render();
      break;
    case 'doctor':
      if(state.mode==='doctor'&&state.doctor===Number(index)) {
        state.doctor=null;
        render(true);
        break;
      }
      if(state.mode==='date'&&booking.doctors[Number(index)].schedule[state.date]!=='available') break;
      state.doctor=Number(index);
      if(state.mode==='doctor'&&booking.doctors[state.doctor].schedule[state.date]!=='available') {
        state.date=booking.doctors[state.doctor].schedule.indexOf('available');
        state.dateAnchor=state.date;
      }
      if(state.mode==='date') go('slots');
      else {render(true);}
      break;
    case 'doctor-next': if(booking.doctors[state.doctor]?.schedule[state.date]==='available') go('slots');break;
    case 'change-doctor': go('doctors');break;
    case 'date':
      if(state.mode==='doctor'&&state.doctor!==null&&booking.doctors[state.doctor].schedule[Number(index)]!=='available') break;
      state.date=Number(index);
      render(true);
      document.querySelector(`[data-action="date:${index}"]`).focus({preventScroll:true});
      break;
    case 'slot':
      if(booking.doctors[state.doctor]?.schedule[state.date]!=='available') break;
      state.slot={day:state.date,index:Number(index)};
      if (state.archived) go('confirm',false);
      else go(state.verified?'method':'login');
      break;
    case 'method':
    case 'archive':
    case 'records':
    case 'settings': go(action);break;
    case 'guide': state.guideContext=index==='home'?'home':'campus';go('guide');break;
    case 'field-region': openRegion(target);break;
    case 'send': {
      const phone=document.querySelector('#phone');
      if (!phone.reportValidity()) break;
      state.sends++;
      study.log('result',state.page,'send',{result:state.sends===1?'sms_requested':'sms_resent'});
      state.resendAt=Date.now()+booking.resendSeconds*1000;
      document.querySelector('#code').setCustomValidity('');
      document.querySelector('#sms-status').textContent=smsStatus();
      refreshSms();
      break;
    }
    case 'recover':
      state.recovery=true;
      state.date=state.expired.day;
      state.dateAnchor=state.date;
      go('doctors',false);
      break;
    case 'sample':
      Object.assign(state.profile,{name:'测试用户',id:'00000019601013000X',gender:'女',birthday:'1960-10-13',height:'160',weight:'56',job:'退休',region:'浙江省杭州市滨江区',address:'演示路 1 号'});
      for(const field of document.querySelector('#archive-form').elements) {
        if (field.name in state.profile) {
          field.value=state.profile[field.name];
          field.dispatchEvent(new Event('input',{bubbles:true}));
        }
      }
      document.querySelector('[form="archive-form"]').focus();
      break;
    case 'cancel-booking': {
      const page=state.page;
      if((page!=='success' && page!=='records') || !state.receipt || target.disabled || !window.confirm('确定取消本次预约吗？')) break;
      target.disabled=true;
      const attempt=study.identity()?.attempt;
      const cancelled=await study.cancelBooking();
      if(study.identity()?.attempt!==attempt) break;
      if(cancelled) state.receipt=false;
      study.log('result', page, 'cancel-booking', {result:cancelled?'booking_cancelled':'cancel_failed'});
      if(cancelled) {
        if(state.page==='success' || state.page==='records') render();
      } else if(target.isConnected) {
        target.disabled=false;
        if(!bottom.querySelector('.err')) bottom.insertAdjacentHTML('beforeend','<p class="err" role="alert">暂时无法取消，请稍后重试。</p>');
      }
      break;
    }
    case 'submit': {
      target.disabled=true;
      const form=[campusData.findIndex(([name])=>name===state.campus),departments.indexOf(state.dept),
        state.slot.day,state.slot.index,Object.values(state.profile).reduce((mask,value,i)=>mask | (value.trim()?1<<i:0),0)];
      const activeAttempt=study.identity()?.attempt;
      const saved=await study.save(form,[state.profile.name,state.profile.id,state.phone,state.code,state.profile.address],state.doctor,{...state.profile});
      if(study.identity()?.attempt!==activeAttempt) break;
      if (saved) {
        study.log('result',state.page,'submit',{result:'submission_saved'});
        state.receipt=true;
        go('success',false);
      } else {
        study.log('result',state.page,'submit',{result:'submission_failed'});
        target.disabled=false;
        if (!bottom.querySelector('.err')) bottom.insertAdjacentHTML('beforeend','<p class="err" role="alert">暂时无法提交，请稍后重试。</p>');
      }
      break;
    }
    case 'apply':
      scenario={expiry:document.querySelector('#expiry').value==='1',delayed:document.querySelector('#delayed').value==='1'};
      reset();
      break;
  }
});
study.setSnapshotReader(captureProgress);
// Restrict touch zoom while preserving normal scrolling.
document.addEventListener('gesturestart', event => event.preventDefault(), {passive:false});
document.addEventListener('gesturechange', event => event.preventDefault(), {passive:false});
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, {passive:false});
document.addEventListener('dblclick', event => event.preventDefault());
