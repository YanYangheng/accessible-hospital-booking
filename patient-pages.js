'use strict';

pageViews.login = () => {
  let content;
  let footer = '';
  content = progress(1)+intro('登录账号','手机号码验证登录')+doctorSummary(state.slot)+
    `<form id="login-form" class="card" autocomplete="off"><label class="field" for="phone">手机号码
    ${withIcon(`<input id="phone" name="phone" inputmode="numeric" maxlength="11" placeholder="请输入11位手机号" value="${esc(state.phone)}" required pattern="1[0-9]{10}">`, "phone")}</label>
    <div class="sms-row"><label class="field" for="code">短信验证码${withIcon(`<input id="code" name="code" inputmode="numeric" maxlength="6" placeholder="请输入 6 位验证码" value="${esc(state.code)}" required pattern="[0-9]{6}">`, "code")}</label>
    <div><button class="secondary" type="button" id="send-code" data-action="send">发送验证码</button></div></div>
    <p id="sms-status" class="muted below" aria-live="polite">${smsStatus()}</p></form>`;
  footer = '<button class="primary" type="submit" form="login-form">验证并继续</button>';
  return {content, footer};
};

pageViews.method = () => {
  let content;
  let footer = '';
  content = progress(2)+intro('选择建档方式','首次在本院线上预约，需先建立就诊人档案。')+doctorSummary(state.slot)+
    `<div class="stack">${choice('在线建档','一次核对并填写资料，完成后继续预约','archive','file')}
    ${choice('到院人工协助','查看办理材料、地点和后续步骤','guide','person')}</div>`;
  return {content, footer};
};

pageViews.archive = () => {
  let content;
  let footer = '';
  content = progress(2)+intro('首次就诊建档','完成建档后，您将返回预约确认。')+doctorSummary(state.slot)+
    `<form id="archive-form" novalidate autocomplete="off"><section class="card"><h2>身份信息</h2><p class="muted">请准确填写身份信息。</p>
    ${field('姓名','name',{attrs:'maxlength="20" placeholder="请输入姓名"'})}
    ${field('证件号码（居民身份证）','id',{attrs:'maxlength="18" pattern="[0-9]{17}[0-9Xx]" placeholder="18 位身份证号码"'})}
    <div class="form-grid">${field('性别','gender',{attrs:'readonly placeholder="自动识别"'})}${field('出生日期','birthday',{attrs:'readonly placeholder="自动识别"'})}</div>
    </section>
    <section class="card below"><h2>建档资料</h2><p class="muted">请补充就诊人资料。</p>
    <div class="form-grid">${field('身高（厘米）','height',{type:'number',attrs:'min="30" max="250" step="0.1"'})}${field('体重（公斤）','weight',{type:'number',attrs:'min="2" max="350" step="0.1"'})}</div>
    ${field('职业','job',{choices:booking.jobs})}
    ${`<div class="field"><span id="region-label">所在地区</span>
    ${withIcon(`<button id="field-region" class="region-control" type="button" aria-haspopup="dialog" aria-labelledby="region-label field-region" data-action="field-region">${esc(state.profile.region)}</button>`,'pin')}
    <input type="hidden" name="region" value="${esc(state.profile.region)}"></div>`}
    ${field('详细地址','address',{attrs:'maxlength="100" placeholder="请输入详细地址"'})}</section>
    <div class="row wrap below">${btn('查看人工协助','guide','ghost')}</div></form>`;
  footer = '<button class="primary" type="submit" form="archive-form">完成建档</button>';
  return {content, footer};
};

pageViews.confirm = () => {
  let content;
  let footer = '';
  content = progress(3)+intro('确认预约信息','请核对就诊人和就诊时间。')+summary('待确认 · 尚未预约')+
    `<section class="card"><h2>本次就诊</h2>${pairList([['就诊人',esc(state.profile.name)],['联系手机',esc(state.phone.slice(0,3)+'****'+state.phone.slice(-4))],['就诊档案','建档已完成'],['门诊类型',slotType(state.slot.index,state.slot.day)],['挂号费用',slotFee(state.slot.index,state.slot.day)]])}</section>
    <p class="footnote">请核对信息后提交。</p>`;
  footer = btn('提交预约','submit');
  return {content, footer};
};

pageViews.records = () => {
  let content;
  let footer = '';
  content = state.receipt
    ? intro(state.page==='success'?'预约成功':'我的预约','请按预约时段到院。')+summary('预约已确认')+
      callout('就诊提醒','请提前到达院区，按医院实际安排报到候诊。','success')
    : intro('我的预约','还没有预约记录。');
  footer = btn('返回首页','home');
  return {content, footer};
};

pageViews.success = pageViews.records;
