// 순수 함수 시험: 폰 목록 모델·줄 표시 규칙·HTML, 코드 겹침 판정, 학생 자동 재전송 판정, 저장 형식.
const { makeBus, makePage, check, summary } = require('./phone-test-harness');

const page = makePage(makeBus());
const D = page.ctx.TugData;

console.log('불러오기');
check('오류 없이 시작 화면이 뜬다', page.shown() === 'home-view');
check('새 순수 함수가 TugData에 있다', ['isPhoneBoard', 'phoneBoardModel', 'phoneRowView', 'phoneBoardHTML', 'codeClashLoser', 'autoResendPlan'].every(k => typeof D[k] === 'function'));
check('ROOM_VERSION은 4 그대로', D.ROOM_VERSION === 4);

console.log('toast');
page.realToast('첫 알림', 60000); page.realToast('둘째 알림', 60000);
{
  const shown = page.body.children.filter(c => c.classList.contains('toast'));
  check('새 알림이 뜨면 앞 알림은 지운다(겹치지 않음)', shown.length === 1 && shown[0].textContent === '둘째 알림');
}

console.log('isPhoneBoard');
page.width = 640; check('640px은 폰', D.isPhoneBoard() === true);
page.width = 641; check('641px은 넓은 화면', D.isPhoneBoard() === false);
page.width = 360; check('360px은 폰', D.isPhoneBoard() === true);
// 가로로 돌린 휴대폰: 폭은 넓지만 높이가 낮고, 기기의 짧은 변이 500px 이하이며 손가락 화면
page.width = 844; page.height = 390; page.screen = { width: 390, height: 844 }; page.coarse = true;
check('844×390 휴대폰 가로는 폰', D.isPhoneBoard() === true && D.isPhoneLandscape() === true);
page.width = 956; page.height = 440; page.screen = { width: 956, height: 440 };
check('956×440(큰 휴대폰 가로)도 폰', D.isPhoneBoard() === true);
page.coarse = false; check('마우스 화면은 낮은 창이어도 넓은 화면', D.isPhoneBoard() === false);
page.coarse = true; page.width = 960; page.height = 470; page.screen = { width: 960, height: 540 };
check('전자칠판(짧은 변 540px)은 확대해도 넓은 화면', D.isPhoneBoard() === false);
page.width = 1024; page.height = 480; page.screen = { width: 1024, height: 768 };
check('자판이 뜬 태블릿은 넓은 화면', D.isPhoneBoard() === false);
page.width = 844; page.height = 700; page.screen = { width: 390, height: 844 };
check('높이가 500px을 넘으면 넓은 화면', D.isPhoneBoard() === false);
page.width = 390; page.height = 844; check('세로 휴대폰은 가로 판정이 아니다', D.isPhoneBoard() === true && D.isPhoneLandscape() === false);
page.height = undefined; page.screen = undefined; page.coarse = false;

console.log('codeClashLoser');
check('나중에 만든 쪽이 바꾼다', D.codeClashLoser({ roomId: 'a', created: 200 }, { roomId: 'b', created: 100 }) === true);
check('먼저 만든 쪽은 그대로', D.codeClashLoser({ roomId: 'b', created: 100 }, { roomId: 'a', created: 200 }) === false);
check('같은 시각이면 roomId가 큰 쪽', D.codeClashLoser({ roomId: 'b', created: 5 }, { roomId: 'a', created: 5 }) === true && D.codeClashLoser({ roomId: 'a', created: 5 }, { roomId: 'b', created: 5 }) === false);
check('양쪽 판정이 항상 반대(한쪽만 바꾼다)', [[1, 2, 'x', 'y'], [2, 1, 'x', 'y'], [3, 3, 'x', 'y'], [3, 3, 'y', 'x']].every(([a, b, ia, ib]) =>
  D.codeClashLoser({ roomId: ia, created: a }, { roomId: ib, created: b }) !== D.codeClashLoser({ roomId: ib, created: b }, { roomId: ia, created: a })));
check('상대가 만든 시각을 안 알려 주면(예전 버전) 내가 바꾼다', D.codeClashLoser({ roomId: 'a', created: 100 }, { roomId: 'z' }) === true);

console.log('autoResendPlan');
check('보내는 중이면 건너뜀(config가 아닐 때)', D.autoResendPlan({ state: 'sending' }, true, false) === 'skip');
check('보내는 중 + config면 시도 횟수만 되돌림(extend), 되살리기 3회를 다 써도 같다', D.autoResendPlan({ state: 'sending' }, true, true) === 'extend' && D.autoResendPlan({ state: 'sending', revives: 3 }, true, true) === 'extend');
check('실패가 아니면 그냥 보냄', D.autoResendPlan({ state: 'sending' }, false, false) === 'send' && D.autoResendPlan(undefined, false, false) === 'send');
check('실패 카드는 config 때만 되살림', D.autoResendPlan({ state: 'failed' }, false, false) === 'skip' && D.autoResendPlan({ state: 'failed' }, false, true) === 'revive');
check('되살리기는 3회까지', D.autoResendPlan({ state: 'failed', revives: 2 }, false, true) === 'revive' && D.autoResendPlan({ state: 'failed', revives: 3 }, false, true) === 'skip');
check('MAX_AUTO_REVIVES = 3', D.MAX_AUTO_REVIVES === 3);
check('복귀 처리 지연 0~2초 · 최소 간격 5초', D.RETURN_JITTER_MS === 2000 && D.RETURN_GAP_MS === 5000);

console.log('phoneBoardModel');
const g = D.boardNew('질문 <b>?', '왼쪽&', '오른쪽"', '1234');
let t = 1000;
const card = (id, sid, name, side, strength, text, stage = 0, from = null, extra = {}) => {
  const c = { id, boardId: g.id, sid, name, text, side, strength, rev: 0, phase: stage, stage, from, likes: [], hidden: false, history: [{ side, strength, text, phase: stage, t: t++ }], ...extra };
  g.cards.push(c); return c;
};
card('c1', 's1', '1번', 'R', 2, '근거 하나');
card('c2', 's2', '2번', 'L', 5, '<img src=x onerror=alert(1)>');
card('c3', 's3', '', 'L', 1, '근거 셋');
card('c4', 's4', '4번', 'L', 5, '근거 넷');
card('c5', 's5', '5번', 'R', 5, '숨긴 카드', 0, null, { hidden: true });
let m = D.phoneBoardModel(g, 'whatif');
check('만약에 단계가 없으면 한 줄·필터 없음', m.rows.length === 1 && m.filter === 'all' && m.ls === 0);
check('칸별 장수(L5=2, L1=1, R2=1), 숨긴 카드 제외', JSON.stringify(m.rows[0].counts) === '[2,0,0,0,1,0,1,0,0,0]' && m.total === 4);
check('정렬: 밧줄 왼쪽→오른쪽, 같은 칸은 도착 순', m.items.map(c => c.id).join() === 'c2,c4,c3,c1');

g.whatif.push('만약에 <i>?');
card('w1', 's1', '1번', 'L', 3, '근거 하나', 1, 'c1');          // 쪽 바뀜
card('w2', 's2', '2번', 'L', 5, '<img src=x onerror=alert(1)>', 1, 'c2'); // 그대로
card('w3', 's4', '4번', 'L', 2, '근거 넷', 1, 'c4');           // 세기 바뀜
card('w4', 's6', '6번', 'R', 1, '새로 쓴 근거', 1, null);       // 새 근거
m = D.phoneBoardModel(g, 'all');
check('만약에가 있으면 두 줄(처음·만약에)', m.rows.map(r => r.key).join() === 'first,whatif' && m.rows[1].total === 4);
check('만약에 줄 칸별 장수', JSON.stringify(m.rows[1].counts) === '[1,0,1,1,0,1,0,0,0,0]');
check('정렬: 만약에 먼저 → 쪽 바뀜·세기 바뀜·새 근거·그대로 → 밧줄 순', m.items.map(c => c.id).join() === 'w1,w3,w4,w2,c2,c4,c3,c1');
check('필터 처음 생각', D.phoneBoardModel(g, 'first').items.map(c => c.id).join() === 'c2,c4,c3,c1');
check('필터 만약에 생각', D.phoneBoardModel(g, 'whatif').items.map(c => c.id).join() === 'w1,w3,w4,w2');
check('모르는 필터 값은 전체', D.phoneBoardModel(g, '__proto__').filter === 'all');
// onBoard와 같은 카드 집합인지(교사 상태에 판을 걸어 비교)
page.T.g = g;
check('보이는 카드가 onBoard와 같다', g.cards.filter(c => page.ctx.onBoard(c)).map(c => c.id).sort().join() === m.items.map(c => c.id).sort().join());
// 앞선 만약에 단계는 판에서 빠진다
g.whatifArchive.push(...g.whatif.splice(0)); g.whatif.push('두 번째 만약에');
m = D.phoneBoardModel(g, 'all');
check('새 만약에를 띄우면 앞선 만약에 카드는 목록에서 빠진다', m.ls === 2 && m.items.every(c => c.stage === 0) && m.rows[1].total === 0);
{ const hh = D.phoneBoardHTML(g, m, new Set());
  check('만약에 질문이 둘이면 회차 고르기 칩이 나오고(1번 4장, 2번이 켜짐) 옛 안내 문구는 없다', hh.includes('pb-stages') && /data-st="1" class=""[^>]*>1<small>4장<\/small>/.test(hh) && /data-st="2" class="on"/.test(hh) && !hh.includes('내보내기에 남아 있어요') && !hh.includes('최신으로'));
  const m1 = D.phoneBoardModel(g, 'all', 1), h1 = D.phoneBoardHTML(g, m1, new Set());
  check('1번을 고르면 그 회차 카드가 목록에 나오고 「지난 만약에 생각」·「최신으로」가 보인다', m1.ls === 1 && m1.latest === 2 && m1.rows[1].total === 4 && m1.items.filter(c => c.stage === 1).length === 4 && h1.includes('지난 만약에 생각 4장') && h1.includes('최신으로') && /data-st="1" class="on"/.test(h1));
  check('없는 회차·0·문자를 주면 최신 회차', [0, 9, '1', null, undefined, 1.5].every(k => D.phoneBoardModel(g, 'all', k).ls === 2));
  check('회차 인자를 생략한 결과와 최신 회차를 준 결과가 같다', JSON.stringify(D.phoneBoardModel(g, 'all')) === JSON.stringify(D.phoneBoardModel(g, 'all', 2)));
}
g.whatif.pop(); g.whatif.push(...g.whatifArchive.splice(0)); // 되돌림(ls = 1)

console.log('phoneRowView · 이름/근거 글 규칙');
const byId = id => g.cards.find(c => c.id === id);
g.share = false; g.showNames = false;
let v = D.phoneRowView(g, byId('c3'), false);
check('공유 꺼짐: 이름 없는 카드는 익명, 글은 접힘', v.who === '익명' && v.showText === false);
check('공유 꺼짐: 이름 보이기와 무관하게 쓴 사람이 보인다', D.phoneRowView(g, byId('c1'), false).who === '1번');
check('공유 꺼짐: 펼친 줄만 글이 보인다', D.phoneRowView(g, byId('c1'), true).showText === true);
g.share = true;
check('공유 켜짐: 글이 보이고 이름은 숨김', (v = D.phoneRowView(g, byId('c1'), false)).showText === true && v.who === '');
g.showNames = true;
check('공유 켜짐 + 이름 보이기: 이름 표시', D.phoneRowView(g, byId('c1'), false).who === '1번' && D.phoneRowView(g, byId('c3'), false).who === '');
check('위치 글 "○○ 쪽 · 세기 n"', D.phoneRowView(g, byId('c1'), false).pos === '오른쪽" 쪽 · 세기 2');
check('쪽 바뀜 + 이전 위치', (v = D.phoneRowView(g, byId('w1'), false)).chg === '쪽 바뀜' && v.prev === '처음: 오른쪽" 2');
check('그대로는 이전 위치 글 없음', (v = D.phoneRowView(g, byId('w2'), false)).chg === '그대로' && v.prev === '');
check('세기 바뀜 + 이전 위치', (v = D.phoneRowView(g, byId('w3'), false)).chg === '세기 바뀜' && v.prev === '처음: 왼쪽& 5');
check('새 근거', D.phoneRowView(g, byId('w4'), false).chg === '새 근거');
// 다시 놓음 / 원래 자리로 / 근거 수정 / 공감 / 묶음
const c1 = byId('c1');
c1.history.push({ side: 'R', strength: 4, text: c1.text, phase: 0, t: t++ }); c1.strength = 4;
check('다시 놓음', (v = D.phoneRowView(g, c1, false)).moved === '다시 놓음' && v.firstSent === '오른쪽" 2');
c1.history.push({ side: 'R', strength: 2, text: c1.text, phase: 0, t: t++ }); c1.strength = 2;
check('원래 자리로 돌아옴', D.phoneRowView(g, c1, false).moved === '원래 자리로 돌아옴');
const c3 = byId('c3');
c3.history.push({ side: 'L', strength: 1, text: '고친 근거', phase: 0, t: t++ }); c3.text = '고친 근거';
check('근거 수정', (v = D.phoneRowView(g, c3, false)).edited === true && v.moved === '');
c3.likes.push('s1', 's2'); g.groups.g1 = { label: '<묶음>', color: '#7c3aed' }; c3.group = 'g1';
check('공감 수·묶음 이름표', (v = D.phoneRowView(g, c3, false)).likes === 2 && v.group.label === '<묶음>');

console.log('phoneBoardHTML');
g.share = false; g.showNames = false;
m = D.phoneBoardModel(g, 'all');
let h = D.phoneBoardHTML(g, m, new Set(['c1']));
check('사용자 글은 esc()를 거친다', !h.includes('<img') && !h.includes('<b>?') && h.includes('왼쪽&amp;') && h.includes('오른쪽&quot;') && h.includes('&lt;묶음&gt;') && h.includes('만약에 &lt;i&gt;?'));
check('공유 꺼짐: 접힌 줄의 근거 글은 HTML에 아예 없다', !h.includes('근거 넷') && !h.includes('새로 쓴 근거') && !h.includes('고친 근거'));
check('공유 꺼짐: 펼친 줄(c1)만 글과 숨기기 버튼', h.includes('근거 하나') && (h.match(/data-hide=/g) || []).length === 1 && h.includes('data-hide="c1"'));
check('필터 버튼 3개와 단계 구분 제목', (h.match(/data-pf=/g) || []).length === 3 && h.includes('<li class="pb-sec">만약에 생각 <span>· 쪽 바뀜 → 세기 바뀜 → 새 근거 → 그대로 순</span></li>') && h.includes('<li class="pb-sec">처음 생각</li>'));
check('요약 밧줄 두 줄 + 눈금 말', (h.match(/class="pb-cells"/g) || []).length === 2 && h.includes('아주 세게') && h.includes('보통') && h.includes('살짝'));
check('0은 흐리게(zero)', /pb-cell [LR] zero/.test(h));
check('배지: 쪽 바뀜·세기 바뀜·그대로·새 근거·이전 위치·다시 놓음·수정·공감·묶음',
  ['c-side">쪽 바뀜', 'c-str">세기 바뀜', 'c-same">그대로', 'c-new">새 근거', '처음: 왼쪽&amp; 5', '↔ 원래 자리로 돌아옴', '✎ 근거 수정', '♥2', 'c-grp'].every(s => h.includes(s)));
check('다시 놓은 줄은 보라 보조 띠(moved)', /class="pb-item R moved past open" data-id="c1"/.test(h));
g.share = true;
h = D.phoneBoardHTML(g, D.phoneBoardModel(g, 'all'), new Set());
check('공유 켜짐: 근거 글이 모두 보이고 숨기기 버튼은 펼친 줄에만', h.includes('근거 넷') && h.includes('새로 쓴 근거') && !h.includes('data-hide='));
check('공유 켜짐 + 이름 숨김: 이름이 없다', !h.includes('pb-who'));
const empty = D.boardNew('q', 'l', 'r', '1234');
h = D.phoneBoardHTML(empty, D.phoneBoardModel(empty, 'all'), new Set());
check('카드가 없으면 기존 안내 문구', h.includes('학생들이 근거를 보내면 여기에 카드가 놓여요.') && h.includes('접속 코드') && !h.includes('pb-list'));
check('만약에가 없으면 한 줄·필터 없음', (h.match(/class="pb-cells"/g) || []).length === 1 && !h.includes('data-pf='));

console.log('저장 형식');
const room = { schemaVersion: 4, storageId: 'room1', code: '1234', created: 1000, configSeq: 3, legacyBoardId: g.id, activeBoardId: g.id, boards: [g], offline: false };
g.created = 900;
// 검증은 페이지 안에서 만든 객체만 받는다(브라우저의 JSON.parse와 같게, 페이지 쪽 JSON으로 읽는다)
const parseInPage = require('vm').runInContext('JSON.parse', page.ctx);
let okBackup = true, err = '';
try { D.validateBackup(parseInPage(JSON.stringify(D.backupObject(room)))); } catch (e) { okBackup = false; err = e.message; }
check('validateBackup이 이 수업을 그대로 받아들인다(새 저장 필드 없음)', okBackup, err);
let rejected = false;
try { const b = parseInPage(JSON.stringify(D.backupObject(room))); b.room.probeCode = '1234'; D.validateBackup(b); } catch (e) { rejected = /허용되지 않은 필드 probeCode/.test(e.message); }
check('허용되지 않은 필드는 여전히 거부', rejected);

summary();
