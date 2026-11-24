// 만약에 질문 고치기 · 빈 회차 지우기(번호 유지) · 진행 중이 아닌 판에서 띄우기 막기
const { makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const vm = require('vm');
(async () => {
  const page = makePage(makeBus());
  const D = page.ctx.TugData;
  console.log('순수 함수');
  check('도우미가 TugData에 있다', ['whatifList', 'latestStage', 'whatifCardCount', 'editWhatif', 'canDeleteWhatif', 'deleteWhatif'].every(k => typeof D[k] === 'function') && D.WF_GONE === '');
  const mk = () => D.boardNew('질문', '왼', '오', '1234');
  const card = (g, id, sid, stage, extra = {}) => { const c = { id, boardId: g.id, sid, name: sid, text: '근거 ' + id, side: 'L', strength: 3, rev: 0, stage, phase: stage, from: null, likes: [], hidden: false, history: [{ side: 'L', strength: 3, text: '근거 ' + id, phase: stage, t: 1000 }], ...extra }; g.cards.push(c); return c; };

  // 실제 사례: 1회차 0장, 2회차 카드 있음, 둘 다 내려감
  let g = mk(); g.whatifArchive = ['잘못 띄운 질문', '둘째 질문'];
  card(g, 'a0', 's1', 0); card(g, 'b0', 's2', 0); card(g, 'a2', 's1', 2); card(g, 'b2', 's2', 2, { hidden: true });
  const shape = mm => JSON.stringify([mm.ls, mm.rows, mm.items, mm.total]);
  const before = shape(D.phoneBoardModel(g, 'all'));
  check('지우기 전: 최신 회차 2, 1회차만 지울 수 있다', D.latestStage(g) === 2 && D.canDeleteWhatif(g, 1) === true && D.canDeleteWhatif(g, 2) === false);
  check('없는 번호·0·소수·문자는 거부', [0, 3, 1.5, '1', -1, NaN].every(k => D.canDeleteWhatif(g, k) === false && D.deleteWhatif(g, k) === false));
  check('앞쪽 빈 1회차를 지운다', D.deleteWhatif(g, 1) === true && JSON.stringify(g.whatifArchive) === '["","둘째 질문"]');
  check('지운 뒤에도 회차 수·카드 회차 번호는 그대로', D.whatifList(g).length === 2 && g.cards.map(c => c.stage).join() === '0,0,2,2' && D.latestStage(g) === 2);
  check('지운 뒤 폰 목록(회차·칸별 장수·순서)이 지우기 전과 같다', shape(D.phoneBoardModel(g, 'all')) === before);
  check('지운 회차는 고르기 목록에서 빠진다(2번만 남아 칩이 안 나온다)', D.phoneBoardModel(g, 'all').stages.map(x => x.k).join() === '2' && !D.phoneBoardHTML(g, D.phoneBoardModel(g, 'all'), new Set()).includes('pb-stages'));
  check('이미 지운 회차는 다시 지우거나 고칠 수 없다', D.deleteWhatif(g, 1) === false && D.editWhatif(g, 1, '되살리기') === false && g.whatifArchive[0] === '');
  check('글 고치기: 앞뒤 공백 정리, 60자까지', D.editWhatif(g, 2, '  고친 둘째 질문  ') === true && g.whatifArchive[1] === '고친 둘째 질문' && D.editWhatif(g, 2, 'ㄱ'.repeat(80)) === true && g.whatifArchive[1].length === 60);
  check('빈 글로는 고칠 수 없다(빈 글은 지운 표식)', D.editWhatif(g, 2, '   ') === false && D.editWhatif(g, 2, '') === false && g.whatifArchive[1].length === 60);

  // 숨긴 카드만 있는 회차
  g = mk(); g.whatifArchive = ['숨긴 카드만']; card(g, 'h1', 's1', 1, { hidden: true });
  check('숨긴 카드만 있는 회차는 지울 수 없다', D.whatifCardCount(g, 1) === 1 && D.canDeleteWhatif(g, 1) === false);

  // 떠 있는 질문
  g = mk(); g.whatifArchive = ['첫째']; g.whatif = ['떠 있는 질문']; card(g, 'x1', 's1', 1);
  check('떠 있는 질문은 카드가 없어도 지울 수 없다', D.canDeleteWhatif(g, 2) === false && D.deleteWhatif(g, 2) === false && g.whatif[0] === '떠 있는 질문');
  check('떠 있는 질문의 글은 고칠 수 있다', D.editWhatif(g, 2, '고친 떠 있는 질문') === true && g.whatif[0] === '고친 떠 있는 질문' && g.whatifArchive[0] === '첫째');
  g.whatifArchive.push(...g.whatif.splice(0));
  check('내린 뒤에는 지울 수 있고, 맨 뒤를 지우면 판의 최신 회차는 앞 회차', D.deleteWhatif(g, 2) === true && D.latestStage(g) === 1 && D.whatifList(g).length === 2);
  let m = D.phoneBoardModel(g, 'all');
  check('폰 목록은 남은 1회차를 보여 준다', m.ls === 1 && m.rows.length === 2 && m.rows[1].total === 1);
  check('카드가 있는 회차는 지울 수 없다', D.deleteWhatif(g, 1) === false);

  // 내리지 않고 또 띄운 경우(g.whatif에 두 개)
  g = mk(); g.whatif = ['먼저 띄움', '지금 떠 있음'];
  check('g.whatif 안의 앞 질문은 지울 수 있고 뒤(떠 있음)는 못 지운다', D.canDeleteWhatif(g, 2) === false && D.deleteWhatif(g, 1) === true && JSON.stringify(g.whatif) === '["","지금 떠 있음"]' && D.latestStage(g) === 2);

  // 전부 지움
  g = mk(); g.whatifArchive = ['하나', '둘']; D.deleteWhatif(g, 1); D.deleteWhatif(g, 2);
  m = D.phoneBoardModel(g, 'whatif');
  check('전부 지우면 최신 회차 0, 처음 생각만', D.latestStage(g) === 0 && m.ls === 0 && m.rows.length === 1 && m.filter === 'all');

  console.log('카드 수락(acceptCard): 번호가 어긋나지 않는다');
  g = mk(); g.whatifArchive = ['빈 1회차', '2회차'];
  const room = { schemaVersion: 4, storageId: 'room1', code: '1234', created: 1000, configSeq: 3, legacyBoardId: g.id, activeBoardId: g.id, boards: [g], offline: false };
  const send = (id, sid, stage, rev, extra = {}) => D.acceptCard(room, { boardId: g.id, id, sid, name: sid, text: '글 ' + id + rev, side: 'R', strength: 2, rev, stage, from: null, ...extra });
  card(g,'p0','s1',0,{text:'글 p00',side:'R',strength:2,history:[{text:'글 p00',side:'R',strength:2,phase:0,t:1000}]}); card(g,'p2','s1',2,{text:'글 p20',side:'R',strength:2,history:[{text:'글 p20',side:'R',strength:2,phase:2,t:1000}]});
  D.deleteWhatif(g, 1);
  let r = send('p2', 's1', 2, 0);
  check('지운 뒤 같은 카드를 다시 보내도(같은 rev) 받아들인다', r && r.card.id === 'p2' && r.changed === false);
  r = send('p2', 's1', 2, 1, { strength: 5 });
  check('완료 회차는 rev+1 수정도 거부하고 원본 보존', r === null && g.cards.find(c => c.id === 'p2').strength === 2 && g.cards.find(c => c.id === 'p2').stage === 2);
  check('아직 없는 3회차 카드는 거부', send('p3', 's1', 3, 0) === null);
  g.whatif.push('새 질문');
  check('새 질문은 3회차가 된다(지운 번호를 다시 쓰지 않는다)', D.whatifList(g).length === 3 && D.latestStage(g) === 3 && send('p3', 's1', 3, 0) !== null);
  r = send('late1', 's9', 1, 0);
  page.T.g = g;
  check('지운 완료 회차로 늦게 온 새 카드는 거부', r === null && !g.cards.some(c=>c.id==='late1'));

  console.log('저장 형식');
  const parseInPage = vm.runInContext('JSON.parse', page.ctx);
  const back = D.backupObject(room);
  let okv = true; try { D.validateBackup(parseInPage(JSON.stringify(back))); } catch (e) { okv = e.message; }
  check('지운 표식이 든 수업도 validateBackup을 통과한다(새 필드 없음, 버전 4)', okv === true && D.ROOM_VERSION === 4, String(okv));
  const again = parseInPage(JSON.stringify(back)).room.boards[0];
  check('저장→불러오기 왕복 뒤에도 표식·번호가 그대로', again.whatifArchive[0] === '' && again.whatifArchive[1] === '2회차' && again.whatif[0] === '새 질문' && again.cards.find(c => c.id === 'p2').stage === 2);

  console.log('흐름: 교사와 학생');
  const bus = makeBus();
  const A = makePage(bus);
  await A.ctx.createGame('가젤은 사자를 용서해야 할까?', '용서해야 해', '용서하지 않아도 돼');
  await until(() => A.T.connected, 3000, 'A 구독');
  const code = A.T.room.code;
  const St = makePage(bus, { search: '?c=' + code });
  St.ctx.joinGame(code, '7번');
  await until(() => St.S.cfg && St.shown() === 'student-view', 5000, '학생 입장');
  const write = (text, side, strength) => { St.$('#s-text').value = text; St.$('#s-str').value = strength; St.ctx.setSide(side); };
  write('처음 근거', 'L', 4); St.ctx.submitComposer();
  await until(() => St.S.me.cards[0]?.ok, 5000, '처음 생각 도착');
  const ask = q => { A.T.g.whatif.push(q); A.ctx.saveGame(); A.ctx.renderBoard(); A.ctx.pushConfig(); };
  ask('잘못 띄운 질문'); await until(() => St.S.cfg.stage === 1, 5000, '1회차 전달');
  A.ctx.hideWhatif(); await until(() => St.S.cfg.stage === 0, 5000, '내림');
  ask('둘째 질문'); await until(() => St.S.cfg.stage === 2 && St.S.cfg.whatif === '둘째 질문', 5000, '2회차 전달');
  A.ctx.deleteWhatif(A.T.g,1);A.ctx.saveGame();A.ctx.pushConfig();await until(()=>St.ctx.curStage()===2,5000,'deleted queue hole skipped');
  St.ctx.keepSame(St.S.me.cards[0].id);
  await until(() => St.S.me.cards[1]?.ok, 5000, '2회차 카드 도착');
  const k2 = St.S.me.cards[1];
  check('학생 2회차 카드가 교사 판에 stage 2로 있다', k2.stage === 2 && A.T.g.cards.find(c => c.id === k2.id)?.stage === 2);
  check('떠 있는 2회차는 못 지우고 빈 1회차는 지운다', D.canDeleteWhatif(A.T.g, 2) === false && A.T.g.whatifArchive[0] === '');
  A.ctx.saveGame(); A.ctx.renderBoard(); A.ctx.pushConfig();
  await sleep(400);
  check('지운 뒤 학생에게 가는 설정: stage 2·질문 글 그대로', A.ctx.cfgPayload().stage === 2 && A.ctx.cfgPayload().whatif === '둘째 질문' && St.S.cfg.stage === 2 && St.S.cfg.whatif === '둘째 질문');
  check('교사 판은 여전히 2회차 카드를 보여 준다', A.ctx.lastStage() === 2 && A.T.g.cards.filter(c => A.ctx.onBoard(c)).length === 2);
  St.ctx.startEdit(k2.id); write('처음 근거', 'R', 5); St.ctx.submitComposer();
  // 쪽만 바꾸고 근거는 그대로면 첫 번째 누름은 묻기만 하고, 한 번 더 누르면 그대로 보낸다
  check('쪽만 바꾸고 근거가 그대로면 한 번 멈춰 묻는다', St.S.me.cards[1].rev === 0 && St.$('#s-send').textContent === '근거 그대로 보내기' && !St.$('#s-flip').classList.contains('hide'));
  St.ctx.submitComposer();
  await until(() => St.S.me.cards[1].ok && St.S.me.cards[1].rev === 1, 5000, '다시 놓은 카드 도착');
  const t2 = A.T.g.cards.find(c => c.id === k2.id);
  check('지운 뒤 학생이 다시 놓아도 거부되지 않는다(쪽·세기 반영, stage 2 유지)', t2.side === 'R' && t2.strength === 5 && t2.stage === 2 && A.T.g.cards.length === 2);
  // 글 고치기: 학생이 쓰던 글은 남고 질문 문구만 바뀐다
  St.ctx.resetForm?.(); St.$('#s-text').value = '쓰는 중인 글';
  const stageBefore = St.S.cfg.stage, cardsBefore = St.S.me.cards.length;
  check('떠 있는 질문 글 고치기', A.ctx.editWhatif(A.T.g, 2, '고친 둘째 질문') === true);
  A.ctx.saveGame(); A.ctx.renderBoard(); A.ctx.pushConfig();
  await until(() => St.S.cfg.whatif === '고친 둘째 질문', 5000, '고친 글 전달');
  check('학생: 회차·내 카드·쓰던 글 그대로', St.S.cfg.stage === stageBefore && St.S.me.cards.length === cardsBefore && St.$('#s-text').value === '쓰는 중인 글');
  // 새 질문은 3회차
  A.ctx.hideWhatif(); await until(() => St.S.cfg.stage === 0, 5000, '내림');
  ask('셋째 질문'); await until(() => St.S.cfg.stage === 3, 5000, '3회차 전달');
  check('지운 번호를 건너 3회차로 간다', JSON.stringify(A.T.g.whatifArchive) === '["","고친 둘째 질문"]' && A.T.g.whatif[0] === '셋째 질문' && A.ctx.cfgPayload().stage === 3);

  console.log('진행 중이 아닌 질문판에서 띄우기 막기');
  const n0 = A.ctx.TugData.whatifList(A.T.g).length, real = A.T.viewedBoardId;
  A.T.viewedBoardId = 'not-active';
  A.ctx.askWhatif(); let ov = A.overlays().at(-1);
  ov.querySelector('#wf-in').value = '보관판에서 띄우는 질문'; ov.querySelector('[data-a=ok]').onclick();
  check('진행 중이 아니면 띄워지지 않고 안내가 뜬다', A.ctx.TugData.whatifList(A.T.g).length === n0 && /진행 중인 질문판이 아니에요/.test(A.toasts.at(-1)) && ov.innerHTML.includes('진행 중이 아니에요') && ov.innerHTML.includes('disabled'));
  ov.remove(); A.T.viewedBoardId = real;
  A.ctx.askWhatif(); ov = A.overlays().at(-1);
  check('진행 중인 판에서는 경고가 없고 목록에 번호 2·3만(지운 1은 안내 한 줄)', !ov.innerHTML.includes('진행 중이 아니에요') && ov.innerHTML.includes('data-k="2"') && ov.innerHTML.includes('data-k="3"') && !ov.innerHTML.includes('data-k="1"') && ov.innerHTML.includes('지운 빈 질문 1개'));
  check('카드가 있는 회차에는 지우기 버튼이 없다', (ov.innerHTML.match(/data-wf="del"/g) || []).length === 0 && ov.innerHTML.includes('카드 1장') && ov.innerHTML.includes('떠 있음'));
  ov.querySelector('#wf-in').value = '넷째 질문'; ov.querySelector('[data-a=ok]').onclick();
  check('진행 중인 판에서는 예전처럼 띄워진다', A.T.g.whatif.at(-1) === '넷째 질문');
  A.T.room.offline = true; A.T.viewedBoardId = 'not-active';
  A.ctx.askWhatif(); ov = A.overlays().at(-1);
  check('보관(오프라인) 수업은 기록용으로 띄울 수 있다', !ov.innerHTML.includes('진행 중이 아니에요'));
  ov.remove(); A.T.room.offline = false; A.T.viewedBoardId = real;

  console.log('회차 고르기(교사 화면 상태)');
  {
    // 지금: 1번 지움, 2번 카드 1장, 3번 카드 0장(내려감), 4번 떠 있음(0장)
    const T = A.T, C = A.ctx, g4 = T.g;
    await until(() => St.S.cfg.stage === 4, 5000, '4회차 전달');
    check('기본은 최신 회차(4번), 보기 상태 없음', C.lastStage() === 4 && C.shownStage() === 4 && !T.view);
    C.setViewStage(2);
    check('2번을 고르면 판·목록이 2번 카드를 보여 준다', C.lastStage() === 2 && T.view.stage === 2 && g4.cards.filter(c => C.onBoard(c)).map(c => c.stage).sort().join() === '0,2' && A.$('#phone-board').innerHTML.includes('지난 만약에 생각 1장') && A.$('#phone-board').innerHTML.includes('최신으로'));
    check('학생에게 가는 설정은 보기와 상관없이 그대로(4번)', C.cfgPayload().stage === 4 && C.cfgPayload().whatif === '넷째 질문');
    const lines2 = C.countLines().join(' / ');
    C.setViewStage(4); const lines4 = C.countLines().join(' / ');
    check('내보내기 요약은 보기와 상관없이 최신 회차 기준', lines2 === lines4);
    C.setViewStage(2);
    check('찬반 수 요약은 보는 회차 기준(2번 참여 1명)', C.changeSummary().sk.n === 1 && C.changeSummary(4).sk.n === 0);
    C.setViewStage(1);
    check('지운 1번은 고를 수 없다(최신으로)', C.lastStage() === 4 && !T.view);
    C.setViewStage(2);
    A.$('#phone-board').fire('click', { target: { closest: sel => (sel === '[data-st]' ? { dataset: { st: '3' } } : null) } });
    check('폰 목록의 칩을 누르면 그 회차로', C.lastStage() === 3 && T.view.stage === 3);
    A.$('#b-stagebar').fire('click', { target: { closest: sel => (sel === '[data-st]' ? { dataset: { st: '2' } } : null) } });
    check('넓은 판의 줄에서도 고를 수 있다', C.lastStage() === 2);
    check('넓은 판 줄: 2·3·4번 칩과 「지난 질문을 보는 중」', ['data-st="2" class="on"', 'data-st="3"', 'data-st="4"', '지난 질문을 보는 중이에요', '최신으로'].every(x => A.$('#b-stagebar').innerHTML.includes(x)) && !A.$('#b-stagebar').innerHTML.includes('data-st="1"') && A.$('#b-stagebar').classList.contains('show'));
    // 지난 회차를 보는 중에 새 카드가 와도 보기는 그대로
    St.ctx.keepSame(St.S.me.cards.find(c=>c.stage===2).id);
    await until(()=>St.ctx.curStage()===4,5000,'3회차 먼저 수락');
    St.ctx.keepSame(St.S.me.cards.find(c=>c.stage===3).id);
    await until(() => St.S.me.cards.some(c => c.stage === 4 && c.ok), 5000, '4회차 카드 도착');
    check('지난 회차를 보는 중 새 카드가 와도 보기는 유지되고 칩의 장수만 늘어난다', C.lastStage() === 2 && /data-st="4"[^>]*>4<small>1장<\/small>/.test(A.$('#b-stagebar').innerHTML));
    // 새 질문을 띄우면 최신으로
    C.hideWhatif(); C.askWhatif(); const o2 = A.overlays().at(-1); o2.querySelector('#wf-in').value = '다섯째 질문'; o2.querySelector('[data-a=ok]').onclick();
    check('새 질문을 띄우면 최신 회차(5번)로 돌아간다', C.lastStage() === 5 && !T.view);
    // 다른 질문판으로 옮기면 최신
    C.setViewStage(2); const keep = T.view;
    const other = D.boardNew('다른 질문', '가', '나', T.room.code); T.room.boards.push(other); C.viewBoard(other.id);
    check('다른 질문판으로 옮기면 그 판의 최신(만약에 없음)', C.lastStage() === 0);
    C.viewBoard(g4.id);
    check('원래 판으로 돌아오면 고른 회차가 남아 있다', C.lastStage() === 2 && T.view === keep);
    C.setViewStage(5); T.room.boards = T.room.boards.filter(b => b !== other);
    { const js = JSON.stringify(A.ctx.TugData.backupObject(T.room)); let vr = true; try { A.ctx.TugData.validateBackup(vm.runInContext('JSON.parse', A.ctx)(js)); } catch (e) { vr = e.message; }
      check('저장되는 수업에 보기 상태가 들어가지 않는다', !js.includes('"view"') && vr === true, String(vr) + ' view:' + js.includes('"view"')); }
  }

  console.log('내보내기 머리줄');
  const csvHead = []; A.ctx.download = (name, blob) => csvHead.push(blob);
  const lines = A.ctx.allWhatifs().map((w, i) => w === '' ? null : `만약에 질문 ${i + 1}`).filter(Boolean);
  check('지운 질문은 빠지고 번호는 유지(2·3·4·5)', lines.join() === '만약에 질문 2,만약에 질문 3,만약에 질문 4,만약에 질문 5');
  A.ctx.leaveTeacher(); await sleep(200);
  process.exit(summary() ? 0 : 1);
})().catch(e => { console.error('시험 오류', e); process.exit(1); });
