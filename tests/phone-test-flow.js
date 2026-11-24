// 흐름 시험: 접속코드 겹침 검사, 동시 생성 대비, 교사 복귀 복구, 화면 꺼짐 방지, 수업 닫기, 폰 판 그리기, 학생 자동 재전송·복귀.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, SPEED, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const topicIn = c => 'tow3-' + c + '-in', topicAll = c => 'tow3-' + c + '-all';
const appMs = t => (Date.now() - t) * SPEED;
const count = (bus, f) => bus.sent.filter(f).length;
const press = (page, sel, id) => page.$('#phone-board').fire('click', { target: { closest: s => (s === sel ? { dataset: { id, pf: id, hide: id } } : null) } });
const lastOverlay = page => page.overlays().at(-1);

(async () => {
  console.log('B1. codeTaken · freshCode');
  {
    const bus = makeBus(), p = makePage(bus);
    let t = Date.now(), r = await p.ctx.codeTaken('1111');
    check('빈 코드는 false, 구독 뒤 2.2초를 듣는다', r === false && appMs(t) >= 2200 && appMs(t) < 3600, appMs(t) + 'ms');
    bus.subscribeDelay = 3000; t = Date.now(); r = await p.ctx.codeTaken('1111');
    check('구독이 3초 걸려도 그 뒤 2.2초를 채워 듣는다(타이머는 구독 완료 뒤 시작)', r === false && appMs(t) >= 5200, appMs(t) + 'ms');
    bus.subscribeDelay = 6000; t = Date.now(); r = await p.ctx.codeTaken('1111').catch(() => 'error');
    check('5초 안에 구독되지 않으면 오류', r === 'error' && appMs(t) >= 5000 && appMs(t) < 6000, appMs(t) + 'ms');
    r = await p.ctx.freshCode().catch(e => e.message);
    check('freshCode가 연결 안내 문구를 던진다', r === '연결을 확인하지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.', r);
    bus.subscribeDelay = 15; bus.subscribeMode = 'error';
    check('구독 실패(CHANNEL_ERROR)도 오류', await p.ctx.codeTaken('1111').catch(() => 'error') === 'error');
    bus.subscribeMode = 'ok'; bus.http = false;
    check('hello를 보내지 못해도 오류(빈 코드로 보지 않는다)', await p.ctx.codeTaken('1111').catch(() => 'error') === 'error');
    // 방 만들기 실패: 설정 화면에 남고 버튼이 원래대로 돌아와야 한다
    p.ctx.openSetup(false);
    p.$('#in-q').value = '질문'; p.$('#in-l').value = '왼'; p.$('#in-r').value = '오';
    const making = p.$('#setup-go').onclick();
    check('만드는 동안은 「코드 만드는 중…」·누를 수 없음', p.$('#setup-go').textContent === '코드 만드는 중…' && p.$('#setup-go').disabled === true);
    await making;
    check('실패하면 버튼 글자가 「판 만들기」로 돌아오고 다시 누를 수 있다', p.shown() === 'setup-view' && p.$('#setup-go').textContent === '판 만들기' && p.$('#setup-go').disabled === false && p.T.room === null);
    check('실패 안내가 뜬다', p.toasts.at(-1) === '연결을 확인하지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.');
    bus.http = true;
    await p.$('#setup-go').onclick();
    check('연결이 돌아온 뒤 다시 누르면 판이 만들어진다', p.shown() === 'board-view' && /^\d{4}$/.test(p.T.room.code));
    p.ctx.leaveTeacher();
    await sleep(300);
    check('확인용 채널이 남지 않는다', bus.subs.size === 0, 'live ' + bus.subs.size);
  }

  console.log('B2. 동시 생성 대비 · A2 교사 복귀 · A1 화면 꺼짐 방지 · C 폰 판');
  const bus = makeBus();
  const A = makePage(bus);
  await A.ctx.createGame('가젤은 사자를 용서해야 할까?', '용서해야 해', '용서하지 않아도 돼');
  await until(() => A.T.connected, 3000, 'A 구독');
  const codeA = A.T.room.code;
  check('판이 열리고 교사 채널이 하나', A.shown() === 'board-view' && bus.liveOn(topicIn(codeA)) === 1);
  check('config에 roomCreated가 실린다', A.ctx.cfgPayload().roomCreated === A.T.room.created && A.ctx.cfgPayload().roomId === A.T.room.storageId);
  await sleep(3500);
  const probesOf = page => count(bus, m => m.event === 'hello' && m.payload.probe && m.payload.roomId === page.T.room.storageId);
  check('새 코드 직후 겹침 확인 hello를 한 번 보낸다', probesOf(A) === 1 && A.T.probeCode === null);
  check('겹치지 않으면 코드·알림 그대로, 확인 채널 정리', A.T.room.code === codeA && A.toasts.length === 0 && bus.subs.size === 1);
  {
    const other = makePage(bus);
    check('쓰는 중인 코드는 codeTaken이 true', await other.ctx.codeTaken(codeA) === true);
  }

  // 폰 판(360px)
  check('폰 폭이면 #board-view.phone, 요약 밧줄과 안내 문구', A.$('#board-view').classList.contains('phone') && A.$('#phone-board').innerHTML.includes('pb-sum') && A.$('#phone-board').innerHTML.includes('pb-empty'));

  // 화면 꺼짐 방지
  await sleep(50);
  check('온라인 판이 보이면 화면 꺼짐 방지를 요청', A.wakeRequests === 1 && !!A.T.wake);
  A.setVisible(false); await sleep(50);
  check('탭이 가려지면 해제', A.T.wake === null && A.wakeReleases === 1);
  A.setVisible(true); await sleep(200);
  check('다시 보이면 재요청', A.wakeRequests === 2 && !!A.T.wake);
  A.ctx.openSetup(true); await sleep(50);
  check('판을 떠나면(설정 화면) 해제', A.T.wake === null);
  A.ctx.openBoard(); await sleep(50);
  check('판으로 돌아오면 다시 요청', !!A.T.wake && bus.liveOn(topicIn(codeA)) === 1);
  await sleep(4000); // 앞선 복귀 확인(ping 되받기)과 그때 보낸 config가 모두 끝나기를 기다린다

  // 교사 복귀 복구
  let pings = count(bus, m => m.event === 'ping'), cfgs = count(bus, m => m.event === 'config');
  let ch0 = A.T.ch, r = await A.ctx.recoverTeacher();
  check('살아 있어도 확인이 끝나기 전에는 config를 보내지 않는다', count(bus, m => m.event === 'config') === cfgs);
  await sleep(800);
  const seen = [r, A.T.ch === ch0, count(bus, m => m.event === 'ping') - pings, count(bus, m => m.event === 'config') - cfgs].join();
  check('살아 있으면 alive: 채널 그대로, ping 한 번 되받은 뒤 pushConfig만', seen === 'alive,true,1,1', seen);
  bus.subs.delete(ch0); // 연결됨으로 보이지만 실제로는 받지 못하는 채널
  cfgs = count(bus, m => m.event === 'config');
  r = await A.ctx.recoverTeacher();
  await until(() => A.T.connected, 3000, 'A 재구독');
  await sleep(400);
  check('죽은 채널은 정리하고 다시 구독(resubscribed)', r === 'resubscribed' && A.T.ch !== ch0 && ch0._closed === true);
  check('다시 구독한 뒤 채널은 하나, 구독 완료 뒤 pushConfig, 연결 점 켜짐', bus.liveOn(topicIn(codeA)) === 1 && count(bus, m => m.event === 'config') > cfgs && A.$('#b-dot').classList.contains('on'));
  check('재구독은 겹침 확인을 다시 보내지 않는다(새 코드 직후 한 번뿐)', probesOf(A) === 1);
  bus.subs.delete(A.T.ch);
  const p1 = A.ctx.recoverTeacher(), p2 = A.ctx.recoverTeacher();
  check('동시에 여러 번 불러도 한 번만 돈다', p1 === p2);
  await p1; await until(() => A.T.connected, 3000);
  check('중복 채널 없음', bus.liveOn(topicIn(codeA)) === 1);
  bus.subs.delete(A.T.ch); ch0 = A.T.ch;
  let opened = bus.opened.filter(t => t === topicIn(codeA)).length;
  A.setVisible(false); A.setVisible(true); A.fireWindow('online'); A.fireWindow('pageshow', { persisted: true });
  await until(() => A.T.ch !== ch0 && A.T.connected, 8000, '이벤트로 복구');
  await sleep(500);
  check('보임·online·pageshow가 한꺼번에 와도 한 번만 다시 구독', bus.opened.filter(t => t === topicIn(codeA)).length === opened + 1 && bus.liveOn(topicIn(codeA)) === 1);
  A.T.connected = false; A.T.subAt = require('vm').runInContext('Date.now()', A.ctx) - 20000; // 끊긴 지 20초(앱 시간)
  r = await A.ctx.recoverTeacher();
  check('끊긴 채(구독한 지 오래) 있으면 다시 구독', r === 'resubscribed');
  r = await A.ctx.recoverTeacher();
  check('구독 중에는 기다린다(pending)', r === 'pending' || r === 'alive', r);
  await until(() => A.T.connected, 3000);
  check('여전히 채널 하나', bus.liveOn(topicIn(codeA)) === 1);

  // 동시 생성: B가 같은 코드를 받았다(나중에 만든 쪽)
  const B = makePage(bus);
  const next = [codeA, codeA === '4321' ? '4322' : '4321'];
  B.ctx.freshCode = async () => next.shift();
  await B.ctx.createGame('다른 질문', '왼', '오');
  check('B가 A와 같은 코드로 시작(겹침 재현)', B.T.room.code === codeA);
  await until(() => B.T.room.code !== codeA && B.T.connected, 8000, 'B 새 코드');
  await sleep(300);
  const codeB = B.T.room.code;
  check('나중에 만든 쪽(B)이 새 코드로 옮긴다', codeB === next.concat('4321', '4322').find(c => c === codeB) && B.T.room.boards.every(b => b.code === codeB));
  check('B: 알림, QR 재표시(창 하나), 저장, 주소', B.toasts.includes('다른 수업과 접속 코드가 겹쳐 새 코드로 바꿨어요') && B.overlays().filter(o => o.classList.contains('qr-ov')).length === 1 && lastOverlay(B).innerHTML.includes(codeB) && JSON.parse(B.storage['tow:room:' + B.T.room.storageId]).code === codeB);
  check('B는 새 코드만 구독, A는 그대로 한 채널', bus.liveOn(topicIn(codeB)) === 1 && bus.liveOn(topicIn(codeA)) === 1 && A.T.room.code === codeA && A.toasts.length === 0);
  await sleep(3500);
  check('B는 새 코드에서도 한 번 더 확인한다', probesOf(B) === 2);

  // 카드가 있는 수업은 바꾸지 않고 경고만
  const C = makePage(bus);
  C.ctx.freshCode = async () => codeA;
  await C.ctx.createGame('카드 있는 수업', '왼', '오');
  C.T.g.cards.push({ id: 'k1', boardId: C.T.g.id, sid: 's1', name: '', text: '이미 온 카드', side: 'L', strength: 3, rev: 0, phase: 0, stage: 0, from: null, likes: [], hidden: false, history: [{ side: 'L', strength: 3, text: '이미 온 카드', phase: 0, t: 1 }] });
  await sleep(4000);
  check('카드가 있으면 코드를 바꾸지 않고 경고만', C.T.room.code === codeA && C.toasts.length === 1 && C.toasts[0].includes('코드는 바꾸지 않았어요'));
  C.ctx.leaveTeacher();

  // 먼저 만든 쪽이 나중에 확인을 보내는 경우: 받는 쪽(나중에 만든 쪽)이 hello만 보고 옮긴다
  const E = makePage(bus);
  const nextE = [codeA, codeA === '5678' ? '5679' : '5678'];
  E.ctx.freshCode = async () => nextE.shift();
  await E.ctx.createGame('늦게 온 수업', '왼', '오');
  E.T.probeCode = null; // E 스스로는 확인하지 않게 막고
  await until(() => E.T.connected, 3000);
  A.ctx.probeClash();   // 먼저 만든 A가 확인을 보낸다
  await until(() => E.T.room.code !== codeA && E.T.connected, 8000, 'E 새 코드');
  check('상대의 probe hello만으로도 나중 쪽이 옮긴다, A는 그대로', E.T.room.code !== codeA && A.T.room.code === codeA && A.toasts.length === 0);
  E.ctx.leaveTeacher(); B.ctx.leaveTeacher();
  await sleep(200);

  console.log('학생: A3 자동 재전송 · A4 복귀');
  const St = makePage(bus, { search: '?c=' + codeA });
  check('학생 주소는 접속 화면으로', St.shown() === 'join-view');
  St.ctx.joinGame(codeA, '7번');
  await until(() => St.S.cfg && St.shown() === 'student-view', 5000, '학생 입장');
  check('학생이 roomCreated가 붙은 config를 받아들인다', St.S.cfg.roomId === A.T.room.storageId && St.S.cfg.roomCreated === A.T.room.created);
  const write = (text, side, strength) => { St.$('#s-text').value = text; St.$('#s-str').value = strength; St.ctx.setSide(side); };
  const metaOf = c => St.S.me.submissions[c.boardId + ':' + c.id];
  write('첫 근거', 'L', 4); St.ctx.submitComposer();
  await until(() => St.S.me.cards[0]?.ok, 5000, '첫 카드 도착');
  check('카드가 도착하고 교사 판에 1장', A.T.g.cards.length === 1 && A.$('#phone-board').innerHTML.includes('pb-item L'));

  bus.drop = m => m.event === 'card'; // 교사가 카드를 받지 못하는 동안
  write('둘째 근거', 'R', 2); St.ctx.submitComposer();
  let c2 = St.S.me.cards[0];
  await until(() => metaOf(c2).state === 'failed', 25000, '둘째 카드 실패');
  check('여섯 번 보내고 실패로 멈춘다', metaOf(c2).attempts === 6 && !c2.ok);
  A.ctx.pushConfig(); await sleep(600);
  check('교사 config를 받으면 실패한 카드를 자동으로 되살린다', metaOf(c2).state === 'sending' && metaOf(c2).revives === 1);
  bus.drop = () => false;
  await until(() => c2.ok, 8000, '둘째 카드 도착');
  check('같은 카드 수정·재시도로 교사 판에 1장', A.T.g.cards.length === 1 && A.T.g.cards.filter(c => c.id === c2.id).length === 1);

  bus.drop = m => m.event === 'card';
  write('셋째 근거', 'L', 1); St.ctx.submitComposer();
  let c3 = St.S.me.cards[0];
  for (let i = 1; i <= 3; i++) {
    await until(() => metaOf(c3).state === 'failed', 25000, '셋째 카드 실패 ' + i);
    A.ctx.pushConfig(); await sleep(600);
    check(`자동 되살리기 ${i}회째`, metaOf(c3).state === 'sending' && metaOf(c3).revives === i);
  }
  await until(() => metaOf(c3).state === 'failed', 25000, '셋째 카드 실패 4');
  A.ctx.pushConfig(); await sleep(600);
  check('4회째부터는 자동으로 보내지 않는다(학생이 재전송)', metaOf(c3).state === 'failed' && metaOf(c3).revives === 3 && !St.S.pending[c3.boardId + ':' + c3.id]);
  check('저장된 기록에도 횟수가 남는다(새로고침해도 3회 제한)', JSON.parse(St.storage['tow:me:' + codeA + ':7번']).submissions[c3.boardId + ':' + c3.id].revives === 3);
  check('보내기 버튼은 「재전송」', St.$('#s-send').textContent === '재전송');
  St.ctx.submitComposer();
  check('학생이 직접 재전송하면 횟수가 처음으로', metaOf(c3).state === 'sending' && !metaOf(c3).revives);
  bus.drop = () => false;
  await until(() => c3.ok, 8000, '셋째 카드 도착');
  check('같은 단계는 수정 뒤에도 1장', A.T.g.cards.length === 1);

  // 학생 복귀
  let hellos = count(bus, m => m.event === 'hello' && m.payload.sid === St.S.me.sid);
  r = await St.ctx.recoverStudent();
  check('학생: 살아 있으면 hello만 다시(alive)', r === 'alive' && count(bus, m => m.event === 'hello' && m.payload.sid === St.S.me.sid) === hellos + 1);
  St.ctx.startEdit(St.S.me.cards[0].id);
  write('고쳐 쓰는 중인 글', 'R', 5);
  let chs0 = St.S.chs; chs0.forEach(ch => bus.subs.delete(ch));
  const cfg0 = St.S.cfg, joinId = St.S.joinId;
  hellos = count(bus, m => m.event === 'hello' && m.payload.sid === St.S.me.sid);
  r = await St.ctx.recoverStudent();
  await until(() => St.S.connected, 3000, '학생 재구독');
  await sleep(600); // hello의 답(config)까지 받은 뒤
  check('학생: 끊긴 채널은 다시 구독(resubscribed)', r === 'resubscribed' && St.S.chs !== chs0 && St.S.chs.length === 2 && chs0.every(ch => ch._closed));
  check('학생: 채널 중복 없음', bus.liveOn(topicAll(codeA)) === 1 && bus.liveOn('tow3-' + codeA + '-s-' + St.S.me.sid) === 1);
  check('학생: 작성 중인 글·쪽·세기·편집 대상이 그대로', St.$('#s-text').value === '고쳐 쓰는 중인 글' && St.S.side === 'R' && +St.$('#s-str').value === 5 && St.S.editing === St.S.me.cards[0].id && St.S.target === St.S.me.cards[0].id);
  check('학생: 참여·판 설정 유지, 초안 저장됨', St.S.joinId === joinId && St.S.cfg.boardId === cfg0.boardId && St.S.me.drafts[cfg0.boardId].text === '고쳐 쓰는 중인 글' && St.shown() === 'student-view');
  check('학생: 재구독 뒤 hello를 다시 보낸다', count(bus, m => m.event === 'hello' && m.payload.sid === St.S.me.sid) > hellos);
  chs0 = St.S.chs; chs0.forEach(ch => bus.subs.delete(ch));
  St.setVisible(false); St.setVisible(true); St.fireWindow('online');
  await until(() => St.S.chs !== chs0 && St.S.connected, 8000, '학생 이벤트 복구');
  await sleep(600);
  check('학생: 보임·online 이벤트로도 한 번만 복구, 글 유지', bus.liveOn(topicAll(codeA)) === 1 && St.$('#s-text').value === '고쳐 쓰는 중인 글');
  St.ctx.submitComposer();
  await until(() => St.S.me.cards[0].ok, 8000, '고친 카드 도착');
  check('복구 뒤 보낸 수정이 도착(교사 판 1장 그대로, 글 바뀜)', A.T.g.cards.length === 1 && A.T.g.cards.find(c => c.id === St.S.me.cards[0].id).text === '고쳐 쓰는 중인 글');

  // Unrelated list tests require three distinct students, not three cards from one student.
  const peer=(id,text,side,strength)=>{const c=JSON.parse(JSON.stringify(A.T.g.cards[0]));Object.assign(c,{id,sid:id,name:'7번',text,side,strength,rev:0,history:[{side,strength,text,phase:0,t:A.T.g.created}]});A.T.g.cards.push(c);return c;};
  c2=peer('peer2','둘째 근거','R',2);c3=peer('peer3','셋째 근거','L',1);A.ctx.renderBoard();
  console.log('C. 폰 판 동작');
  let html = A.$('#phone-board').innerHTML;
  check('공유 꺼짐: 목록에 근거 글이 없다', (html.match(/class="pb-item/g) || []).length === 3 && !html.includes('둘째 근거') && html.includes('7번'));
  press(A, '.pb-item', c2.id);
  html = A.$('#phone-board').innerHTML;
  check('줄을 누르면 그 줄만 펼쳐진다', A.T.sel.has(c2.id) && html.includes('둘째 근거') && !html.includes('셋째 근거') && html.includes('data-hide="' + c2.id + '"'));
  A.$('#t-share').onclick(); A.$('#t-share').onclick();
  check('공유를 켰다 끄면 펼친 줄이 모두 접힌다', A.T.sel.size === 0 && !A.$('#phone-board').innerHTML.includes('둘째 근거'));
  press(A, '.pb-item', c2.id);
  cfgs = count(bus, m => m.event === 'config');
  press(A, '[data-hide]', c2.id);
  await sleep(500);
  check('숨기기: hidden, 저장, pushConfig, 안내', A.T.g.cards.find(c => c.id === c2.id).hidden === true && JSON.parse(A.storage['tow:room:' + A.T.room.storageId]).boards[0].cards.find(c => c.id === c2.id).hidden === true && count(bus, m => m.event === 'config') > cfgs && A.toasts.at(-1).includes('숨긴 카드'));
  check('숨긴 뒤 목록 2장·장수 표시 2', (A.$('#phone-board').innerHTML.match(/class="pb-item/g) || []).length === 2 && String(A.$('#b-count').textContent) === '2');
  A.T.g.whatif.push('사자가 다시 커진다면?'); A.ctx.renderBoard();
  press(A, '[data-pf]', 'first');
  check('만약에가 뜨면 필터가 생기고 고른 값이 남는다', A.T.phoneFilter === 'first' && /data-pf="first" class="on"/.test(A.$('#phone-board').innerHTML) && (A.$('#phone-board').innerHTML.match(/class="pb-cells"/g) || []).length === 2);
  A.ctx.moreMenu();
  html = lastOverlay(A).innerHTML;
  check('폰 ⋯ 메뉴: 뺀 기능과 「수업 닫고 처음 화면으로」가 있고 묶음 풀기는 없다', ['boards', 'names', 'count', 'export', 'json', 'import', 'home', 'edit', 'unhide', 'new', 'saved'].every(a => html.includes('data-a="' + a + '"')) && !html.includes('data-a="auto"'));
  lastOverlay(A).remove();
  A.width = 1024; A.ctx.moreMenu(); html = lastOverlay(A).innerHTML; lastOverlay(A).remove();
  check('넓은 화면 ⋯ 메뉴: 기존 5개 + 「그런데 만약에?」 + 「새로고침」 + 「수업 닫고 처음 화면으로」만', ['edit', 'auto', 'unhide', 'whatif', 'new', 'saved', 'reload', 'home'].every(a => html.includes('data-a="' + a + '"')) && (html.match(/data-a="/g) || []).length === 9 && !html.includes('data-a="boards"'));
  A.width = 360;

  console.log('C4. 수업 닫고 처음 화면으로');
  A.ctx.confirmLeaveTeacher();
  check('확인 문구', lastOverlay(A).innerHTML.includes('학생 연결이 끊겨요. 수업 기록은 이 기기에 보관돼요.'));
  lastOverlay(A).querySelector('[data-a=ok]').onclick();
  await sleep(200);
  check('시작 화면, 채널 해제, 화면 꺼짐 방지 해제', A.shown() === 'home-view' && A.T.ch === null && A.T.connected === false && bus.liveOn(topicIn(codeA)) === 0 && A.T.wake === null);
  check('주소는 경로만', A.url === '/tug/');
  check('「이어서 열기」가 방금 수업으로 갱신', !A.$('#resume-box').classList.contains('hide') && A.$('#resume-code').textContent === codeA && A.$('#resume-q').textContent === '가젤은 사자를 용서해야 할까?');
  check('기록은 지우지 않는다(카드 3장 보관)', JSON.parse(A.storage['tow:room:' + A.T.room.storageId]).boards[0].cards.length === 3);
  check('닫은 뒤 복귀 이벤트는 아무것도 하지 않는다', await A.ctx.recoverTeacher() === 'idle' && bus.liveOn(topicIn(codeA)) === 0);
  A.$('#resume-btn').onclick();
  await until(() => A.T.connected, 3000, '이어서 열기');
  check('이어서 열면 같은 코드로 다시 구독(채널 하나)', A.shown() === 'board-view' && A.T.room.code === codeA && bus.liveOn(topicIn(codeA)) === 1 && A.T.g.cards.length === 3);


  console.log('독립 검토 4건 회귀 (P1-1 · P1-2 · P2-1 · P2-2)');
  {
    const bus = makeBus(), now = page => require('vm').runInContext('Date.now()', page.ctx);
    const pingsNow = () => count(bus, m => m.event === 'ping'), cfgsNow = () => count(bus, m => m.event === 'config');
    const Tc = makePage(bus);
    await Tc.ctx.createGame('질문', '왼', '오');
    await until(() => Tc.T.connected, 3000, 'Tc 구독');
    const code = Tc.T.room.code;
    const Sp = makePage(bus, { search: '?c=' + code });
    Sp.ctx.joinGame(code, '3번');
    await until(() => Sp.S.cfg && Sp.S.connected, 5000, 'Sp 입장');
    await sleep(3500); // 겹침 확인이 끝날 때까지

    // P2-1 겹침 판정은 '코드를 받은 시각'으로
    check('새 수업: 코드를 받은 시각 = 만든 시각, config·probe에 그 값', Tc.T.codeAt === Tc.T.room.created && Tc.ctx.cfgPayload().roomCreated === Tc.T.room.created && bus.sent.find(m => m.event === 'hello' && m.payload.probe && m.payload.roomId === Tc.T.room.storageId).payload.roomCreated === Tc.T.room.created);
    const created = now(Tc) - 86400000;
    const oldRoom = { schemaVersion: 4, storageId: 'oldroom1', code: '9999', created, configSeq: 5, legacyBoardId: 'ob1', activeBoardId: 'ob1', offline: true,
      boards: [{ id: 'ob1', code: '9999', question: '어제 한 수업', left: '왼', right: '오', cards: [], groups: {}, whatif: [], whatifArchive: [], showNames: false, showCount: false, share: false, fs: 1, created }] };
    const R = makePage(bus, { search: '?room=oldroom1', storage: { 'tow:room:oldroom1': JSON.stringify(oldRoom) } });
    const nextR = [code, code === '6789' ? '6790' : '6789'];
    R.ctx.freshCode = async () => nextR.shift();
    await R.ctx.resumeRoom();
    check('수업 재개: 만든 시각은 옛날이지만 코드를 받은 시각은 지금', R.T.room.code === code && R.T.room.created < Tc.T.room.created && R.T.codeAt > Tc.T.codeAt && R.ctx.cfgPayload().roomCreated === R.T.codeAt);
    await until(() => R.T.room.code !== code && R.T.connected, 8000, 'R 새 코드');
    await sleep(300);
    check('방금 재개한 옛 수업이 코드를 옮기고, 먼저 코드를 받은 수업은 그대로', R.T.room.code !== code && R.toasts.includes('다른 수업과 접속 코드가 겹쳐 새 코드로 바꿨어요') && Tc.T.room.code === code && Tc.toasts.length === 0 && bus.liveOn(topicIn(code)) === 1);
    check('옮긴 뒤 코드를 받은 시각도 새로 잡힌다', R.T.codeAt >= R.T.room.created && R.ctx.cfgPayload().roomCreated === R.T.codeAt);
    check('codeAt은 저장하지 않는다(저장 형식 그대로)', !('codeAt' in JSON.parse(R.storage['tow:room:oldroom1'])) && JSON.parse(R.storage['tow:room:oldroom1']).created === created);
    await sleep(3500);
    R.ctx.leaveTeacher(); R.$('#resume-btn').onclick();
    check('닫았다 다시 열면 코드 받은 시각을 잊고 만든 시각을 쓴다', R.T.codeAt === 0 && R.ctx.cfgPayload().roomCreated === created);
    R.ctx.leaveTeacher(); await sleep(300);

    // P1-2 ping 되받기 세 갈래
    check('echoCheck: 살아 있으면 heard', await Tc.ctx.echoCheck(topicIn(code)) === 'heard');
    const liveCh = Tc.T.ch; bus.subs.delete(liveCh);
    let t = now(Tc), e = await Tc.ctx.echoCheck(topicIn(code));
    check('echoCheck: 보냈는데 3초 동안 못 받으면 silent', e === 'silent' && now(Tc) - t >= 3000 && now(Tc) - t < 4500, e + ' ' + (now(Tc) - t));
    bus.subs.add(liveCh);
    bus.http = false; t = now(Tc); e = await Tc.ctx.echoCheck(topicIn(code));
    check('echoCheck: 전송 실패는 unsent(1초 뒤 한 번 더 보내 본 뒤)', e === 'unsent' && now(Tc) - t >= 1000 && now(Tc) - t < 3000, e + ' ' + (now(Tc) - t));
    let opened = bus.opened.length, r = await Tc.ctx.recoverTeacher();
    check("교사: ping 전송 실패는 'unknown', 멀쩡한 채널을 내리지 않는다", r === 'unknown' && Tc.T.ch === liveCh && Tc.T.connected === true && bus.liveOn(topicIn(code)) === 1 && bus.opened.length === opened && Tc.$('#b-dot').classList.contains('on'));
    const sChs = Sp.S.chs; r = await Sp.ctx.recoverStudent();
    check("학생: ping 전송 실패는 'unknown', 채널 유지", r === 'unknown' && Sp.S.chs === sChs && Sp.S.connected === true && bus.liveOn(topicAll(code)) === 1 && bus.opened.length === opened);
    bus.http = true;

    // P1-1 (a) 살아 있음이 확인된 뒤에만 config
    await sleep(1000);
    let cfgs = cfgsNow(); r = await Tc.ctx.recoverTeacher();
    check('교사 alive: 확인이 끝나기 전에는 config를 보내지 않는다', r === 'alive' && cfgsNow() === cfgs);
    await sleep(800);
    check('교사 alive: 확인된 뒤 config 한 번', cfgsNow() === cfgs + 1);
    // 교사가 못 듣는 동안 학생 카드가 실패로 멈춘다 → 복구 → 구독 완료 뒤의 config로만 되살아난다
    const write = (text, side, strength) => { Sp.$('#s-text').value = text; Sp.$('#s-str').value = strength; Sp.ctx.setSide(side); };
    const metaOf = c => Sp.S.me.submissions[c.boardId + ':' + c.id];
    const posts = c => count(bus, m => m.event === 'card' && m.payload.id === c.id && m.payload.rev === c.rev);
    const dead = Tc.T.ch; bus.subs.delete(dead); // 교사는 연결된 줄 알지만 실제로는 못 듣는다
    write('못 듣는 동안 보낸 근거', 'L', 3); Sp.ctx.submitComposer();
    const k1 = Sp.S.me.cards[0];
    await until(() => metaOf(k1).state === 'failed', 25000, 'k1 실패');
    cfgs = cfgsNow(); r = await Tc.ctx.recoverTeacher();
    check('교사 재구독: 듣기 전에는 config를 보내지 않아 학생의 되살리기를 헛쓰지 않는다', r === 'resubscribed' && cfgsNow() === cfgs && metaOf(k1).state === 'failed' && !metaOf(k1).revives);
    await until(() => k1.ok, 8000, 'k1 도착');
    await sleep(600);
    check('구독 완료 뒤의 config 한 번으로 되살아나 도착(되살리기 1회, 중복 없음)', cfgsNow() === cfgs + 1 && metaOf(k1).revives === 1 && Tc.T.g.cards.length === 1 && posts(k1) === 7, [cfgsNow() - cfgs, metaOf(k1).revives, Tc.T.g.cards.length, posts(k1)].join());

    // P1-1 (b) 보내는 중인 카드는 config를 받으면 시도 횟수를 0으로
    bus.drop = m => m.event === 'card';
    write('보내는 중인 근거', 'R', 2); Sp.ctx.submitComposer();
    const k2 = Sp.S.me.cards[0], key2 = k2.boardId + ':' + k2.id;
    await until(() => metaOf(k2).attempts === 4, 15000, 'k2 네 번째 시도');
    const run = Sp.S.pending[key2];
    Tc.ctx.pushConfig();
    await until(() => metaOf(k2).attempts < 4, 3000, 'k2 횟수 되돌림');
    check('config를 받으면 보내는 중인 카드의 시도 횟수가 0부터 다시', metaOf(k2).state === 'sending' && run.attempts <= 1 && Sp.S.pending[key2] === run && !metaOf(k2).revives);
    await until(() => metaOf(k2).state === 'failed', 30000, 'k2 실패');
    check('그 시점부터 다시 6회를 채운다(재시도 줄은 하나, 되살리기 횟수는 쓰지 않음)', [10, 11].includes(posts(k2)) && !metaOf(k2).revives, posts(k2) + '회');
    bus.drop = () => false; Tc.ctx.pushConfig();
    await until(() => k2.ok, 8000, 'k2 도착');
    check('수정 도착 뒤 교사 판에 중복 없이 1장', Tc.T.g.cards.length === 1 && Tc.T.g.cards.filter(c => c.id === k2.id).length === 1 && metaOf(k2).revives === 1);

    // P1-2 복귀 처리: 무작위 지연 + 최소 간격
    await sleep(6000);
    let pings = pingsNow();
    Tc.setVisible(false); Tc.setVisible(true); Tc.fireWindow('online'); Tc.fireWindow('pageshow', { persisted: true });
    check('복귀 이벤트는 바로 돌지 않고 예약된다', pingsNow() === pings);
    await sleep(3000);
    check('세 이벤트가 연달아 와도 2초 안에 한 번만 돈다', pingsNow() === pings + 1, String(pingsNow() - pings));
    Tc.fireWindow('online');
    await sleep(1200);
    check('앞선 처리 뒤 5초 안에는 다시 돌지 않는다', pingsNow() === pings + 1, String(pingsNow() - pings));
    await sleep(6500);
    check('미뤄 둔 복귀 처리는 간격이 지난 뒤 한 번 돈다', pingsNow() === pings + 2, String(pingsNow() - pings));
    t = now(Tc); r = await Tc.ctx.recoverTeacher();
    check('recoverTeacher()를 직접 부르면 지연 없이 바로 돈다', r === 'alive' && now(Tc) - t < 600, r + ' ' + (now(Tc) - t));
    t = now(Sp); r = await Sp.ctx.recoverStudent();
    check('recoverStudent()도 직접 부르면 바로 돈다', r === 'alive' && now(Sp) - t < 600, r + ' ' + (now(Sp) - t));

    // P2-2 폰 폭에서는 PNG 내보내기 버튼 없음
    Tc.width = 360; Tc.ctx.exportMenu();
    let html = lastOverlay(Tc).innerHTML; lastOverlay(Tc).remove();
    check('폰 폭 내보내기 창: PNG 없음, CSV·표 복사는 있음', !html.includes('data-a="png"') && html.includes('data-a="csv"') && html.includes('data-a="txt"'));
    Tc.width = 1024; Tc.ctx.exportMenu();
    html = lastOverlay(Tc).innerHTML; lastOverlay(Tc).remove();
    check('넓은 화면 내보내기 창: PNG·CSV·표 복사 그대로', ['png', 'csv', 'txt'].every(a => html.includes('data-a="' + a + '"')));
    Tc.ctx.leaveTeacher();
  }

  console.log('화면 꺼짐 방지: 오프라인·미지원·거부');
  {
    const room = JSON.parse(A.storage['tow:room:' + A.T.room.storageId]); room.offline = true; room.storageId = 'offroom1';
    const Off = makePage(makeBus(), { search: '?room=offroom1', storage: { 'tow:room:offroom1': JSON.stringify(room) } });
    await sleep(100);
    check('오프라인 수업은 요청하지 않고 구독도 없다', Off.shown() === 'board-view' && Off.wakeRequests === 0 && Off.T.ch === null && Off.bus.opened.length === 0);
    const No = makePage(makeBus(), { wakeLock: false });
    await No.ctx.createGame('q', 'l', 'r'); await sleep(100);
    check('지원하지 않는 기기에서도 조용히 넘어간다', No.shown() === 'board-view' && No.T.wake === null);
    const Deny = makePage(makeBus(), { wakeLock: { request: async () => { throw Error('NotAllowedError'); } } });
    await Deny.ctx.createGame('q', 'l', 'r'); await sleep(100);
    check('거부되어도 조용히 넘어간다', Deny.shown() === 'board-view' && Deny.T.wake === null);
  }
  await sleep(500);
  check('처리되지 않은 오류 없음', rejections.length === 0, rejections.join(' | '));
  summary();
  setTimeout(() => process.exit(process.exitCode || 0), 50);
})().catch(e => { console.log('시험 중단:', e.stack || e); process.exit(1); });
