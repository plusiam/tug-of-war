// 학생 작성 칸 시험: 「그대로」 뒤 근거 덧붙이기, 보낸 뒤 화면(카드 고정·폼 접기), 글자 수, 세기 흐리게,
// 수정 시 쓰던 글 보존, 같은 내용 재전송 막기, 쪽 미선택 안내, 새로고침 단추.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  await A.ctx.createGame('사자는 가젤에게 사과해야 할까?', '사과해야 해', '사과하지 않아도 돼');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code, g = A.T.g;
  const join = async name => { const p = makePage(bus, { search: '?c=' + code }); p.ctx.joinGame(code, name); await until(() => p.S.cfg && p.shown() === 'student-view', 5000, name + ' 입장'); return p; };
  const write = (p, text, side, strength) => { p.$('#s-text').value = text; p.$('#s-str').value = strength; p.ctx.setSide(side); };
  const type = (p, text) => { p.$('#s-text').value = text; p.ctx.updatePreview(); };
  const mine = (p, stage) => g.cards.filter(c => c.sid === p.S.me.sid && c.stage === stage);
  const sentShown = p => p.$('#s-panel').classList.contains('sent') && !p.$('#s-sent').classList.contains('hide');
  const cardsSent = p => bus.sent.filter(m => m.event === 'card' && m.payload.sid === p.S.me.sid).length;

  console.log('F1. 글자 수 · 세기 흐리게 (처음 화면)');
  const St = await join('그대로학생');
  check('처음에는 0/60자, 세기는 흐리고 숫자 대신 안내', St.$('#s-count').textContent === '· 0/60자' && St.$('#s-str-field').classList.contains('unset') && St.$('#s-strv').textContent === '(쪽을 먼저 골라요)');
  type(St, '가'.repeat(59));
  check('59자: 59/60자, 강조 없음', St.$('#s-count').textContent === '· 59/60자' && !St.$('#s-count').classList.contains('full'));
  type(St, '가'.repeat(60));
  check('60자: 더 쓸 수 없다고 알리고 강조', St.$('#s-count').textContent === '· 60/60자 · 더 쓸 수 없어요' && St.$('#s-count').classList.contains('full'));
  St.ctx.setSide('R');
  check('쪽을 고르면 세기가 또렷해지고 숫자가 보인다', !St.$('#s-str-field').classList.contains('unset') && String(St.$('#s-strv').textContent) === '3');

  console.log('F2. 보낸 뒤: 카드 고정 · 폼 접기');
  check('보내기 전에는 접히지 않는다', !sentShown(St) && !St.$('#s-tok').className.includes('sent'));
  write(St, '많이 다쳤으니까', 'R', 3); St.ctx.submitComposer();
  await until(() => mine(St, 0)[0] && St.S.me.cards[0].ok, 5000, '처음 답 도착');
  await sleep(100);
  check('도착하면 작성 칸이 접히고 「이번 생각 수정」만 남는다', sentShown(St) && St.$('#s-sent-text').textContent === '✓ 보냈어요 · 사과하지 않아도 돼 쪽 · 세기 3', St.$('#s-sent-text').textContent);
  check('줄 위 내 카드가 보낸 자리에 확정 모양으로 남는다', St.$('#s-tok').className === 'tok R sent' && St.$('#s-tok').textContent === '✓ 많이 다쳤으니까' && St.$('#s-tok').style.left === (50 + 2.5 * 9.2) + '%', St.$('#s-tok').className + ' ' + St.$('#s-tok').style.left);
  check('글자 수는 0으로 돌아간다', St.$('#s-count').textContent === '· 0/60자');

  console.log('F3. 수정: 같은 내용은 다시 보내지 않는다');
  St.$('#s-edit').onclick();
  check('「이번 생각 수정」을 누르면 보낸 카드가 작성 칸에 펴진다', !sentShown(St) && St.S.editing === mine(St, 0)[0].id && St.$('#s-text').value === '많이 다쳤으니까' && St.S.side === 'R' && +St.$('#s-str').value === 3 && St.$('#s-tok').className === 'tok R');
  check('아무것도 바꾸지 않으면 보내기가 꺼져 있고 까닭을 알린다', St.$('#s-send').disabled === true && St.$('#s-send-status').textContent.includes('보낸 내용과 같아요'), St.$('#s-send-status').textContent);
  let n = cardsSent(St); St.ctx.submitComposer(); await sleep(200);
  check('그대로 눌러도 같은 내용은 전송되지 않는다', cardsSent(St) === n && mine(St, 0)[0].rev === 0);
  St.$('#s-str').value = 4; St.ctx.updatePreview();
  check('세기만 바꿔도 보내기가 켜진다', St.$('#s-send').disabled === false && St.$('#s-send').textContent === '이번 생각 수정 보내기');
  St.$('#s-cancel-edit').onclick();
  check('취소하면 다시 접히고 보낸 카드는 그대로', sentShown(St) && mine(St, 0)[0].strength === 3 && St.$('#s-tok').className === 'tok R sent');

  g.whatif.push('사자가 일부러 그랬다면?'); A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();
  await until(() => St.ctx.curStage() === 1, 5000, '추가 질문 수신');

  console.log('K1. 그대로 보낸 뒤 근거 덧붙이기');
  check('추가 질문이 오면 작성 칸이 다시 펴진다', !sentShown(St) && St.S.side === null && St.$('#s-send').disabled === true && St.$('#s-tok').className === 'tok unset');
  St.ctx.keepSame(mine(St, 0)[0].id);
  await until(() => mine(St, 1)[0] && St.S.me.cards.find(c => c.stage === 1)?.ok, 5000, '그대로 카드 도착');
  await sleep(200);
  check('그대로 카드는 처음 답과 같은 글·쪽·세기로 한 장', mine(St, 1).length === 1 && mine(St, 1)[0].text === '많이 다쳤으니까' && mine(St, 1)[0].side === 'R' && mine(St, 1)[0].strength === 3);
  check('그대로 보낸 카드가 줄 위에 고정되고 작성 칸은 접힌다', sentShown(St) && St.$('#s-tok').className === 'tok R sent', St.$('#s-tok').className);
  St.$('#s-edit').onclick();
  type(St, '일부러라면 더욱 사과해야 해요');
  check('수정에서 근거만 고치면 「이번 생각 수정 보내기」가 켜진다', St.$('#s-send').disabled === false && St.$('#s-send').textContent === '이번 생각 수정 보내기', St.$('#s-send').textContent + ' / ' + St.$('#s-send-status').textContent);
  St.ctx.submitComposer();
  await until(() => mine(St, 1)[0]?.text === '일부러라면 더욱 사과해야 해요', 5000, '덧붙인 근거 도착');
  check('같은 카드가 새 근거로 고쳐진다(한 사람 한 단계 한 장)', mine(St, 1).length === 1 && mine(St, 1)[0].side === 'R' && mine(St, 1)[0].strength === 3 && mine(St, 1)[0].rev === 1 && mine(St, 0)[0].text === '많이 다쳤으니까');

  console.log('K2. 근거를 먼저 쓰고 그대로를 누른 학생');
  const S2 = await join('먼저쓴학생');
  write(S2, '사과가 먼저니까', 'L', 5); S2.ctx.submitComposer();
  await until(() => mine(S2, 0)[0], 5000, 'S2 처음 답');
  await until(() => S2.ctx.curStage() === 1, 5000, 'S2 추가 질문');
  type(S2, '일부러라면 용서 못 해');
  S2.ctx.keepSame(mine(S2, 0)[0].id);
  await until(() => S2.S.me.cards.find(c => c.stage === 1)?.ok, 5000, 'S2 그대로 도착');
  await sleep(200);
  check('그대로 카드는 앞선 글로 가고, 쓰던 글은 작성 칸에 남는다(접히지 않음)', mine(S2, 1)[0].text === '사과가 먼저니까' && S2.$('#s-text').value === '일부러라면 용서 못 해' && !sentShown(S2));
  check('남은 글을 바로 보낼 수 있다', S2.S.side === 'L' && S2.$('#s-send').disabled === false, 'side ' + S2.S.side + ' / ' + S2.$('#s-send-status').textContent);

  console.log('K3. 이미 다른 쪽을 골라 둔 학생');
  const S3 = await join('고른학생');
  write(S3, '사과해야 마음이 풀려', 'L', 2); S3.ctx.submitComposer();
  await until(() => mine(S3, 0)[0], 5000, 'S3 처음 답');
  await until(() => S3.ctx.curStage() === 1, 5000, 'S3 추가 질문');
  S3.$('#s-str').value = 4; S3.ctx.setSide('R');
  S3.ctx.keepSame(mine(S3, 0)[0].id);
  await until(() => S3.S.me.cards.find(c => c.stage === 1)?.ok, 5000, 'S3 그대로 도착');
  check('고른 쪽·세기를 덮어쓰지 않는다', S3.S.side === 'R' && +S3.$('#s-str').value === 4);

  console.log('F4. 수정을 눌러도 쓰던 글이 지워지지 않는다');
  const S5 = await join('쓰던글학생');
  write(S5, '처음에 보낸 글', 'L', 2); S5.ctx.submitComposer();
  await until(() => mine(S5, 0)[0] && S5.S.me.cards[0].ok, 5000, 'S5 처음 답');
  await until(() => S5.ctx.curStage() === 1, 5000, 'S5 추가 질문');
  write(S5, '추가 질문 답', 'R', 4); S5.ctx.submitComposer();
  await until(() => S5.S.me.cards.find(c => c.stage === 1)?.ok, 5000, 'S5 추가 답 도착');
  await sleep(100);
  const cur5 = S5.S.me.cards.find(c => c.stage === 1);
  type(S5, '새로 쓰던 글'); S5.toasts.length = 0;
  S5.ctx.startEdit(cur5.id);
  check('쓰던 글은 그대로 두고 알린다', S5.$('#s-text').value === '새로 쓰던 글' && S5.toasts.some(t => t.startsWith('쓰던 글은 그대로 두었어요')));
  check('고르지 않았던 쪽·세기는 보낸 카드 것으로 채운다', S5.S.side === 'R' && +S5.$('#s-str').value === 4 && S5.$('#s-send').disabled === false);
  S5.$('#s-cancel-edit').onclick();
  check('취소하면 쓰던 글을 지우고 보낸 카드 화면으로', S5.$('#s-text').value === '' && sentShown(S5));
  S5.ctx.startEdit(cur5.id);
  check('쓰던 글이 없으면 보낸 글을 불러온다', S5.$('#s-text').value === '추가 질문 답' && S5.S.side === 'R');

  console.log('K4. 쪽을 고르지 않고 글만 쓴 학생에게 안내 강조');
  const S4 = await join('글만쓴학생');
  check('아무것도 쓰지 않았을 때는 강조하지 않는다', !S4.$('#s-send-status').dataset.need);
  type(S4, '쪽은 아직 못 골랐어요');
  check('글만 쓰면 보내기는 꺼져 있고 안내 두 곳을 강조한다', S4.$('#s-send').disabled === true && S4.$('#s-send-status').dataset.need === 'side' && S4.$('#s-selection').dataset.need === 'side' && S4.$('#s-send-status').textContent.includes('아직 쪽을 고르지 않았어요'));
  S4.ctx.setSide('L'); S4.ctx.renderComposerStatus();
  check('쪽을 고르면 강조가 풀리고 보낼 수 있다', !S4.$('#s-send-status').dataset.need && !S4.$('#s-selection').dataset.need && S4.$('#s-send').disabled === false);

  console.log('K5. 새로고침 단추');
  { let reloads = 0; S4.location.reload = () => { reloads++; };
    type(S4, '새로고침 전에 쓰던 글'); S4.ctx.setSide('R');
    S4.$('#s-reload').onclick();
    await sleep(100);
    check('학생 새로고침: 쓰던 글을 보관한 뒤 화면을 다시 연다', reloads === 1 && S4.S.me.drafts[g.id]?.text === '새로고침 전에 쓰던 글' && S4.toasts.at(-1) === '새로고침하는 중…', 'reloads ' + reloads);
    let tr = 0; A.location.reload = () => { tr++; }; const snap = JSON.stringify(A.T.room);
    A.ctx.reloadApp(); await sleep(100);
    check('교사 새로고침: 수업 자료를 바꾸지 않고 화면만 다시 연다', tr === 1 && JSON.stringify(A.T.room) === snap);
    A.ctx.moreMenu();
    check('교사 ⋯ 메뉴에 「새로고침」이 있다', A.overlays().at(-1).innerHTML.includes('data-a="reload"'));
    A.overlays().at(-1).remove(); }

  console.log('F5. 응답 잠시 멈춤 · 판 전환에서는 접지 않는다');
  { const b2 = A.ctx.boardNew('둘째 질문', '가', '나', code); A.T.room.boards.push(b2); A.T.room.activeBoardId = b2.id; A.ctx.saveGame(); A.ctx.pushConfig();
    await until(() => St.S.cfg.boardId === b2.id, 5000, '판 전환');
    check('새 질문판에서는 작성 칸이 펴져 있고 줄 위 카드는 미선택', !sentShown(St) && St.$('#s-tok').className === 'tok unset' && St.$('#s-str-field').classList.contains('unset')); }

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
