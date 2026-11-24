// 수업 닫힘 알림 시험: 교사가 수업을 닫으면 학생이 실시간 연결(서버의 접속 자리)을 놓고 안내를 본다.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  await A.ctx.createGame('사자는 가젤에게 사과해야 할까?', '사과해야 해', '사과하지 않아도 돼');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code, g = A.T.g, roomId = A.T.room.storageId;
  const join = async name => { const p = makePage(bus, { search: '?c=' + code }); p.ctx.joinGame(code, name); await until(() => p.S.cfg && p.shown() === 'student-view', 5000, name + ' 입장'); return p; };
  const write = (p, text, side, strength) => { p.$('#s-text').value = text; p.$('#s-str').value = strength; p.ctx.setSide(side); };
  const seats = () => new Set([...bus.subs].map(ch => ch.page)).size; // 연결을 쥐고 있는 화면 수
  const sockets = () => [A, ...studs].filter(p => p.sock.connected).length; // 서버의 접속 자리 = 열린 웹소켓 수
  const studs = [];
  for (let i = 0; i < 6; i++) studs.push(await join('학생' + i));
  const St = studs[0];
  write(St, '보낸 근거', 'L', 4); St.ctx.submitComposer();
  await until(() => St.S.me.cards[0]?.ok, 5000, '카드 도착');
  St.$('#s-edit').onclick(); St.$('#s-text').value = '닫히기 전에 쓰던 글'; St.ctx.updatePreview();

  console.log('X1. 수업 중');
  check('교사 1 + 학생 6이 연결을 쥐고 있다', seats() === 7 && sockets() === 7, seats() + ' / ' + sockets());
  check('닫힘 안내는 보이지 않는다', St.$('#s-closed').classList.contains('hide') && !St.$('#student-view').classList.contains('closed'));

  console.log('X2. 다른 수업의 닫힘 알림은 무시한다');
  bus.deliver({ topic: 'tow3-' + code + '-all', event: 'closed', payload: { roomId: 'otherroom0001', configSeq: 1 } });
  await sleep(200);
  check('수업 번호가 다르면 연결을 놓지 않는다', seats() === 7 && !St.S.closed);

  console.log('X3. 교사가 수업을 닫으면');
  const from = bus.sent.length;
  A.ctx.leaveTeacher();
  await until(() => studs.every(p => p.S.closed), 5000, '학생 닫힘 수신');
  await sleep(600);
  const closedMsgs = bus.sent.slice(from).filter(m => m.event === 'closed');
  check('닫힘 알림을 전체 알림 주제로 한 번 보낸다', closedMsgs.length === 1 && closedMsgs[0].topic === 'tow3-' + code + '-all' && closedMsgs[0].payload.roomId === roomId);
  check('학생 화면이 연결을 모두 놓는다(남은 자리 0)', seats() === 0 && studs.every(p => p.S.chs.length === 0 && p.S.connected === false), seats() + '');
  await sleep(2500);
  check('채널뿐 아니라 웹소켓 연결까지 닫는다(교사·학생 모두, 서버의 접속 자리 0)', sockets() === 0 && studs.every(p => p.sock.disconnects === 1) && A.sock.disconnects >= 1, sockets() + '');
  check('학생에게 닫혔다는 안내와 「다시 들어가기」가 보인다', !St.$('#s-closed').classList.contains('hide') && St.$('#student-view').classList.contains('closed') && St.shown() === 'student-view');
  check('쓰던 글은 초안으로 보관된다', St.S.me.drafts[g.id]?.text === '닫히기 전에 쓰던 글');
  check('보낸 카드 기록은 그대로', St.S.me.cards.length === 1 && St.S.me.cards[0].ok === true);
  let n = bus.sent.filter(m => m.event === 'card').length;
  St.ctx.setSide('R'); St.ctx.submitComposer(); await sleep(200);
  check('닫힌 동안에는 카드를 보내지 않는다', bus.sent.filter(m => m.event === 'card').length === n);
  check('화면으로 돌아와도(복귀 처리) 다시 잇지 않는다', (await St.ctx.recoverStudent()) === 'closed' && seats() === 0);
  St.setVisible(false); St.setVisible(true); await sleep(3000);
  check('탭을 다시 보아도 자리를 다시 차지하지 않는다', seats() === 0);

  console.log('X4. 교사가 다시 열고 학생이 다시 들어가기');
  A.ctx.openRoom(A.T.room);
  await until(() => A.T.connected, 8000, '교사 재연결');
  await sleep(500);
  check('교사가 다시 열어도 학생은 저절로 이어지지 않는다', seats() === 1 && St.S.closed === true);
  St.$('#s-rejoin').onclick();
  await until(() => St.S.cfg && St.shown() === 'student-view' && !St.S.closed, 6000, '다시 들어가기');
  await sleep(300);
  check('다시 들어가면 연결이 저절로 다시 열린다', St.sock.connected === true && sockets() === 2, sockets() + '');
  check('「다시 들어가기」로 같은 학생으로 돌아온다', seats() === 2 && St.S.me.cards.length === 1 && St.$('#s-closed').classList.contains('hide') && !St.$('#student-view').classList.contains('closed'));
  check('쓰던 글과 고른 쪽이 돌아온다', St.$('#s-text').value === '닫히기 전에 쓰던 글');
  St.ctx.setSide('L'); St.$('#s-str').value = 2; St.ctx.updatePreview(); St.ctx.submitComposer();
  await until(() => g.cards[0]?.text === '닫히기 전에 쓰던 글', 5000, '다시 들어온 뒤 전송');
  check('다시 들어온 뒤 보내면 교사 판에 도착한다(카드는 한 장 그대로)', g.cards.length === 1 && g.cards[0].rev === 1);

  console.log('X4b. 학생이 「나가기」를 누르면 연결도 놓는다');
  { const n0 = St.sock.disconnects; St.$('#s-leave').onclick(); await sleep(2500);
    check('나가기: 채널과 웹소켓 연결을 모두 닫는다', St.sock.connected === false && St.sock.disconnects === n0 + 1 && St.shown() === 'join-view');
    St.ctx.joinGame(code, '학생0'); await until(() => St.S.cfg && St.shown() === 'student-view', 6000, '나갔다가 다시 입장');
    await sleep(2500);
    check('나갔다가 바로 다시 들어오면 연결을 끊지 않고 이어 쓴다', St.sock.connected === true && St.S.me.cards.length === 1); }
  console.log('X4c. 복귀 복구(채널을 닫고 바로 다시 구독)는 연결을 끊지 않는다');
  { const n0 = St.sock.disconnects; St.S.chs.forEach(ch => { ch.state = 'closed'; }); bus.subs.forEach(ch => { if (ch.page === St) bus.subs.delete(ch); });
    await St.ctx.recoverStudent(); await sleep(3000);
    check('복구 뒤에도 연결되어 있고 끊은 적이 없다', St.sock.connected === true && St.sock.disconnects === n0 && St.S.chs.length === 2, St.sock.disconnects + ' / ' + n0); }

  console.log('X5. 보관 사본 · 같은 수업 다시 열기');
  { const before = bus.sent.filter(m => m.event === 'closed').length;
    A.ctx.openRoom(A.T.room); await sleep(400);
    check('같은 수업을 다시 열 때는 닫힘 알림을 보내지 않는다', bus.sent.filter(m => m.event === 'closed').length === before && !St.S.closed);
    A.T.room.offline = true; A.ctx.leaveTeacher(); await sleep(400);
    check('보관 사본(오프라인)을 닫을 때는 알림을 보내지 않는다', bus.sent.filter(m => m.event === 'closed').length === before);
    A.T.room.offline = false; }

  await sleep(200);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
