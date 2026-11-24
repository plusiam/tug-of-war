// 「앞선 생각 그대로 보내기」 뒤에 근거를 덧붙여 보내는 흐름과, 쪽을 고르지 않았을 때의 안내 시험.
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
  const type = (p, text) => { p.$('#s-text').value = text; p.ctx.renderComposerStatus(); };
  const mine = (p, stage) => g.cards.filter(c => c.sid === p.S.me.sid && c.stage === stage);

  const St = await join('그대로학생');
  write(St, '많이 다쳤으니까', 'R', 3); St.ctx.submitComposer();
  await until(() => mine(St, 0)[0], 5000, '처음 답');
  g.whatif.push('사자가 일부러 그랬다면?'); A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();
  await until(() => St.ctx.curStage() === 1, 5000, '추가 질문 수신');

  console.log('K1. 그대로 보낸 뒤 근거만 덧붙이기');
  check('추가 질문에서는 작성 칸이 비어 있다', St.S.side === null && St.$('#s-send').disabled === true);
  St.ctx.keepSame(mine(St, 0)[0].id);
  await until(() => mine(St, 1)[0] && St.S.me.cards.find(c => c.stage === 1)?.ok, 5000, '그대로 카드 도착');
  await sleep(200);
  check('그대로 카드는 처음 답과 같은 글·쪽·세기로 한 장', mine(St, 1).length === 1 && mine(St, 1)[0].text === '많이 다쳤으니까' && mine(St, 1)[0].side === 'R' && mine(St, 1)[0].strength === 3);
  check('작성 칸에 그대로 보낸 자리가 놓인다(도착 확인 뒤에도)', St.S.side === 'R' && +St.$('#s-str').value === 3, 'side ' + St.S.side + ' str ' + St.$('#s-str').value);
  check('글이 없으면 아직 보낼 수 없고 근거를 적으라고 안내', St.$('#s-send').disabled === true && St.$('#s-send-status').textContent.includes('근거를 적으면 보낼 수 있어요'), St.$('#s-send-status').textContent);
  type(St, '일부러라면 더욱 사과해야 해요');
  check('근거만 써도 「이번 생각 수정 보내기」가 켜진다', St.$('#s-send').disabled === false && St.$('#s-send').textContent === '이번 생각 수정 보내기', St.$('#s-send').textContent + ' / ' + St.$('#s-send-status').textContent);
  St.ctx.submitComposer();
  await until(() => mine(St, 1)[0]?.text === '일부러라면 더욱 사과해야 해요', 5000, '덧붙인 근거 도착');
  check('같은 카드가 새 근거로 고쳐진다(한 사람 한 단계 한 장)', mine(St, 1).length === 1 && mine(St, 1)[0].side === 'R' && mine(St, 1)[0].strength === 3 && mine(St, 1)[0].rev === 1 && mine(St, 0)[0].text === '많이 다쳤으니까');

  console.log('K2. 근거를 먼저 쓰고 그대로를 누른 학생');
  const S2 = await join('먼저쓴학생');
  await until(() => S2.ctx.curStage() === 0, 2000).catch(() => {});
  write(S2, '사과가 먼저니까', 'L', 5); S2.ctx.submitComposer();
  await until(() => mine(S2, 0)[0], 5000, 'S2 처음 답');
  await until(() => S2.ctx.curStage() === 1, 5000, 'S2 추가 질문');
  type(S2, '일부러라면 용서 못 해');
  S2.ctx.keepSame(mine(S2, 0)[0].id);
  await until(() => S2.S.me.cards.find(c => c.stage === 1)?.ok, 5000, 'S2 그대로 도착');
  await sleep(200);
  check('그대로 카드는 앞선 글로 가고, 쓰던 글은 작성 칸에 남는다', mine(S2, 1)[0].text === '사과가 먼저니까' && S2.$('#s-text').value === '일부러라면 용서 못 해');
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

  console.log('K4. 쪽을 고르지 않고 글만 쓴 학생에게 안내 강조');
  const S4 = await join('글만쓴학생');
  check('아무것도 쓰지 않았을 때는 강조하지 않는다', !S4.$('#s-send-status').dataset.need);
  type(S4, '쪽은 아직 못 골랐어요');
  check('글만 쓰면 보내기는 꺼져 있고 안내 두 곳을 강조한다', S4.$('#s-send').disabled === true && S4.$('#s-send-status').dataset.need === 'side' && S4.$('#s-selection').dataset.need === 'side' && S4.$('#s-send-status').textContent.includes('아직 쪽을 고르지 않았어요'));
  S4.ctx.setSide('L'); S4.ctx.renderComposerStatus();
  check('쪽을 고르면 강조가 풀리고 보낼 수 있다', !S4.$('#s-send-status').dataset.need && !S4.$('#s-selection').dataset.need && S4.$('#s-send').disabled === false);

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
