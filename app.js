'use strict';

const topBar = document.querySelector('#top');
const view = document.querySelector('#view');
const bottom = document.querySelector('#bottom');
const campusData = [
  ['滨江院区','滨江区江虹路1511号'],
  ['解放路院区','上城区解放路88号'],
  ['城东院区','上城区源聚路300号'],
  ['博奥院区','萧山区博奥路与建设一路交叉口'],
  ['眼科院区','上城区']
];
const departments = ['普内科门诊','老年病综合门诊','全科医学科门诊','心血管内科门诊','呼吸内科门诊','消化内科门诊','内分泌科门诊','神经内科门诊','口腔科门诊'];
const dates = [['10月13日','周二'],['10月14日','周三'],['10月15日','周四']];
const times = [['11:00–11:30','11:30–12:00','14:00–14:30'],['08:30–09:00','09:00–09:30','14:00–14:30'],['09:30–10:00','10:00–10:30','14:30–15:00']];
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
  code:'<rect x="4" y="5" width="16" height="14" rx="3"/><path d="m8 12 2 2 5-5"/>',
  id:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="M5.5 15c0-3 5-3 5 0M13 10h5m-5 4h5"/>',
  back:'<path d="m14 6-6 6 6 6"/>', next:'<path d="m9 6 6 6-6 6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18m-13 5h2m4 0h2"/>',
  pin:'<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  file:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 9h6m-6 4h6m-6 4h3"/>',
  cross:'<path d="M12 5v14m-7-7h14"/>'
};
const icon = key => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fresh = () => ({
  page:'home', campus:'', dept:'', date:0, slot:null, expired:null, recovery:false,
  verified:false, archived:false, phone:'', code:'', sends:0, resendAt:0, receipt:false,
  profile:{name:'',id:'',gender:'',birthday:'',height:'',weight:'',job:'',region:'',address:''}
});
let state = fresh();
const params = new URLSearchParams(location.search);
let scenario = {expiry:params.has('expiry'), delayed:params.has('delay')};
let history = [];
const btn = (label, action, cls='primary') => `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
const intro = (title, note, tag='') => `<div class="intro">${tag ? `<div class="eyebrow">${tag}</div>` : ''}<h1>${title}</h1><p class="muted">${note}</p></div>`;
const choice = (title, note, action, symbol) => `<button type="button" class="choice" data-action="${action}"><span class="choiceIcon">${icon(symbol)}</span><span><strong>${title}</strong><small>${note}</small></span><span class="arrow">${icon('next')}</span></button>`;
const callout = (title, note, tone='') => `<section class="callout ${tone}"><h2>${title}</h2><p class="muted">${note}</p></section>`;
const pairList = pairs => `<dl class="kv">${pairs.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>`;

function progress(step) {
  return `<ol class="progress" aria-label="预约进度">${['选择号源','登录核验','患者信息','确认预约'].map((label,index)=>`<li class="${index === step ? 'active' : index < step ? 'done' : ''}" ${index === step ? 'aria-current="step"' : ''}>${index+1} ${label}</li>`).join('')}</ol>`;
}

function summary(label, selected=state.slot) {
  if (!selected) return '';
  return `<section class="card summary"><span class="state">${label}</span><h2>${esc(state.dept)} · 普通号</h2><p>${esc(state.campus)} · ${dates[selected.day].join(' ')} · ${times[selected.day][selected.index]}</p></section>`;
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

function render() {
  const isHome = state.page === 'home';
  topBar.innerHTML = `<div class="topline">${isHome ? '<img class="brand-icon" src="assets/hospital-logo.webp" alt="">' : `<button type="button" class="back" data-action="back" aria-label="返回">${icon('back')}</button>`}<div><strong>浙大二院</strong><small>互联网医院 · 就医服务</small></div><span class="badge">预约挂号</span></div>`;
  let content = '';
  let footer = '';
  switch (state.page) {
    case 'home':
      content = `<section class="hero"><span class="eyebrow">门诊服务</span>${artwork}<h1>预约挂号</h1><p>选择就诊时间，按提示完成首次就诊准备。</p>${btn('开始预约 '+icon('next'),'start')}</section>
      <section class="section"><div class="row"><h2>就医服务</h2></div><div class="stack below">
      ${choice('我的预约',state.receipt?'查看本次预约记录':'查看的预约状态','records','calendar')}
      ${choice('首次就诊准备','了解线上建档和到院人工协助','guide','person')}</div></section>
      <p class="footnote"></p>`;
      break;
    case 'campus':
      content = progress(0)+intro('选择就诊院区','先选院区，再查看该院区的门诊号源。')+
        `<div class="stack">${campusData.map(([name,address],index)=>choice(name,address,'campus:'+index,'pin')).join('')}</div>`;
      break;
    case 'department':
      content = progress(0)+intro('选择就诊科室',esc(state.campus)+'')+
        `<label class="field" for="search">搜索科室${withIcon('<input id="search" class="search" placeholder="例如：普内科" type="search">', "search")}</label>`+
        `<div class="stack below" id="dept-list">${departmentList('')}</div>`;
      break;
    case 'slots':
      content = progress(state.recovery?3:0)+intro(state.recovery?'选择替代号源':'选择就诊时间',`${esc(state.campus)} · ${esc(state.dept)}`);
      if (state.recovery) content += callout('已保留就诊资料','您可以直接换一个时间，无需重新选择院区、科室或填写资料。') ;
      content += `<section class="section"><h2>预约日期</h2><div class="days">${dates.map(([date,day],index)=>`<button type="button" class="day" aria-pressed="${state.date===index}" data-action="date:${index}">${date}<small>${day}</small></button>`).join('')}</div>
        <div class="row"><h2>普通号</h2><span class="state">¥15.30</span></div>
        <div class="stack below">${times[state.date].map((time,index)=>state.expired?.day===state.date&&state.expired?.index===index
          ? `<div class="card muted">${time} · 已不可预约</div>`
          : choice(time,`${index<2?'上午':'下午'} · 有号`,'slot:'+index,'calendar')).join('')}</div>
        <p class="footnote">时段为预估候诊时间，以实际叫号为准。</p></section>`;
      break;
    case 'login':
      content = progress(1)+intro('验证手机号码','用于确认就诊联系信息。')+summary('已选择')+
        `<form id="login-form" class="card" autocomplete="off"><label class="field" for="phone">手机号码
        ${withIcon(`<input id="phone" name="phone" inputmode="numeric" maxlength="11" placeholder="例如 13800000000" value="${esc(state.phone)}" required pattern="1[0-9]{10}">`, "phone")}</label>
        <div class="sms-row"><label class="field" for="code">短信验证码${withIcon(`<input id="code" name="code" inputmode="numeric" maxlength="6" placeholder="请输入 6 位验证码" value="${esc(state.code)}" required pattern="[0-9]{6}">`, "code")}</label>
        <div><button class="secondary" type="button" id="send-code" data-action="send">发送验证码</button></div></div>
        <p id="sms-status" class="muted below" aria-live="polite">${smsStatus()}</p></form>`;
      footer = '<button class="primary" type="submit" form="login-form">验证并继续</button>';
      break;
    case 'method':
      content = progress(2)+intro('选择建档方式','首次在本院线上预约，需先建立就诊人档案。')+summary('已选择')+
        `<div class="stack">${choice('在线建档','一次核对并填写资料，完成后继续预约','archive','file')}
        ${choice('到院人工协助','查看办理材料、地点和后续步骤','guide','person')}</div>`;
      break;
    case 'archive':
      content = progress(2)+intro('首次就诊建档','完成建档后，您将返回预约确认。')+summary('已选择')+
        `<form id="archive-form" novalidate autocomplete="off"><section class="card"><h2>身份信息</h2><p class="muted">用于识别就诊人，请核对身份信息。</p>
        ${field('姓名','name',{attrs:'maxlength="20" placeholder="请输入姓名"'})}
        ${field('证件号码（居民身份证）','id',{attrs:'maxlength="18" pattern="[0-9]{17}[0-9Xx]" placeholder="18 位身份证号码"'})}
        <div class="form-grid">${field('性别','gender',{attrs:'readonly placeholder="自动识别"'})}${field('出生日期','birthday',{attrs:'readonly placeholder="自动识别"'})}</div>
        <p class="muted below">国籍或地区：中国大陆</p></section>
        <section class="card below"><h2>补充建档资料</h2><p class="muted">请补充就诊人资料。</p>
        <div class="form-grid">${field('身高（厘米）','height',{type:'number',attrs:'min="30" max="250" step="0.1"'})}${field('体重（公斤）','weight',{type:'number',attrs:'min="2" max="350" step="0.1"'})}</div>
        ${field('职业','job',{choices:['退休','在职','学生','其他']})}
        ${field('所在地区','region',{choices:['浙江省杭州市滨江区','浙江省杭州市上城区','浙江省杭州市萧山区','其他地区']})}
        ${field('详细地址','address',{attrs:'maxlength="100" placeholder="请输入详细地址"'})}</section>
        <div class="row wrap below">${btn('查看人工协助','guide','ghost')}</div></form>`;
      footer = '<button class="primary" type="submit" form="archive-form">完成建档</button>';
      break;
    case 'expired':
      content = progress(3)+intro('原号源已不可预约','请重新选择一个就诊时间。')+summary('已失效',state.expired)+
        callout('建档已完成','您的就诊资料已保存。您可以直接在同一院区和科室换号。','warn');
      footer = btn('查看同科室其他号源','recover');
      break;
    case 'confirm':
      content = progress(3)+intro('确认预约信息','请核对就诊人和就诊时间。')+summary('待确认 · 尚未预约')+
        `<section class="card"><h2>本次就诊</h2>${pairList([['就诊人',esc(state.profile.name)],['联系手机',esc(state.phone.slice(0,3)+'****'+state.phone.slice(-4))],['就诊档案','建档已完成'],['挂号费用','¥15.30']])}</section>
        <p class="footnote">请核对信息后提交。</p>`;
      footer = btn('提交预约','submit');
      break;
    case 'success':
    case 'records':
      content = state.receipt
        ? intro(state.page==='success'?'预约成功':'我的预约','请按预约时段到院。')+summary('预约已确认')+
          callout('就诊提醒','请提前到达院区，按医院实际安排报到候诊。','success')
        : intro('我的预约','还没有预约记录。');
      footer = btn('返回首页','home');
      break;
    case 'guide':
      content = intro('到院人工协助','适合希望在工作人员协助下建档的就诊人。')+
        callout('当前尚未预约','此处提供建档办理指引。完成办理后，可再次进入线上预约。','warn')+
        `<section class="card below"><h2>办理指引</h2>${pairList([['办理地点',esc(state.campus||'所选院区')+'门诊服务台'],['所需材料','本人有效身份证件'],['办理时间','以院区服务公告为准'],['下一步','请服务台协助建档，完成后继续预约']])}</section>
        <p class="footnote">具体安排以院区公告为准。</p>`;
      footer = btn(history.at(-1)==='archive'?'返回继续填写':'返回上一页','back');
      break;
    case 'settings':
      content = intro('','从首页启动下一次演示，统一任务情境。')+
        `<section class="card"><label class="field"><span>建档完成时的号源状态</span><select id="expiry"><option value="0">原号源仍可用</option><option value="1" ${scenario.expiry?'selected':''}>原号源失效，触发重选</option></select></label>
        <label class="field"><span>短信发送情境</span><select id="delayed"><option value="0">首次收到验证码</option><option value="1" ${scenario.delayed?'selected':''}>首次未收到，重发后收到</option></select></label>
        <p class="footnote">开始新一轮时会清除当前表单和预约记录。验证码重发等待设为 30 秒。</p></section>`;
      footer = btn('应用设置并返回首页','apply');
      break;
  }
  view.innerHTML = content;
  bottom.innerHTML = footer;
  view.scrollTop = 0;
  view.focus({preventScroll:true});
  refreshSms();
}

function departmentList(query) {
  return departments.map((name,index)=>name.includes(query)?choice(name,'查看普通门诊号源','department:'+index,'cross'):'').join('') || '<p class="muted">没有匹配科室，请试试其他关键词。</p>';
}
function smsStatus() {
  if (!state.sends) return '验证后可继续首次建档。';
  if (scenario.delayed && state.sends===1) return '验证码已发送。若未收到，等待后可重新发送。';
  return '验证码已发送。请查收短信。';
}
function refreshSms() {
  const send = document.querySelector('#send-code');
  if (!send) return;
  const seconds = Math.max(0,Math.ceil((state.resendAt-Date.now())/1000));
  send.disabled = seconds>0;
  send.textContent = seconds ? `${seconds} 秒后可重发` : state.sends ? '重新发送' : '发送验证码';
}
function go(page, remember=true) {
  if (remember && page!==state.page) history.push(state.page);
  state.page=page;
  study.log("view",page);
  render();
}
function finishArchive() {
  state.archived=true;
  if (scenario.expiry && !state.expired) {
    state.expired={...state.slot};
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
  if (input.id) study.log('invalid',state.page,input.id);
  const error = input.closest('.field')?.querySelector('.err');
  if (error) {
    input.setAttribute('aria-invalid','true');
    error.textContent = input.validity.valueMissing ? '请填写或选择此项。' : input.validationMessage;
  }
}, true);
function updateIdentity(input) {
  const value=input.value;
  const error=input.closest('.field').querySelector('.err');
  let message='', birthday='', gender='';
  if (value.length===18) {
    const weights=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
    const sum=weights.reduce((total,weight,i)=>total+Number(value[i])*weight,0);
    const date=value.slice(6,10)+'-'+value.slice(10,12)+'-'+value.slice(12,14);
    const parsed=new Date(date);
    if (!/^[0-9]{17}[0-9Xx]$/.test(value)) message='请输入正确格式的身份证号码。';
    else if ('10X98765432'[sum%11]!==value[17].toUpperCase()) message='身份证号码末位校验不通过，请核对证件号码。';
    else if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || parsed>Date.now()) message='身份证号码中的出生日期无效。';
    else {
      birthday=date;
      gender=Number(value[16])%2?'男':'女';
    }
  }
  input.setCustomValidity(message);
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
document.addEventListener('submit',event=>{
  event.preventDefault();
  if (event.target.matches('#archive-form')) {
    const form=event.target;
    const id=form.elements.namedItem('id');
    updateIdentity(id);
    if (!form.reportValidity()) return;
    for (const [key,value] of new FormData(form)) state.profile[key]=value;
    finishArchive();
  }
  if (event.target.id==='login-form') {
    state.verified=true;
    go('method',false);
  }
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');
  const control=event.target.closest('input,select,button');
  const code=target?.dataset.action || (control?.form?.id && control.type==='submit'
    ? control.form.getAttribute('id').replace('-form','-submit') : control?.id || 'background');
  if (code==='archive-submit') document.activeElement?.blur();
  if (code==='start') study.begin();
  study.log('click',state.page,code);
  if (!target) return;
  const [action,index]=target.dataset.action.split(':');
  switch(action) {
    case 'home': history=[];go('home',false);break;
    case 'start': reset();go('campus');break;
    case 'back':
      if (state.page==='confirm' && state.recovery) {go('slots',false);break;}
      if (state.page==='confirm' || state.page==='expired') {state.recovery=false;go('slots',false);break;}
      if (state.page==='success') {history=[];go('home',false);break;}
      if (state.page==='slots' && state.recovery) {go('expired',false);break;}
      go(history.pop()||'home',false);break;
    case 'campus': state.campus=campusData[index][0];state.expired=null;go('department');break;
    case 'department': if(state.dept!==departments[index]) state.expired=null;state.dept=departments[index];state.date=0;go('slots');break;
    case 'date':
      state.date=Number(index);
      render();
      document.querySelector(`[data-action="date:${index}"]`).focus();
      break;
    case 'slot':
      state.slot={day:state.date,index:Number(index)};
      if (state.archived) go('confirm',false);
      else go(state.verified?'method':'login');
      break;
    case 'method':
    case 'archive':
    case 'guide':
    case 'records':
    case 'settings': go(action);break;
    case 'send': {
      const phone=document.querySelector('#phone');
      if (!phone.reportValidity()) break;
      state.sends++;
      state.resendAt=Date.now()+30000;
      document.querySelector('#code').setCustomValidity('');
      document.querySelector('#sms-status').textContent=smsStatus();
      refreshSms();
      break;
    }
    case 'recover':
      state.recovery=true;
      state.date=state.expired.day;
      go('slots',false);
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
    case 'submit': {
      target.disabled=true;
      const form=[campusData.findIndex(([name])=>name===state.campus),departments.indexOf(state.dept),
        state.slot.day,state.slot.index,Object.values(state.profile).reduce((mask,value,i)=>mask | (value.trim()?1<<i:0),0)];
      if (await study.save(form,[state.profile.name,state.profile.id,state.phone,state.code,state.profile.address])) {
        state.receipt=true;
        go('success',false);
      } else {
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
study.log("view",state.page);
render();
setInterval(refreshSms,250);
