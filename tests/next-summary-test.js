// 「새 질문 시작」(새 판을 열고 바로 시작)과 「종합 보기」(질문판 모아 보기) 시험.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const lastOverlay = page => page.overlays().at(-1);

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  await A.ctx.createGame('가젤은 사자를 용서해야 할까?', '용서해야 해', '용서하지 않아도 돼');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code, first = A.T.g;

  console.log('N1. 도구 줄: 판이 하나일 때');
  check('순서 표시는 판이 둘 이상일 때만', !A.$('#b-q').innerHTML.includes('번째 질문판'));
  check('「그런데 만약에?」는 추가 질문 기록이 없으면 도구 줄에서 내린다', A.$('#t-whatif').classList.contains('hide'));
  check('「새 질문 시작」은 보인다', !A.$('#t-next').classList.contains('hide'));
  A.ctx.moreMenu();
  check('⋯ 메뉴에 「그런데 만약에?」가 있다', lastOverlay(A).innerHTML.includes('data-a="whatif"'));
  lastOverlay(A).remove();

  const St = makePage(bus, { search: '?c=' + code });
  St.ctx.joinGame(code, '별명ZZ');
  await until(() => St.S.cfg && St.shown() === 'student-view', 5000, '학생 입장');
  const write = (p, text, side, strength) => { p.$('#s-text').value = text; p.$('#s-str').value = strength; p.ctx.setSide(side); };
  write(St, '먼저 사과했으니까', 'L', 4); St.ctx.submitComposer();
  await until(() => St.S.me.cards[0]?.ok, 5000, '첫 카드 도착');
  check('첫 판에 카드 1장', first.cards.length === 1);

  console.log('N2. 새 질문 시작: 입력 창');
  { const src = require('fs').readFileSync('index.html', 'utf8');
    check('단추 이름은 「새 질문 시작」(예전 「다음 질문」)', /id="t-next"[^>]*>새 질문 시작<\/button>/.test(src) && src.includes('data-a="next">새 질문 시작 (새 판 열고 학생 화면 넘기기)</button>') && !src.includes('>다음 질문</button>') && !src.includes('>다음 질문 (')); }
  write(St, '쓰다 만 글', 'R', 2); // 보내지 않은 초안
  A.ctx.nextQuestion();
  check('설정 화면이 「2번째 질문판 열기」로 뜬다', A.shown() === 'setup-view' && A.$('#setup-title').textContent === '2번째 질문판 열기' && A.$('#setup-go').textContent === '새 질문 시작');
  check('질문은 비우고 양쪽 끝 이름은 앞 질문 것을 넣어 둔다', A.$('#in-q').value === '' && A.$('#in-l').value === '용서해야 해' && A.$('#in-r').value === '용서하지 않아도 돼');
  check('취소 단추가 보인다', !A.$('#setup-cancel').classList.contains('hide'));
  A.$('#in-q').value = '   ';
  await A.$('#setup-go').onclick();
  check('빈 질문은 판을 만들지 않는다', A.T.room.boards.length === 1 && A.shown() === 'setup-view' && A.T.room.activeBoardId === first.id);
  A.$('#setup-cancel').onclick();
  check('취소하면 판으로 돌아오고 판은 그대로', A.shown() === 'board-view' && A.T.room.boards.length === 1);

  console.log('N3. 새 질문 시작: 만들면서 바로 시작');
  first.fs = 1.2;
  A.ctx.nextQuestion(); A.$('#in-q').value = '사자는 가젤에게 사과해야 할까?'; A.$('#in-l').value = '사과해야 해'; A.$('#in-r').value = '사과하지 않아도 돼';
  const sentBefore = bus.sent.length;
  await A.$('#setup-go').onclick();
  const second = A.T.room.boards[1];
  check('판이 하나만 더 생기고 곧바로 진행판이 된다', A.T.room.boards.length === 2 && A.T.room.activeBoardId === second.id && A.T.viewedBoardId === second.id && A.T.g === second && A.shown() === 'board-view');
  check('새 판의 질문·양 끝', second.question === '사자는 가젤에게 사과해야 할까?' && second.left === '사과해야 해' && second.right === '사과하지 않아도 돼' && second.cards.length === 0);
  check('글자 크기만 이어받고 친구 근거·이름 보이기는 꺼진 채 시작', second.fs === 1.2 && second.share === false && second.showNames === false);
  check('저장 형식에 새 필드가 없다', Object.keys(second).sort().join() === Object.keys(A.ctx.boardNew('q', 'l', 'r', code)).sort().join());
  check('안내가 뜬다', A.toasts.at(-1).startsWith('2번째 질문판을 시작했어요'));
  check('판 위에 「2번째 질문판」과 진행 중 표시', A.$('#b-q').innerHTML.includes('2번째 질문판') && A.$('#t-activate').textContent === '진행 중인 질문');
  await until(() => St.S.cfg.boardId === second.id, 5000, '학생 화면 전환');
  check('학생 화면이 새 질문으로 넘어간다', St.S.cfg.question === '사자는 가젤에게 사과해야 할까?' && St.S.cfg.left === '사과해야 해');
  check('전체 방송으로 새 판 설정이 나갔다', bus.sent.slice(sentBefore).some(m => m.event === 'config' && m.payload.boardId === second.id));
  check('학생 입력칸은 비고 안내가 뜬다', St.$('#s-text').value === '' && St.toasts.includes('선생님이 다른 질문을 열었어요. 쓰던 글이 있으면 보관했어요.'));
  check('쓰던 글은 앞 질문판 초안으로 보관', St.S.me.drafts[first.id]?.text === '쓰다 만 글');
  write(St, '다친 건 가젤이니까', 'L', 5); St.ctx.submitComposer();
  await until(() => second.cards.length === 1, 5000, '둘째 판 카드');
  check('새 판에 답이 들어오고 앞 판 카드는 그대로', second.cards[0].text === '다친 건 가젤이니까' && first.cards.length === 1);

  console.log('N4. 둘째 판 진행 중 새로 들어온 학생');
  const from2 = bus.sent.length;
  const S2 = makePage(bus, { search: '?c=' + code });
  S2.ctx.joinGame(code, '늦은학생');
  await until(() => S2.S.cfg && S2.shown() === 'student-view', 5000, '늦은 학생 입장');
  await sleep(300);
  check('둘째 판 질문을 바로 받는다', S2.S.cfg.boardId === second.id && S2.S.cfg.question === '사자는 가젤에게 사과해야 할까?');
  check('최신 화면 학생에게 「새로고침」 알림을 보내지 않는다', !bus.sent.slice(from2).some(m => m.event === 'refresh') && S2.toasts.length === 0, JSON.stringify(S2.toasts));
  const from3 = bus.sent.length;
  A.ctx.onHello({ sid: 'oldstudent1', name: '구버전' }); // protocol 없는 예전 화면
  await sleep(300);
  check('예전 화면 학생에게는 여전히 새로고침을 알린다', bus.sent.slice(from3).some(m => m.event === 'refresh'));

  console.log('N5. 되돌리기 · 초안 복귀');
  A.ctx.viewBoard(first.id);
  check('앞 판을 열면 「1번째 질문판 · 보관판 열람」', A.$('#b-q').innerHTML.includes('1번째 질문판') && A.$('#b-q').innerHTML.includes('보관판 열람'));
  A.ctx.activateViewed();
  await until(() => St.S.cfg.boardId === first.id, 5000, '앞 판으로 복귀');
  check('앞 질문으로 돌아가면 쓰던 글이 돌아온다', St.$('#s-text').value === '쓰다 만 글');
  check('잘못 연 판은 진행 중이 아니면 휴지통으로 보낼 수 있다(카드가 있어도 규칙은 같다)', A.ctx.trashReason(A.T.room, second.id) === '');

  console.log('N6. 전환 알림을 놓친 학생');
  bus.drop = m => m.event === 'config';
  A.ctx.viewBoard(second.id); A.ctx.activateViewed();
  await sleep(600);
  check('알림을 놓쳐 학생은 앞 질문에 머문다', St.S.cfg.boardId === first.id && A.T.room.activeBoardId === second.id);
  bus.drop = () => false;
  St.$('#s-text').value = '놓친 채 고친 글'; St.ctx.submitComposer();
  await until(() => St.S.cfg.boardId === second.id, 5000, '거부 뒤 현재 질문 수신');
  check('앞 판 앞으로 온 카드는 받지 않는다', !first.cards.some(c => c.text === '놓친 채 고친 글'));
  check('거부와 함께 현재 질문을 다시 보내 학생 화면이 따라온다', St.S.cfg.question === '사자는 가젤에게 사과해야 할까?');

  console.log('N7. 추가 질문 기록이 있는 판 · 휴대폰 도구 줄');
  second.whatif.push('사자가 일부러 그랬다면?'); A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();
  check('추가 질문 기록이 있으면 「그런데 만약에?」가 도구 줄에 남는다', !A.$('#t-whatif').classList.contains('hide') && !A.$('#t-next').classList.contains('hide'));
  A.width = 375; A.ctx.renderBoard();
  check('휴대폰에서는 그때 「새 질문 시작」을 ⋯ 안으로 보낸다', A.$('#t-next').classList.contains('hide') && !A.$('#t-whatif').classList.contains('hide'));
  A.ctx.moreMenu(); let html = lastOverlay(A).innerHTML; lastOverlay(A).remove();
  check('휴대폰 ⋯ 메뉴: 새 질문 시작 · 그런데 만약에? · 종합 보기', ['next', 'whatif', 'sum'].every(a => html.includes('data-a="' + a + '"')));
  A.ctx.viewBoard(first.id);
  check('기록이 없는 판의 휴대폰 도구 줄에는 「새 질문 시작」', !A.$('#t-next').classList.contains('hide') && A.$('#t-whatif').classList.contains('hide'));
  A.width = 1024; A.ctx.viewBoard(second.id);

  console.log('N8. 종합 보기');
  await until(() => St.S.cfg.stage === 1 || St.S.cfg.preparedQuestions?.length === 1, 5000, '학생 추가 질문 수신');
  write(St, '일부러라면 더 사과해야', 'L', 5); St.ctx.submitComposer();
  await until(() => second.cards.some(c => c.stage === 1), 5000, '만약에 카드');
  first.cards.push({ ...first.cards[0], id: 'hiddencard01', sid: 'sidhidden001', text: '숨긴근거XYZ', hidden: true });
  first.cards.push({ ...first.cards[0], id: 'rightcard001', sid: 'sidright0001', text: '<b>굵게</b> & 아프니까', side: 'R', strength: 2, name: '실명노출금지' });
  const third = A.ctx.boardNew('휴지통에 갈 <질문>', '가', '나', code); third.deletedAt = Date.now(); A.T.room.boards.push(third);
  A.T.maskOff = null;
  html = A.ctx.summaryHTML(A.T.room);
  check('질문판이 만든 순서대로 실린다', html.indexOf('가젤은 사자를 용서해야 할까?') > 0 && html.indexOf('가젤은 사자를 용서해야 할까?') < html.indexOf('사자는 가젤에게 사과해야 할까?') && html.includes('1번째 질문') && html.includes('2번째 질문') && !html.includes('3번째 질문'));
  check('휴지통의 질문판은 빠진다', !html.includes('휴지통에 갈'));
  check('숨긴 카드는 빠진다', !html.includes('숨긴근거XYZ'));
  check('이름은 싣지 않는다', !html.includes('별명ZZ') && !html.includes('실명노출금지'));
  check('학생 글은 그대로 글자로만 실린다(태그로 해석하지 않음)', html.includes('&lt;b&gt;굵게&lt;/b&gt; &amp; 아프니까') && !html.includes('<b>굵게'));
  check('양쪽 근거와 양 끝 이름', html.includes('먼저 사과했으니까') && html.includes('◀ 용서해야 해') && html.includes('용서하지 않아도 돼 ▶') && html.includes('다친 건 가젤이니까'));
  check('밧줄 분포: 왼쪽 세기 4에 1장, 오른쪽 세기 2에 1장', html.includes('aria-label="용서해야 해 세기 4: 1장"') && html.includes('aria-label="용서하지 않아도 돼 세기 2: 1장"') && html.includes('aria-label="용서해야 해 세기 5: 0장"'));
  check('진행 중인 판에서 가려 둔 추가 질문과 만약에 생각은 싣지 않는다', A.ctx.extraMasked() && !html.includes('사자가 일부러 그랬다면?') && !html.includes('일부러라면 더 사과해야') && html.includes('가려 두어 싣지 않았어요'));
  A.T.maskOff = second.id;
  html = A.ctx.summaryHTML(A.T.room);
  check('가리기를 끄면 추가 질문과 만약에 생각이 단계별로 실린다', html.includes('추가 질문 1 · 그런데 만약에?') && html.includes('사자가 일부러 그랬다면?') && html.includes('일부러라면 더 사과해야') && html.includes('처음 생각'));
  A.ctx.openSummary();
  check('종합 보기 화면이 열린다', A.shown() === 'sum-view' && A.$('#sm-body').innerHTML === html);
  write(S2, '종합 보기 중에 온 근거', 'R', 3); S2.ctx.submitComposer();
  await until(() => A.$('#sm-body').innerHTML.includes('종합 보기 중에 온 근거'), 5000, '종합 보기 갱신');
  check('띄워 둔 동안 들어온 근거도 반영된다', true);
  A.$('#sm-back').onclick();
  check('「판으로」로 돌아온다', A.shown() === 'board-view');

  console.log('N9. 저장 형식 · 오프라인');
  A.T.room.boards = A.T.room.boards.filter(b => b !== third); first.cards = first.cards.filter(c => !['hiddencard01', 'rightcard001'].includes(c.id));
  let ok = true, msg = '';
  try { require('vm').runInContext('validateBackup(JSON.parse(JSON.stringify(backupObject(T.room))))', A.ctx); /* 앱과 같은 실행 환경에서 왕복해야 객체 원형 검사가 맞는다 */ } catch (e) { ok = false; msg = e.message; }
  check('새 질문 시작으로 만든 수업이 JSON 저장 → 검증을 통과한다', ok, msg);
  A.T.room.offline = true; A.ctx.renderBoard();
  const n = A.T.room.boards.length; A.toasts.length = 0;
  A.ctx.nextQuestion();
  check('오프라인 보관 사본에서는 새 질문 시작을 막는다', A.shown() === 'board-view' && A.T.room.boards.length === n && A.toasts[0] === '먼저 수업 재개를 눌러 새 코드를 발급해 주세요.' && A.$('#t-next').classList.contains('hide'));
  html = A.ctx.summaryHTML(A.T.room);
  check('오프라인 사본의 종합 보기는 추가 질문까지 싣는다', html.includes('사자가 일부러 그랬다면?'));
  A.T.room.offline = false;

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
