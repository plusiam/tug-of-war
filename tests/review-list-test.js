// 2026-11-24 점검 목록 시험: 쪽 바뀜 근거 환기, 응답 멈춤 중 보낸 요약, 명단에서 빼기, 보기 설정 표시,
// 지난번 판 제목, 저장 안내, 글자 그대로 전달.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  await A.ctx.createGame('숙제는 꼭 있어야 할까?', '있어야 해', '없어도 돼');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code, g = A.T.g;
  const join = async name => { const p = makePage(bus, { search: '?c=' + code }); p.ctx.joinGame(code, name); await until(() => p.S.cfg && p.shown() === 'student-view', 5000, name + ' 입장'); return p; };
  const write = (p, text, side, strength) => { p.$('#s-text').value = text; p.$('#s-str').value = strength; p.ctx.setSide(side); };
  const type = (p, text) => { p.$('#s-text').value = text; p.ctx.updatePreview(); };
  const mine = (p, stage) => g.cards.filter(c => c.sid === p.S.me.sid && c.stage === stage);
  const flipShown = p => !p.$('#s-flip').classList.contains('hide');
  const cardsSent = p => bus.sent.filter(m => m.event === 'card' && m.payload.sid === p.S.me.sid).length;

  console.log('R8. 글자가 그대로 전달된다');
  const St = await join('룰루');
  const odd = '숫ㅜ하는건데 원래ㅜ안 해올거야 있으미까 😀';
  write(St, odd, 'L', 4); St.ctx.submitComposer();
  await until(() => mine(St, 0)[0] && St.S.me.cards[0].ok, 5000, '처음 답 도착');
  check('낱자모·오타·그림 문자까지 학생이 쓴 글자 그대로 교사 판에 도착한다', mine(St, 0)[0].text === odd && St.S.me.cards[0].text === odd, mine(St, 0)[0].text);
  check('교사 판 그리기에서도 글자가 바뀌지 않는다', A.ctx.summaryHTML(A.T.room).includes(odd));

  console.log('R1. 쪽을 바꿨는데 근거가 그대로일 때');
  g.whatif.push('숙제를 스스로 고르면 더 잘할까?'); A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();
  await until(() => St.ctx.curStage() === 1, 5000, '추가 질문 수신');
  St.ctx.startFrom(mine(St, 0)[0].id);
  check('「위치·근거 바꾸기」: 앞선 글·쪽·세기를 가져오고 아직 환기하지 않는다', St.$('#s-text').value === odd && St.S.side === 'L' && !flipShown(St));
  St.$('#s-str').value = 2; St.ctx.updatePreview();
  check('세기만 바꾼 경우는 환기하지 않는다', !flipShown(St) && St.$('#s-send').textContent !== '근거 그대로 보내기');
  St.ctx.setSide('R');
  check('반대쪽으로 옮기면 근거 칸 위에 한 줄로 알린다', flipShown(St) && require('fs').readFileSync('index.html', 'utf8').includes('id="s-flip" role="status">생각이 바뀌었네요. 근거도 고쳐 볼까요?</p>'));
  let n = cardsSent(St); St.ctx.submitComposer(); await sleep(150);
  check('그대로 보내려 하면 한 번 멈춰 묻는다(전송 안 됨)', cardsSent(St) === n && mine(St, 1).length === 0 && St.$('#s-send').textContent === '근거 그대로 보내기' && St.$('#s-send-status').textContent.includes('한 번 더 눌러요'), St.$('#s-send').textContent);
  type(St, '내가 고르면 더 하고 싶어져서 생각이 바뀌었어요');
  check('근거를 고치면 환기가 사라지고 단추가 원래대로', !flipShown(St) && St.$('#s-send').textContent === '보내기');
  type(St, odd);
  check('다시 앞선 글로 돌리면 또 알린다(확인도 처음부터)', flipShown(St) && St.$('#s-send').textContent === '보내기');
  St.ctx.submitComposer(); St.ctx.submitComposer();
  await until(() => mine(St, 1)[0] && St.S.me.cards.find(c => c.stage === 1)?.ok, 5000, '그대로 보낸 카드 도착');
  check('한 번 더 누르면 근거 그대로 보낸다(학생 선택을 막지 않음)', mine(St, 1)[0].side === 'R' && mine(St, 1)[0].text === odd && mine(St, 1).length === 1);
  await sleep(100);
  St.$('#s-edit').onclick(); St.ctx.setSide('L');
  check('보낸 카드를 수정하며 쪽만 바꿔도 알린다', flipShown(St));
  St.$('#s-cancel-edit').onclick();
  check('취소하면 환기가 사라진다', !flipShown(St));

  console.log('R4. 응답 잠시 멈춤 중의 학생 화면');
  A.ctx.hideWhatif();
  await until(() => !St.ctx.studentStageOpen(), 5000, '멈춤 수신');
  await sleep(100);
  check('멈춘 동안에도 보낸 요약과 줄 위 카드가 남는다(가장 나중 생각)', St.$('#s-panel').classList.contains('sent') && !St.$('#s-sent').classList.contains('hide') && St.$('#s-sent-text').textContent.startsWith('✓ 보냈어요 · 없어도 돼 쪽 · 세기 2') && St.$('#s-tok').className === 'tok R sent', St.$('#s-sent-text').textContent + ' / ' + St.$('#s-tok').className);
  check('멈춘 동안은 수정 단추를 숨기고 다시 열리면 고칠 수 있다고 알린다', St.$('#s-edit').classList.contains('hide') && St.$('#s-sent-text').textContent.includes('선생님이 다시 열면 고칠 수 있어요'));
  check('"수정할 수 있어요" 안내는 멈춘 동안 숨긴다', St.$('#s-completed').classList.contains('hide') && St.$('#s-form-title').textContent === '응답 잠시 멈춤 · 내가 보낸 생각', St.$('#s-form-title').textContent);
  const Late = await join('늦은학생');
  check('아직 보낸 것이 없는 학생은 예전처럼 멈춤 안내와 꺼진 보내기', !Late.$('#s-panel').classList.contains('sent') && Late.$('#s-send').disabled === true && Late.$('#s-send').textContent === '응답 잠시 멈춤');
  A.ctx.resumeWhatif();
  await until(() => St.ctx.studentStageOpen() && St.ctx.curStage() === 1, 5000, '다시 받기');
  await sleep(100);
  check('다시 열리면 수정 단추가 돌아온다', St.$('#s-panel').classList.contains('sent') && !St.$('#s-edit').classList.contains('hide') && !St.$('#s-completed').classList.contains('hide') && St.$('#s-sent-text').textContent === '✓ 보냈어요 · 없어도 돼 쪽 · 세기 2');

  console.log('R3. 명단에서 빼기');
  const rows = () => A.ctx.participantRows(A.T.room, g);
  check('명단: 룰루와 늦은학생', rows().length === 2 && rows().some(r => r.name === '룰루'));
  const sidL = St.S.me.sid, before = g.cards.length;
  const hid = A.ctx.kickParticipant(A.T.room, g, sidL);
  check('빼면 명단에서 사라지고 카드는 지우지 않고 숨긴다', hid === 2 && rows().length === 1 && !rows().some(r => r.sid === sidL) && g.cards.length === before && g.cards.filter(c => c.sid === sidL).every(c => c.hidden));
  check('숨긴 카드는 판·종합 보기에 나오지 않는다', g.cards.filter(c => A.ctx.onBoard(c)).length === 0 && !A.ctx.summaryHTML(A.T.room).includes(odd));
  A.ctx.renderParticipants();
  check('명단 줄마다 「명단에서 빼기」 단추가 있다', A.$('#b-participants').innerHTML.includes('data-kick="') && A.$('#b-participants').innerHTML.includes('명단에서 빼기'));
  g.cards.forEach(c => c.hidden = false);
  check('숨긴 카드를 다시 보이면 명단에도 돌아온다', rows().length === 2);
  A.ctx.kickParticipant(A.T.room, g, sidL);
  St.S.hello(); await sleep(300);
  check('뺀 학생이 다시 접속해 인사하면 명단에 다시 올라온다', rows().some(r => r.sid === sidL));
  A.ctx.kickParticipant(A.T.room, g, Late.S.me.sid);
  check('카드가 없는 입장자도 뺄 수 있다', !rows().some(r => r.sid === Late.S.me.sid));
  A.ctx.confirmKick(sidL);
  check('빼기 전에 이름과 카드 수를 확인한다', A.overlays().at(-1).innerHTML.includes('룰루') && A.overlays().at(-1).innerHTML.includes('명단에서 빼기'));
  A.overlays().at(-1).remove();
  g.cards.forEach(c => c.hidden = false);

  console.log('R5. 보기 설정 표시');
  g.showNames = false; g.showCount = false; A.ctx.renderBoard();
  check('꺼져 있을 때: 「이름 보이기: 꺼짐」「찬반 수: 꺼짐」', A.$('#t-names').textContent === '이름 보이기: 꺼짐' && A.$('#t-count').textContent === '찬반 수: 꺼짐');
  A.$('#t-names').onclick(); A.$('#t-count').onclick();
  check('켜면: 「이름 보이기: 켜짐」「찬반 수: 켜짐」', A.$('#t-names').textContent === '이름 보이기: 켜짐' && A.$('#t-count').textContent === '찬반 수: 켜짐' && g.showNames === true && g.showCount === true);
  A.width = 375; A.ctx.moreMenu();
  check('휴대폰 ⋯ 메뉴도 같은 표기', A.overlays().at(-1).innerHTML.includes('이름 보이기: 켜짐') && A.overlays().at(-1).innerHTML.includes('찬반 수: 켜짐'));
  A.overlays().at(-1).remove(); A.width = 1024;

  console.log('R7. 수업 저장 안내');
  A.ctx.exportRoom(); A.toasts.length = 0;
  A.overlays().at(-1).querySelector('[data-save]').onclick();
  check('저장하면 파일 이름과 함께 안내가 뜬다', A.toasts.length === 1 && A.toasts[0].startsWith('저장 파일을 내보냈어요 · 생각줄다리기_') && A.toasts[0].includes('_교사비공개.json'), A.toasts[0]);

  console.log('R6. 지난번 판 제목');
  A.ctx.showHome();
  check('질문판이 하나면 그 질문만', A.$('#resume-q').textContent === '숙제는 꼭 있어야 할까?');
  A.ctx.openRoom(A.T.room);
  A.ctx.nextQuestion(); A.$('#in-q').value = '숙제를 스스로 고르면 더 잘할까?'; await A.$('#setup-go').onclick();
  A.ctx.showHome();
  check('둘째 질문판 진행 중이면 그 질문과 순서를 보여 준다', A.$('#resume-q').textContent === '숙제를 스스로 고르면 더 잘할까? · 2번째 질문(모두 2개)', A.$('#resume-q').textContent);

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
