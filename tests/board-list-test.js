// 질문판 목록 시험: 목록에서 고치기(보던 판으로 돌아옴), ↑↓ 순서 바꾸기(휴지통 건너뜀), 순서가 표시·종합 보기·저장에 반영되는지.
// 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다(phone-test-harness.js).
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const vm = require('vm');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  await A.ctx.createGame('가젤은 사자를 용서해야 할까?', '용서해야 해', '용서 못 해');
  await until(() => A.T.connected, 8000, '교사 연결');
  const room = A.T.room, code = room.code;
  const add = (q, l, r) => { A.ctx.openSetup('new'); A.$('#in-q').value = q; A.$('#in-l').value = l; A.$('#in-r').value = r; return A.$('#setup-go').onclick(); };
  const b1 = A.T.g;
  await add('사과하면 잘못이 없어질까?', '없어져', '안 없어져'); const b2 = A.T.g;
  await add('힘이 세면 마음대로 해도 될까?', '돼', '안 돼'); const b3 = A.T.g;
  const order = () => A.ctx.keptBoards(room).map(b => b.id).join(',');
  const ids = (...bs) => bs.map(b => b.id).join(',');
  const cfgs = () => bus.sent.filter(m => m.event === 'config' && m.topic.endsWith('-all')).length; // 모든 학생에게 가는 설정만 센다(학생 한 명의 인사에 답하는 개인 설정은 뺀다)

  const S1 = makePage(bus, { search: '?c=' + code }); S1.ctx.joinGame(code, '1번');
  await until(() => S1.S.cfg && S1.shown() === 'student-view', 5000, '학생 입장');
  S1.$('#s-text').value = '사과했으니까 한 번은 봐줘야 해요'; S1.$('#s-str').value = 4; S1.ctx.setSide('L'); S1.ctx.submitComposer();
  await until(() => b1.cards.length === 1, 5000, '카드 도착');

  console.log('B1. 목록 줄');
  A.ctx.viewBoard(b1.id);
  let rows = A.ctx.boardRows(room);
  check('줄마다 ↑ ↓ 고치기 삭제 단추가 있다', ['data-move="' + b2.id + '" data-dir="-1"', 'data-move="' + b2.id + '" data-dir="1"', 'data-edit="' + b2.id + '"', 'data-trash="' + b2.id + '"'].every(s => rows.includes(s)));
  check('맨 위 판의 ↑, 맨 아래 판의 ↓는 꺼져 있다', rows.includes('data-move="' + b1.id + '" data-dir="-1" aria-label="1번 질문판을 위로" title="위로" disabled') && rows.includes('data-move="' + b3.id + '" data-dir="1" aria-label="3번 질문판을 아래로" title="아래로" disabled') && !rows.includes('data-move="' + b2.id + '" data-dir="-1" aria-label="2번 질문판을 위로" title="위로" disabled'));
  check('진행 중인 판도 고치기는 누를 수 있다(삭제만 막음)', /data-edit="[^"]+"[^>]*>고치기/.test(rows) && !/data-edit="[^"]+"[^>]*disabled/.test(rows) && rows.includes('data-trash="' + b1.id + '" disabled'));

  check('줄 HTML의 속성 따옴표가 어긋나지 않는다(질문을 눌러 열 수 있다)', !/=""[^ >]/.test(rows) && rows.includes('<button data-board="' + b2.id + '">2. '), rows.slice(0, 120));
  console.log('B2. 순서 바꾸기');
  check('처음 순서는 만든 순서', order() === ids(b1, b2, b3));
  check('맨 위를 더 위로, 맨 아래를 더 아래로는 바뀌지 않는다', A.ctx.moveQuestion(room, b1.id, -1) === false && A.ctx.moveQuestion(room, b3.id, 1) === false && order() === ids(b1, b2, b3));
  check('없는 판은 바뀌지 않는다', A.ctx.moveQuestion(room, 'nope', 1) === false && order() === ids(b1, b2, b3));
  await sleep(350); const n0 = cfgs(); // 카드 도착 뒤 늦게 나가는 판 공유 전송이 끝난 다음부터 센다
  check('3번째를 위로 올리면 2번째와 자리를 바꾼다', A.ctx.moveQuestion(room, b3.id, -1) === true && order() === ids(b1, b3, b2));
  A.ctx.saveGame(); A.ctx.renderBoard();
  rows = A.ctx.boardRows(room);
  check('목록 번호가 새 순서를 따른다', rows.indexOf('1. 가젤은') < rows.indexOf('2. 힘이 세면') && rows.indexOf('2. 힘이 세면') < rows.indexOf('3. 사과하면'), rows.replace(/<[^>]+>/g, ' ').slice(0, 120));
  const sum = A.ctx.summaryHTML(room);
  check('종합 보기 순서도 함께 바뀐다', sum.indexOf('힘이 세면') > 0 && sum.indexOf('힘이 세면') < sum.indexOf('사과하면 잘못이'));
  A.ctx.viewBoard(b2.id);
  check('판 위의 「n번째 질문판」 표시도 바뀐다', require('fs').readFileSync('index.html', 'utf8').includes("(kept.indexOf(g)+1)+'번째 질문판'") && A.ctx.keptBoards(room).indexOf(b2) === 2);
  check('순서를 바꿔도 진행 중인 판과 카드는 그대로', room.activeBoardId === b1.id && b1.cards.length === 1 && b1.cards[0].boardId === b1.id);
  await sleep(350);
  check('순서만 바꾼 것으로는 학생에게 설정을 다시 보내지 않는다', cfgs() === n0 && S1.S.cfg.question === '가젤은 사자를 용서해야 할까?');

  console.log('B3. 휴지통에 있는 판은 건너뛴다');
  A.ctx.trashQuestion(room, b3.id); // 배열: b1, b3(휴지통), b2
  check('보이는 판만 센다', order() === ids(b1, b2));
  check('휴지통 판을 사이에 두고도 이웃과 맞바꾼다', A.ctx.moveQuestion(room, b2.id, -1) === true && order() === ids(b2, b1));
  check('휴지통 판은 옮길 수 없다', A.ctx.moveQuestion(room, b3.id, -1) === false);
  A.ctx.restoreQuestion(room, b3.id);
  check('복원하면 세 판이 모두 한 번씩 남아 있다', A.ctx.keptBoards(room).length === 3 && new Set(room.boards.map(b => b.id)).size === 3, order());
  A.ctx.moveQuestion(room, b1.id, -1); A.ctx.moveQuestion(room, b1.id, -1); A.ctx.saveGame();
  check('다시 맨 위로 올릴 수 있다', A.ctx.keptBoards(room)[0].id === b1.id, order());

  console.log('B4. 저장·불러오기');
  const ok = vm.runInContext('(() => { try { const r = validateBackup(JSON.parse(JSON.stringify(backupObject(T.room)))); return r.boards.map(b => b.id).join(","); } catch (e) { return "ERR " + e.message; } })()', A.ctx);
  check('순서를 바꾼 수업도 JSON 검증을 통과하고 순서가 보존된다', ok === room.boards.map(b => b.id).join(','), ok);
  const stored = vm.runInContext('LS.get(roomKey(T.room.storageId)).boards.map(b => b.id).join(",")', A.ctx);
  check('브라우저 저장에도 새 순서가 남는다', stored === room.boards.map(b => b.id).join(','), stored);

  console.log('B5. 목록에서 고치기');
  A.ctx.viewBoard(b1.id);
  const other = A.ctx.keptBoards(room).find(b => b.id !== b1.id);
  A.ctx.editFromList(other.id);
  check('고치는 화면이 뜨고 그 판의 질문·양쪽 끝이 채워진다', A.shown() === 'setup-view' && A.$('#in-q').value === other.question && A.$('#in-l').value === other.left && A.$('#in-r').value === other.right && A.$('#setup-title').textContent === '질문·양 끝 이름 고치기', A.shown());
  const cardsBefore = other.cards.length;
  A.$('#in-q').value = other.question.replace('?', '') + ' 정말?'; A.$('#in-l').value = '그렇다'; A.$('#in-r').value = '아니다';
  await A.$('#setup-go').onclick(); await sleep(60);
  check('고친 내용이 그 판에 들어간다', other.question.endsWith('정말?') && other.left === '그렇다' && other.right === '아니다' && other.cards.length === cardsBefore);
  check('고친 뒤에는 보던 판(진행 중인 판)으로 돌아온다', A.shown() === 'board-view' && A.T.viewedBoardId === b1.id && A.T.g === b1);
  check('진행 중이 아닌 판을 고쳐도 학생 질문은 그대로', S1.S.cfg.question === '가젤은 사자를 용서해야 할까?' && room.activeBoardId === b1.id);
  A.ctx.editFromList(other.id); A.$('#in-q').value = '버릴 글';
  A.$('#setup-cancel').onclick();
  check('취소하면 바뀌지 않고 보던 판으로 돌아온다', other.question.endsWith('정말?') && A.shown() === 'board-view' && A.T.viewedBoardId === b1.id);

  console.log('B6. 진행 중인 판을 목록에서 고치기');
  A.ctx.viewBoard(other.id);
  A.ctx.editFromList(b1.id);
  A.$('#in-q').value = '가젤은 사자를 용서해야 할까요?';
  await A.$('#setup-go').onclick();
  await until(() => S1.S.cfg.question === '가젤은 사자를 용서해야 할까요?', 5000, '고친 질문 수신');
  check('진행 중인 판을 고치면 학생 화면에 반영된다', S1.S.cfg.question === '가젤은 사자를 용서해야 할까요?');
  check('이때도 보던 판(다른 판)으로 돌아온다', A.T.viewedBoardId === other.id && A.shown() === 'board-view');
  check('학생이 보낸 카드는 그대로 남는다', b1.cards.length === 1 && b1.cards[0].text === '사과했으니까 한 번은 봐줘야 해요');

  console.log('B7. 예전 길(⋯ → 고치기)은 그대로');
  A.ctx.viewBoard(b1.id); A.ctx.openSetup(true);
  A.$('#in-l').value = '용서해';
  await A.$('#setup-go').onclick();
  check('판 관리에서 고치면 그 판에 머문다', b1.left === '용서해' && A.T.viewedBoardId === b1.id && A.shown() === 'board-view');
  A.ctx.editFromList('nope');
  check('없는 판을 고치려 하면 아무 일도 없다', A.shown() === 'board-view' && A.T.viewedBoardId === b1.id);

  console.log('B8. 목록 줄에 양쪽 끝 이름');
  rows = A.ctx.boardRows(room);
  check('줄마다 왼쪽·오른쪽 끝 이름이 보인다', rows.includes('<span class="bl-l">◀ 용서해</span> · <span class="bl-r">용서 못 해 ▶</span>') && rows.includes('<span class="bl-l">◀ 그렇다</span> · <span class="bl-r">아니다 ▶</span>'), rows.replace(/<[^>]+>/g, ' ').slice(0, 160));
  check('고치기 단추에 무엇을 고치는지 설명이 붙는다', rows.includes('title="질문·양쪽 끝 이름 고치기"') && rows.includes('번 질문판의 질문·양쪽 끝 이름 고치기"'));
  { const saved = [other.left, other.right]; other.left = '<b>왼&'; other.right = '"오른"';
    const r2 = A.ctx.boardRows(room);
    check('끝 이름의 꺾쇠·따옴표는 글자로만 보인다', r2.includes('◀ &lt;b&gt;왼&amp;') && !r2.includes('<b>왼') && !r2.includes('"오른" ▶'), r2.match(/bl-l">[^<]*/g).join('|'));
    [other.left, other.right] = saved; }

  console.log('B9. 끝 이름 안전장치');
  const E = A.ctx.endsIssue;
  const withCards = { left: '찬성', right: '반대', cards: [{}, {}] }, noCards = { left: '찬성', right: '반대', cards: [] };
  check('양쪽이 같은 이름이면 막는다(새 판도)', E(null, '같아', '같아').includes('같아요') && E(noCards, '찬성', '찬성').includes('같아요'));
  check('카드가 있는 판에서 좌우를 맞바꾸면 막고 장수를 알린다', E(withCards, '반대', '찬성').includes('카드 2장') && E(withCards, '반대', '찬성').includes('맞바꿀 수 없어요'));
  check('한쪽만 반대편 이름으로 바꿔도 막는다', !!E(withCards, '반대', '아니야') && !!E(withCards, '그래', '찬성'));
  check('오탈자 고치기·그대로 두기는 통과', E(withCards, '찬성!', '반대') === '' && E(withCards, '찬성', '반대') === '' && E(withCards, '좋아', '싫어') === '');
  check('카드가 없는 판은 맞바꿔도 된다', E(noCards, '반대', '찬성') === '' && E(null, '반대', '찬성') === '');
  check('예전 수업에 양쪽 이름이 같은 판이 있어도 고쳐 나올 수 있다', E({ left: '같음', right: '같음', cards: [{}] }, '같음', '다름') === '' && E({ left: '같음', right: '같음', cards: [{}] }, '다름', '같음') === '');

  await until(() => S1.S.cfg.left === b1.left, 5000, '앞에서 고친 끝 이름 수신'); await sleep(350); // 앞 묶음의 설정 전송이 끝난 뒤부터 센다
  A.ctx.viewBoard(other.id); A.ctx.editFromList(b1.id);
  check('카드가 놓인 판을 고칠 때는 장수와 함께 알린다', !A.$('#setup-warn').classList.contains('hide') && A.$('#setup-warn').textContent.includes('카드 1장') && A.$('#setup-warn').textContent.includes('오탈자만'), A.$('#setup-warn').textContent);
  const before = [b1.question, b1.left, b1.right].join('|'), n9 = cfgs();
  A.$('#in-l').value = b1.right; A.$('#in-r').value = b1.left;
  await A.$('#setup-go').onclick(); await sleep(60);
  check('좌우를 맞바꿔 저장하려 하면 바뀌지 않고 고치는 화면에 남는다', [b1.question, b1.left, b1.right].join('|') === before && A.shown() === 'setup-view');
  A.$('#in-l').value = '똑같아'; A.$('#in-r').value = ' 똑같아 ';
  await A.$('#setup-go').onclick(); await sleep(60);
  check('같은 이름(앞뒤 빈칸만 다른 것 포함)도 저장되지 않는다', [b1.question, b1.left, b1.right].join('|') === before && A.shown() === 'setup-view');
  check('막힌 저장은 학생에게 가지 않는다', cfgs() === n9 && S1.S.cfg.left === b1.left && S1.S.cfg.right === b1.right);
  check('학생의 「보냈어요」 쪽 이름이 뒤집히지 않았다', S1.$('#s-sent-text').textContent.includes(b1.left + ' 쪽'), S1.$('#s-sent-text').textContent);
  A.$('#in-l').value = '용서해야 해'; A.$('#in-r').value = '용서 못 해';
  await A.$('#setup-go').onclick();
  await until(() => S1.S.cfg.left === '용서해야 해', 5000, '고친 끝 이름 수신');
  check('오탈자 고치기는 저장되고 보던 판으로 돌아온다', b1.left === '용서해야 해' && A.shown() === 'board-view' && A.T.viewedBoardId === other.id);

  const empty = A.ctx.keptBoards(room).find(b => !b.cards.length);
  A.ctx.editFromList(empty.id);
  check('카드가 없는 판에서는 알림이 뜨지 않는다', A.$('#setup-warn').classList.contains('hide') && A.$('#setup-warn').textContent === '');
  const [el, er] = [empty.left, empty.right]; A.$('#in-l').value = er; A.$('#in-r').value = el;
  await A.$('#setup-go').onclick();
  check('카드가 없는 판은 좌우를 맞바꿔 저장할 수 있다', empty.left === er && empty.right === el && A.shown() === 'board-view');
  A.ctx.editFromList(b1.id); A.ctx.openSetup('new');
  check('새 질문판을 만들 때는 알림이 뜨지 않는다', A.$('#setup-warn').classList.contains('hide'));
  const nb = A.ctx.keptBoards(room).length; A.$('#in-q').value = '새 질문'; A.$('#in-l').value = '같음'; A.$('#in-r').value = '같음';
  await A.$('#setup-go').onclick();
  check('새 질문판도 양쪽 이름이 같으면 만들어지지 않는다', A.ctx.keptBoards(room).length === nb && A.shown() === 'setup-view');
  A.$('#setup-cancel').onclick();
  const ok2 = vm.runInContext('(() => { try { validateBackup(JSON.parse(JSON.stringify(backupObject(T.room)))); return "ok"; } catch (e) { return "ERR " + e.message; } })()', A.ctx);
  check('고친 뒤에도 JSON 검증을 통과한다', ok2 === 'ok', ok2);

  console.log('B10. 열람 중 돌아가기 · 이 질문 시작');
  const src = require('fs').readFileSync('index.html', 'utf8');
  A.ctx.viewBoard(b1.id);
  check('진행 중인 판을 볼 때는 돌아가기 단추가 숨는다', A.$('#t-current').classList.contains('hide') && A.$('#t-activate').textContent === '진행 중인 질문');
  A.ctx.viewBoard(other.id);
  check('다른 판을 열어 보면 돌아가기 단추가 나타난다', !A.$('#t-current').classList.contains('hide') && A.$('#t-activate').textContent === '이 질문 시작');
  check('도구 줄에 돌아가기 단추가 「이 질문 시작」 앞에 있고 둘 사이를 띄운다', src.includes('<button id="t-boards">질문판 목록</button><button id="t-current" class="hide"') && src.includes('aria-label="진행 중인 질문으로 돌아가기">↩ <span class="tc-long">진행 중인 질문으로 </span>돌아가기</button><button id="t-activate">') && src.includes('#t-current:not(.hide)+#t-activate{margin-left:18px}'));
  await sleep(350); const n10 = cfgs(); // 앞 묶음의 설정 전송이 끝난 뒤부터 센다
  A.$('#t-current').onclick(); await sleep(350);
  check('돌아가기를 누르면 진행 중인 판을 본다', A.T.viewedBoardId === b1.id && A.T.g === b1 && A.$('#t-current').classList.contains('hide'));
  check('돌아가기는 학생 화면을 바꾸지 않는다', room.activeBoardId === b1.id && cfgs() === n10 && S1.S.cfg.boardId === b1.id);
  A.$('#t-current').onclick();
  check('진행 중인 판에서 다시 눌러도 아무 일도 없다', A.T.viewedBoardId === b1.id);
  A.width = 360; A.ctx.viewBoard(other.id); A.ctx.moreMenu();
  let menu = A.overlays().at(-1);
  check('휴대폰: 열람 중에는 ⋯ 맨 위에 돌아가기가 있다', menu.innerHTML.includes('data-a="current">↩ 진행 중인 질문으로 돌아가기') && menu.innerHTML.indexOf('data-a="current"') < menu.innerHTML.indexOf('data-a="boards"'));
  menu.remove(); A.ctx.viewBoard(b1.id); A.ctx.moreMenu();
  menu = A.overlays().at(-1);
  check('휴대폰: 진행 중인 판에서는 ⋯에 돌아가기가 없다', !menu.innerHTML.includes('data-a="current"'));
  menu.remove(); A.width = 1024; A.ctx.viewBoard(other.id); A.ctx.moreMenu();
  menu = A.overlays().at(-1);
  check('넓은 화면 ⋯에는 넣지 않는다(도구 줄에 있음)', !menu.innerHTML.includes('data-a="current"'));
  menu.remove();
  const toastText = () => A.toasts.at(-1) || '';
  A.ctx.activateViewed();
  await until(() => S1.S.cfg.boardId === other.id, 5000, '판 전환 수신');
  check('「이 질문 시작」을 누르면 학생 화면이 바뀌고 교사에게 알린다', room.activeBoardId === other.id && toastText() === '학생 화면을 이 질문으로 바꿨어요.', toastText());
  A.ctx.viewBoard(b1.id); A.ctx.activateViewed();
  await until(() => S1.S.cfg.boardId === b1.id, 5000, '되돌림 수신');
  check('되돌리면 학생이 보낸 카드와 요약이 그대로다', b1.cards.length === 1 && S1.$('#s-sent-text').textContent.includes('✓ 보냈어요'));

  console.log('B11. 안내문');
  A.ctx.boardList();
  let list = A.overlays().at(-1);
  check('목록 창 위 안내가 실제 순서대로 풀어 쓴다', list.innerHTML.includes('질문을 누르면 그 판을 열어 볼 수 있어요.') && list.innerHTML.includes('판을 연 뒤 도구 줄의 「이 질문 시작」을 누르세요.') && !list.innerHTML.includes('「이 질문 시작」을 눌러 제시하세요'));
  check('아래 안내는 고치기·순서·휴지통·삭제 조건을 한 번씩 말한다', list.innerHTML.includes('삭제한 판은 휴지통에서 복원할 수 있어요.') && list.innerHTML.includes('진행 중인 판과 하나 남은 판은 삭제할 수 없어요.') && (list.innerHTML.match(/휴지통에서 복원/g) || []).length === 1);
  list.remove();
  check('판이 하나 남았을 때의 이유 문구도 맞춘다', A.ctx.trashReason({ boards: [{ id: 'x' }], activeBoardId: 'y' }, 'x') === '하나 남은 질문판은 삭제할 수 없어요.');
  A.ctx.viewBoard(other.id); A.ctx.openSetup('next');
  check('「새 질문 시작」 화면이 목록 맨 끝에 추가된다는 것과 끝 이름의 출처를 말한다', A.$('#setup-lead').textContent.includes('새 판이 목록 맨 끝에 추가되고') && A.$('#setup-lead').textContent.includes('지금 진행 중인 질문 것을 넣어 두었으니'), A.$('#setup-lead').textContent);
  check('열람 중에 눌러도 끝 이름은 진행 중인 판 것(안내와 같다)', A.$('#in-l').value === b1.left && A.$('#in-r').value === b1.right && b1.id === room.activeBoardId && other.left !== b1.left);
  A.$('#setup-cancel').onclick();

  console.log('B12. 옮긴 줄 강조');
  rows = A.ctx.boardRows(room, other.id);
  check('방금 옮긴 줄에만 강조 표시가 붙는다', (rows.match(/bl-moved/g) || []).length === 1 && new RegExp('class="row bl-row bl-moved"><button data-board="' + other.id + '"').test(rows));
  check('옮긴 것이 없으면 강조가 없다', !A.ctx.boardRows(room).includes('bl-moved') && !A.ctx.boardRows(room, null).includes('bl-moved'));
  A.ctx.boardList({ type: 'click' });
  list = A.overlays().at(-1);
  check('단추의 클릭 이벤트가 넘어와도 강조로 잘못 읽지 않는다', !list.innerHTML.includes('bl-moved') && list.innerHTML.includes('data-board="' + b1.id + '"'));
  list.remove();
  check('강조는 1초, 움직임 줄이기 설정에서는 테두리로', src.includes('.bl-moved{animation:blMoved 1s ease-out}') && src.includes('@keyframes blMoved') && src.includes('@media (prefers-reduced-motion:reduce){.bl-moved{animation:none;outline:'));

  console.log('B13. 보관판 열람 중에는 「응답 잠시 멈추기」가 없다');
  A.ctx.viewBoard(b1.id);
  b1.whatif.push('사자가 다시 커진다면?'); A.ctx.saveGame(); A.ctx.pushConfig(); A.ctx.renderBoard();
  await until(() => S1.ctx.curStage() === 1, 5000, '추가 질문 수신');
  A.ctx.askWhatif();
  let wf = A.overlays().at(-1);
  check('진행 중인 판에서는 「응답 잠시 멈추기」가 있다', wf.innerHTML.includes('data-a="off">응답 잠시 멈추기'));
  wf.remove();
  A.ctx.viewBoard(other.id); A.ctx.activateViewed();
  await until(() => S1.S.cfg.boardId === other.id, 5000, '다른 판 시작');
  A.ctx.viewBoard(b1.id); A.ctx.askWhatif();
  wf = A.overlays().at(-1);
  check('보관판으로 열어 보면 「응답 잠시 멈추기」가 없고 경고가 보인다', !wf.innerHTML.includes('data-a="off"') && wf.innerHTML.includes('지금 보는 질문판은 진행 중이 아니에요'));
  check('보관판의 추가 질문은 그대로 남아 있다', b1.whatif.length === 1 && (b1.whatifArchive || []).length === 0);
  wf.remove();
  A.ctx.activateViewed();
  await until(() => S1.S.cfg.boardId === b1.id && S1.ctx.curStage() === 1, 5000, '되돌아와 추가 질문 계속');
  check('다시 시작하면 추가 질문이 그대로 떠 있다(멈춘 적 없음)', S1.ctx.studentStageOpen());

  check('처리되지 않은 오류가 없다', rejections.length === 0, rejections.map(String).join(' | '));
  summary();
})();
