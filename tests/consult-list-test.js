// 2026-11-24 팀 협의 뒤 먼저 넣은 항목 시험: 만약에 머리말 겹침, 만약에 창 설명, 선 연결 안내, 판 만들기에서 처음 화면으로,
// 줄 고정 되돌림, 친구들의 근거 제목.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const fs = require('fs');
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const html = fs.readFileSync('index.html', 'utf8');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1100 });

  console.log('C4. 판 만들기 화면에서 처음 화면으로');
  A.ctx.showHome(); A.ctx.openSetup(false);
  check('처음 판 만들기 화면에 「처음 화면으로」가 보인다', A.shown() === 'setup-view' && !A.$('#setup-cancel').classList.contains('hide') && A.$('#setup-cancel').textContent === '처음 화면으로');
  A.$('#setup-cancel').onclick();
  check('누르면 처음 화면으로 돌아간다(수업이 없어도 오류 없음)', A.shown() === 'home-view');

  await A.ctx.createGame('사자는 가젤에게 사과해야 할까?', '사과해야 해', '사과하지 않아도 돼');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code, g = A.T.g;
  A.ctx.openSetup(true);
  check('고치기 화면에서는 예전처럼 「취소」로 판에 돌아간다', A.$('#setup-cancel').textContent === '취소');
  A.$('#setup-cancel').onclick();
  check('판으로 돌아온다', A.shown() === 'board-view');

  console.log('C1. 「그런데 만약에」 머리말이 겹치지 않는다');
  const D = A.ctx;
  check('글머리 떼기: 그런데 만약에 / 만약에 / 물음표·쉼표', D.wfBody('그런데 만약에 비가 오면?') === '비가 오면?' && D.wfBody('만약에, 사자가 사과했다면?') === '사자가 사과했다면?' && D.wfBody('그런데 만약에? 일부러 그랬다면') === '일부러 그랬다면' && D.wfBody('  그런데만약에… 다쳤다면?') === '다쳤다면?');
  check('만약에로 시작하지 않는 글은 그대로', D.wfBody('사자가 사과했어요. 그래도?') === '사자가 사과했어요. 그래도?' && D.wfBody('친구가 만약에 운다면?') === '친구가 만약에 운다면?');
  check('머리말만 쓴 글은 비우지 않고 그대로 둔다', D.wfBody('그런데 만약에?') === '그런데 만약에?' && D.wfBody('') === '');
  A.ctx.askWhatif();
  let ov = A.overlays().at(-1);
  check('입력 칸 앞에 「그런데 만약에」가 고정돼 있다', ov.innerHTML.includes('<span class="wf-pre" aria-hidden="true">그런데 만약에</span><input type="text" id="wf-in"'));
  check('설명은 짧은 한 문단이고 나머지는 「자세히」에 접혀 있다', ov.innerHTML.includes('<details class="note wf-more"><summary>자세히</summary>') && ov.innerHTML.indexOf('순서대로 하나씩') > ov.innerHTML.indexOf('<summary>자세히</summary>') && ov.innerHTML.includes('응답 다시 받기'));
  { const head = ov.innerHTML.slice(ov.innerHTML.indexOf('<p class="note">') + 16, ov.innerHTML.indexOf('</p>'));
    check('창을 열면 바로 보이는 설명은 100자 안쪽', head.length > 20 && head.length <= 100, head.length + '자'); }
  ov.querySelector('#wf-in').value = '그런데 만약에 비가 오면?';
  ov.querySelector('[data-a=ok]').onclick();
  check('같은 말로 시작해 띄우면 머리말을 떼고 저장한다', g.whatif.at(-1) === '비가 오면?');
  check('교사 판 질문 영역: 머리말은 한 번만', (A.ctx.extraQuestionHTML(g.whatif.at(-1), 1, true).match(/그런데 만약에/g) || []).length === 1);
  g.whatif[g.whatif.length - 1] = '그런데 만약에 비가 오면?'; // 예전에 저장된 글(머리말 포함)
  const count = s => (s.match(/그런데 만약에/g) || []).length;
  check('예전에 저장된 글도 보일 때는 한 번만: 질문 영역', count(A.ctx.extraQuestionHTML(g.whatif[0], 1, true)) === 1 && A.ctx.extraQuestionHTML(g.whatif[0], 1, true).includes('>비가 오면?<'));
  A.T.maskOff = g.id;
  check('예전에 저장된 글도 한 번만: 종합 보기 · 양쪽 근거 이미지', count(A.ctx.summaryHTML(A.T.room)) === 1 && count(A.ctx.sidesHTML(g, 1, 0, 7, '')) === 1);
  check('저장된 글 자체는 바꾸지 않는다', g.whatif[0] === '그런데 만약에 비가 오면?');
  A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();

  console.log('C3. 선 연결 안내');
  check('질문 영역에 「카드를 누르면 … 선으로 이어져요」(카드 뒤 배경 글씨에는 넣지 않는다)', A.$('#b-whatif').innerHTML.includes('판에서 카드를 누르면 같은 학생의 처음 자리와 선으로 이어져요.') && !A.$('#b-lane-bot').innerHTML.includes('선으로 이어져요'), A.$('#b-whatif').innerHTML.slice(-120));
  A.T.maskOff = null; A.ctx.renderBoard();
  check('추가 질문을 가린 동안에는 안내를 넣지 않는다', A.ctx.extraMasked() && !A.$('#b-whatif').innerHTML.includes('선으로 이어져요'));
  A.width = 375; A.T.maskOff = g.id; A.ctx.renderBoard();
  check('휴대폰 교사 화면(선이 없음)에는 안내를 넣지 않는다', !A.$('#b-whatif').innerHTML.includes('선으로 이어져요'));
  A.width = 1100; A.ctx.renderBoard();
  console.log('C5. 알림이 선택 도구 줄을 덮지 않는다');
  check('고른 카드가 없으면 알림은 제자리', !A.body.classList.contains('has-sel'));
  { const c0 = { boardId: g.id, from: null, hidden: false, history: [], id: 'selcard00001', likes: [], name: '1번', rev: 0, sid: 'selsid000001', side: 'L', strength: 3, stage: 0, text: '고를 카드' };
    g.cards.push(c0); A.T.sel.add(c0.id); A.ctx.updateSelbar();
    check('카드를 고른 동안은 알림을 선택 도구 줄 위로 올린다', A.body.classList.contains('has-sel') && !A.$('#selbar').classList.contains('hide') && html.includes('body.has-sel .toast{bottom:84px}'));
    A.T.sel.clear(); A.ctx.updateSelbar();
    check('선택을 풀면 알림이 제자리로', !A.body.classList.contains('has-sel'));
    g.cards = g.cards.filter(c => c !== c0); }

  console.log('S4. 줄 고정 되돌림');
  check('줄 상자를 화면에 붙이는 규칙과 펼침 감지 코드가 없다', !html.includes('position:sticky;top:0;z-index:3') && !html.includes("classList.toggle('adjust'"));

  console.log('S6. 친구들의 근거 제목');
  const join = async name => { const p = makePage(bus, { search: '?c=' + code }); p.ctx.joinGame(code, name); await until(() => p.S.cfg && p.shown() === 'student-view', 5000, name + ' 입장'); return p; };
  const write = (p, text, side, strength) => { p.$('#s-text').value = text; p.$('#s-str').value = strength; p.ctx.setSide(side); };
  g.whatif.splice(0); A.ctx.saveGame(); g.share = true; A.ctx.pushConfig();
  const S1 = await join('하나'), S2 = await join('둘');
  write(S1, '하나의 처음 근거', 'L', 3); S1.ctx.submitComposer();
  write(S2, '둘의 처음 근거', 'R', 4); S2.ctx.submitComposer();
  await until(() => g.cards.length === 2, 5000, '처음 답 두 장');
  A.ctx.pushConfig();
  await until(() => !S1.$('#s-friends-panel').classList.contains('hide'), 6000, '친구 근거 표시');
  check('처음 질문에서는 「친구들의 근거 · 처음 생각」', S1.$('#s-friends-title').textContent === '친구들의 근거 · 처음 생각', S1.$('#s-friends-title').textContent);
  check('학생 화면의 만약에 머리말도 한 번만', (() => { g.whatif.push('그런데 만약에 사자가 다쳤다면?'); return count(A.ctx.extraQuestionHTML(g.whatif[0], 1, true)) === 1; })());
  A.ctx.saveGame(); A.ctx.pushConfig();
  await until(() => S1.ctx.curStage() === 1 && S2.ctx.curStage() === 1, 5000, '추가 질문 수신');
  check('학생이 받은 추가 질문 영역에 머리말이 한 번만 보인다', count(S1.$('#s-wf').innerHTML) === 1 && S1.$('#s-wf').innerHTML.includes('>사자가 다쳤다면?<'), S1.$('#s-wf').innerHTML.slice(0, 200));
  write(S1, '하나의 만약에 근거', 'R', 2); S1.ctx.submitComposer();
  write(S2, '둘의 만약에 근거', 'R', 5); S2.ctx.submitComposer();
  await until(() => g.cards.filter(c => c.stage === 1).length === 2, 5000, '만약에 답 두 장');
  A.ctx.pushConfig();
  await until(() => S1.$('#s-friends-title').textContent.includes('추가 질문'), 6000, '친구 근거 제목 갱신');
  check('추가 질문에서는 「친구들의 근거 · 추가 질문 1의 생각」', S1.$('#s-friends-title').textContent === '친구들의 근거 · 추가 질문 1의 생각', S1.$('#s-friends-title').textContent);

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
