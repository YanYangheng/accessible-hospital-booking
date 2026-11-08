'use strict';

const debugPages = new Set([
  'home', 'campus', 'department', 'doctors', 'slots', 'login', 'method',
  'archive', 'expired', 'confirm', 'success', 'records', 'guide', 'settings'
]);

function removeLinkParameters() {
  try {
    const url = new URL(window.location.href);
    for (const key of ['mode', 'skip_cover', 'test_id', 'name', 'page']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch { /* Some embedded browsers restrict history changes. */ }
}

function linkEntryMarkup() {
  if (!linkEntryError) return '<p class="muted" role="status">正在进入测试…</p>';
  const retry = linkEntry.valid ? btn('重试','link-retry') : '';
  return `<div class="cover-actions"><p class="err" role="alert">${esc(linkEntryError)}</p>
    ${retry}${btn('返回封面','link-cancel','secondary')}</div>`;
}

async function enterLinkedTest() {
  const entry = linkEntry;
  if (!entry?.valid) return;
  linkEntryError = '';
  render();
  const record = recoveryRecord;
  const matching = record?.identity.testId === entry.testId && validProgress(record.snapshot);
  const ok = matching
    ? await study.resume(record, entry)
    : await study.begin(entry.name, false, scenario, entry.testId);
  if (entry !== linkEntry) return;
  if (!ok) {
    linkEntryError = matching ? '无法恢复测试，请核对链接中的姓名，或检查网络后重试。' : '暂时无法进入测试，请检查网络后重试。';
    render();
    return;
  }
  removeLinkParameters();
  linkEntry = null;
  if (matching) showRestoredTest(record);
  else {
    study.log('result', 'cover', 'link-entry', {result:'link_started'});
    go('home', false);
  }
}

function debugState(page, randomize = false) {
  const sample = fresh();
  const pick = items => items[randomize ? Math.floor(Math.random() * items.length) : 0];
  const doctor = pick(booking.doctors.filter(item => item.schedule.includes('available')));
  const day = pick(doctor.schedule.flatMap((status, index) => status === 'available' ? [index] : []));
  sample.campus = pick(campusData)[0];
  sample.dept = departments[doctor.department];
  sample.doctor = doctor.id;
  sample.date = sample.dateAnchor = day;
  sample.slot = {day, index:pick(booking.dates[day].slots.map((_, index) => index))};

  if (['method','archive','guide','expired','confirm','success','records'].includes(page)) {
    sample.verified = true;
    sample.phone = '13800000000';
    sample.code = '012345';
  }
  if (['expired','confirm','success','records'].includes(page)) {
    sample.archived = true;
    Object.assign(sample.profile, {name:'测试用户',id:'00000019601013000X',gender:'女',
      birthday:'1960-10-13',height:'160',weight:'56',job:booking.jobs[0],address:'演示路 1 号'});
  }
  if (page === 'guide') sample.guideContext = 'campus';
  if (page === 'expired') sample.expired = {...sample.slot, doctor:sample.doctor};
  sample.receipt = page === 'success' || page === 'records';
  return sample;
}

async function startFromAddress() {
  const mode = params.get('mode');
  if (mode === 'debug') {
    const requested = params.get('page');
    const page = debugPages.has(requested) ? requested : 'home';
    clearTest();
    await study.begin('', true);
    if (page !== 'home' && page !== 'campus') state = debugState(page, page === 'confirm' && params.get('random') === '1');
    go(page, false);
    return;
  }
  if (mode === 'test' && params.get('skip_cover') === '1') {
    const testId = params.get('test_id')?.trim() || '';
    const name = params.get('name')?.trim() || '';
    const valid = /^[A-Za-z0-9_-]{1,40}$/.test(testId) && name.length > 0 && name.length <= 40 && !/[\x00-\x1f\x7f]/.test(name);
    linkEntry = {testId, name, valid};
    if (valid) await enterLinkedTest();
    else {
      linkEntryError = '测试链接需要有效的测试编号和姓名。';
      render();
    }
    return;
  }
  render();
}

void startFromAddress();
