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
  content = `<section class="hero"><span class="eyebrow">门诊服务</span>${artwork}<h1>预约挂号</h1><p>选择医生和就诊时间<br>在线预约挂号</p>${btn('开始预约 '+icon('next'),'start')}</section>
  <section class="section"><div class="row"><h2>就医服务</h2></div><div class="stack below">
  ${choice('我的预约',state.receipt?'查看本次预约记录':'查看的预约状态','records','calendar')}
  ${choice('首次就诊准备','了解线上建档和到院人工协助','guide:home','person')}</div></section>
  <p class="footnote"></p>`;
  return {content, footer};
};

pageViews.guide = () => {
  let content;
  let footer = '';
  const campusIndex=campusData.findIndex(([name])=>name===state.campus);
  const general=state.guideContext==='home'||campusIndex<0;
  const image=general?booking.guideImages.home:booking.guideImages.campuses[campusIndex];
  // Hero edges measured in the 1024 px wide source illustrations.
  const heroEnd = general ? 398 : [400, 425, 445, 455, 386][campusIndex];
  const crop = heroEnd / 1024 * 100;
  const description=general
    ? '首次就诊准备。准备身份证件和手机，在线核对身份并填写建档资料，确认医生、日期和时段，携带证件按预约安排到院。如需人工协助，可到所选院区门诊服务台咨询。具体安排以院区公告为准。'
    : state.campus+'人工建档办理指引。携带本人有效身份证件，到门诊服务台说明需求，在工作人员协助下核对资料，完成建档后返回线上预约。具体办理地点和时间以院区公告为准。';
  content=intro(general?'首次就诊准备':'到院人工协助',general?'了解建档、预约与到院就诊的基本步骤。':'适合希望在工作人员协助下建档的就诊人。')+
    (general?'':callout('当前尚未预约','此处提供建档办理指引。完成办理后，可再次进入线上预约。','warn'))+
    `<section class="card below guide-card"><img class="guide-image" style="--guide-crop:${crop}%" src="${image}" width="1024" height="1536" alt="${esc(description)}" loading="lazy" decoding="async"></section>`;
  footer=btn(history.at(-1)==='archive'?'返回继续填写':'返回上一页','back');
  return {content, footer};
};

pageViews.settings = () => {
  let content;
  let footer = '';
  content = intro('','从首页启动下一次演示，统一任务情境。')+
    `<section class="card"><label class="field"><span>建档完成时的号源状态</span><select id="expiry"><option value="0">原号源仍可用</option><option value="1" ${scenario.expiry?'selected':''}>原号源失效，触发重选</option></select></label>
    <label class="field"><span>短信发送情境</span><select id="delayed"><option value="0">首次收到验证码</option><option value="1" ${scenario.delayed?'selected':''}>首次未收到，重发后收到</option></select></label>
    <p class="footnote">开始新一轮时会清除当前表单和预约记录。验证码重发等待设为 30 秒。</p></section>`;
  footer = btn('应用设置并返回首页','apply');
  return {content, footer};
};
