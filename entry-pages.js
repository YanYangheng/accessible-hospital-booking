'use strict';

const pageViews = {};
pageViews.cover = () => {
  let content;
  let footer = '';
  content=`<section class="cover-content"><div class="cover-symbol">${icon('calendar')}</div>
  <h1>预约挂号系统v2原型测试</h1>
  <p class="muted">本项目关注首次就诊时的线上建档与预约挂号体验。我们根据前期用户测试发现的问题制作了改进原型，希望通过本次体验了解改进后的流程是否清晰、操作是否顺畅。请按照任务要求操作，本次操作会被记录。</p>
  ${linkEntry?linkEntryMarkup():recoveryRecord?`<div class="cover-actions"><p class="muted">检测到上次的测试记录，是否继续？</p>
  ${btn('从离开位置继续','resume')}${btn('重新开始','restart','secondary')}
  <p class="err" id="resume-error" role="alert"></p></div>`:`      <form id="test-entry" autocomplete="off">
  <label class="field" for="participant-name">
  ${withIcon('<input id="participant-name" aria-label="测试者姓名" name="participant" maxlength="40" required placeholder="请输入您的姓名">','person')}</label>
  <p class="err" id="entry-error" role="alert"></p>
  <button class="primary below" type="submit">进入测试</button></form>`}</section>`;
  footer=btn('进入调试模式','debug','ghost');
  return {content, footer};
};

pageViews.home = () => {
  let content;
  let footer = '';
  content = `<section class="hero"><span class="eyebrow">门诊服务</span>${artwork}<h1>预约挂号</h1><p>选择医生和就诊时间<br>在线预约挂号</p>${btn('开始预约','start')}</section>
  <section class="section"><div class="row"><h2>就医服务</h2></div><div class="stack below">
  ${choice('我的预约',state.receipt?'查看本次预约记录':'查看的预约状态','records','calendar')}
  ${choice('首次就诊准备','了解线上建档和到院人工协助','guide:home','person')}</div></section>
  <p class="footnote"></p>`;
  return {content, footer};
};

const offlineArchiveNotice = () => callout('线下人工建档提醒','请携带本人有效身份证件，提前一小时前往所选院区办理建档。','warn');

pageViews.guide = () => {
  let content;
  let footer = '';
  const campusIndex=campusData.findIndex(([name])=>name===state.campus);
  const general=state.guideContext==='home'||campusIndex<0;
  const image=general?booking.guideImages.home:booking.guideImages.campuses[campusIndex];
  const crop = general ? 398 / 1024 * 100 : 0;
  const description=general
    ? '首次就诊准备。准备身份证件和手机，在线核对身份并填写建档资料，确认医生、日期和时段，携带证件按预约安排到院。如需人工协助，可到所选院区门诊服务台咨询。具体安排以院区公告为准。'
    : state.campus+'人工建档办理指引。先在线完成预约，携带身份证提前一小时到院，到门诊服务台办理建档，完成后到诊区报到候诊。具体办理地点以院区指引为准。';
  content=intro(general?'首次就诊准备':'先预约，后建档',general?'了解建档、预约与到院就诊的基本步骤。':'线上填表有困难？您也可以前往线下办理')+
    (general?'':offlineArchiveNotice())+
    `<section class="card below guide-card"><img class="guide-image" style="--guide-crop:${crop}%" src="${image}" width="${general?1024:1190}" height="${general?1536:1322}" alt="${esc(description)}" loading="lazy" decoding="async"></section>`;
  footer=!general&&state.verified&&state.slot
    ? btn('下一步','offline-archive')
    : btn(history.at(-1)==='archive'?'返回继续填写':'返回上一页','back');
  return {content, footer};
};

pageViews.settings = () => {
  let content;
  let footer = '';
  content = intro('','从首页启动下一次演示，统一任务情境。')+
    `<section class="card"><label class="field"><span>短信发送情境</span><select id="delayed"><option value="0">首次收到验证码</option><option value="1" ${scenario.delayed?'selected':''}>首次未收到，重发后收到</option></select></label>
    <p class="footnote">开始新一轮时会清除当前表单和预约记录。验证码重发等待设为 30 秒。</p></section>`;
  footer = btn('应用设置并返回首页','apply');
  return {content, footer};
};
