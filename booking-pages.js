'use strict';

pageViews.campus = () => {
  let content;
  let footer = '';
  content = progress(0)+intro('选择就诊院区','先选院区，再查看该院区的门诊号源。')+
    `<div class="stack">${campusData.map(([name,address],index)=>choice(name,address,'campus:'+index,'pin')).join('')}</div>`;
  return {content, footer};
};

pageViews.department = () => {
  let content;
  let footer = '';
  content = progress(0)+intro('选择就诊科室',esc(state.campus)+'')+
    `<label class="field" for="search">搜索科室${withIcon('<input id="search" class="search" placeholder="例如：普内科" type="search">', "search")}</label>`+
    `<div class="stack below" id="dept-list">${departmentList('')}</div>`;
  return {content, footer};
};

pageViews.doctors = () => {
  let content;
  let footer = '';
  content=progress(0)+intro('选择医生和日期',esc(state.campus)+' · '+esc(state.dept));
  content+=`<div class="booking-tabs" role="group" aria-label="预约方式">
    <button data-action="mode:date" aria-pressed="${state.mode==='date'}">按日期预约</button>
    <button data-action="mode:doctor" aria-pressed="${state.mode==='doctor'}">按医生预约</button></div>`;
  if(state.mode==='date') content+=dateChoices();
  content+=`<div class="doctor-list">${booking.doctors.filter(d=>d.department===departments.indexOf(state.dept) && (state.mode==='doctor' || d.schedule[state.date]!=='off')).map(d=>`
    <div class="doctor-entry"><article class="doctor-row"><span class="doctor-avatar" role="img" aria-label="${d.name}医生头像" style="background-position:${(d.portrait%5)*25}% ${Math.floor(d.portrait/5)*25}%"></span>
    <div class="doctor-copy"><div class="doctor-heading"><h2>${d.name}</h2><span class="doctor-title">${d.title}</span></div><p class="doctor-bio">${d.bio}</p></div>
    <button class="secondary ${state.mode==='date'&&d.schedule[state.date]==='full'?'fully-booked':''}" data-action="doctor:${d.id}" ${state.mode==='doctor' ? `aria-expanded="${state.doctor===d.id}" aria-controls="doctor-dates-${d.id}"` : ''} aria-label="${state.mode==='date'&&d.schedule[state.date]==='full'?'约满':'预约'}${d.name}" ${state.mode==='date'&&d.schedule[state.date]==='full'?'disabled':''}>${state.mode==='date'&&d.schedule[state.date]==='full'?'约满':'预约'}</button></article>
    ${state.mode==='doctor'&&state.doctor===d.id ? `<section class="doctor-date-panel" id="doctor-dates-${d.id}"><h2>选择日期</h2>${dateChoices(true)}${d.schedule[state.date]==='available'?btn('下一步','doctor-next'):'<p class="muted below">该医生当天'+(d.schedule[state.date]==='full'?'已约满':'停诊')+'，请选择其他日期或医生。</p>'}</section>` : ''}</div>`).join('')}</div>`;
  return {content, footer};
};

pageViews.slots = () => {
  let content;
  let footer = '';
  content=progress(0)+intro('选择就诊时间',esc(state.campus)+' · '+esc(state.dept))+
    `${doctorSummary()}
    <div class="row"><h2>当天可选时段</h2></div>
    <div class="stack below">${times[state.date].map((time,index)=>choice(time,`${index<2?'上午':'下午'} · ${slotType(index)}`,'slot:'+index,clinicAt(index).icon,slotFee(index))).join('')}</div>
    <p class="footnote">时段为预估候诊时间，以实际叫号为准。</p>`;
  return {content, footer};
};
