// 접속 코드 시험: 무작위 5자리 + 검사 숫자 1자리. 오타가 다른 수업의 코드가 되지 않는지, 예전 4자리 수업이 그대로 열리는지,
// 입장 칸·주소·JSON 저장이 새 코드를 받는지 본다. 가짜 화면과 가짜 실시간 통신 위에서 실제 index.html 스크립트를 돌린다.
const { rejections, makeBus, makePage, sleep, until, check, summary } = require('./phone-test-harness');
const vm = require('vm');

(async () => {
  const bus = makeBus();
  const A = makePage(bus, { width: 1024 });
  const { codeCheck, makeCode, validCode, fmtCode } = A.ctx;

  console.log('K1. 검사 숫자');
  check('알려진 예: 572의 검사 숫자는 4', codeCheck('572') === '4' && codeCheck('5724') === '0');
  let made = true; const seen = new Set();
  for (let i = 0; i < 3000; i++) { const c = makeCode(); seen.add(c); if (!/^[1-9]\d{5}$/.test(c) || !validCode(c)) made = false; }
  check('새 코드는 0으로 시작하지 않는 6자리이고 모두 검사를 통과한다', made && seen.size > 2900, String(seen.size));
  // 모든 코드(90,000개)에 대해: 숫자 하나를 바꾸거나 이웃한 두 숫자를 맞바꾼 것이 다른 유효한 코드가 되는 경우가 하나도 없어야 한다
  let single = 0, swap = 0, total = 0;
  for (let b = 10000; b <= 99999; b++) {
    const base = String(b), code = base + codeCheck(base); total++;
    for (let i = 0; i < 6; i++) for (let d = 0; d < 10; d++) { if (String(d) === code[i]) continue; if (codeCheck(code.slice(0, i) + d + code.slice(i + 1)) === '0') single++; }
    for (let i = 0; i < 5; i++) { if (code[i] === code[i + 1]) continue; if (codeCheck(code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2)) === '0') swap++; }
  }
  check('숫자 하나를 잘못 누른 코드는 어느 수업의 코드도 아니다(90,000개 전부 확인)', total === 90000 && single === 0, 'single=' + single);
  check('이웃한 두 숫자를 바꿔 누른 코드도 어느 수업의 코드도 아니다', swap === 0, 'swap=' + swap);

  console.log('K2. 받는 형식');
  const good = makeCode();
  check('6자리 유효 코드와 예전 4자리 코드를 받는다', validCode(good) && validCode('1234') && validCode('0007'));
  check('3·5·7자리, 글자 섞인 것, 문자열이 아닌 것은 받지 않는다', !validCode('123') && !validCode('12345') && !validCode(good + '1') && !validCode('12a456') && !validCode(123456) && !validCode('') && !validCode(null));
  check('화면에는 세 자리씩 띄워 보여 주고 4자리는 그대로', fmtCode('123456') === '123 456' && fmtCode('1234') === '1234');

  console.log('K3. 판 만들기와 표시');
  await A.ctx.createGame('가젤은 사자를 용서해야 할까?', '용서해야 해', '용서 못 해');
  await until(() => A.T.connected, 8000, '교사 연결');
  const code = A.T.room.code;
  check('새 수업의 코드는 6자리이고 판마다 같다', /^\d{6}$/.test(code) && validCode(code) && A.T.room.boards.every(b => b.code === code), code);
  check('교사 판의 코드 표시는 띄워 쓴 모양', A.$('#b-code b').textContent === fmtCode(code));
  check('학생 주소에는 띄우지 않은 코드가 들어간다', A.ctx.studentUrl(code).endsWith('?c=' + code));
  A.ctx.showQR();
  const qr = A.overlays().at(-1);
  check('QR 창의 큰 코드도 띄워 쓰고 6자리용 모양을 쓴다', qr.innerHTML.includes('<div class="bigcode six">' + fmtCode(code) + '</div>'), qr.innerHTML.slice(0, 200).replace(/<svg[\s\S]*?<\/svg>/, '<svg/>'));
  qr.remove();

  console.log('K4. 학생 입장');
  const St = makePage(bus, {});
  const tryJoin = (c, name) => { St.ctx.openJoin(''); St.$('#j-code').value = c; St.$('#j-name').value = name; St.$('#j-go').onclick(); return St.$('#j-msg').textContent; };
  const helloCount = () => bus.sent.filter(m => m.event === 'hello').length;
  const h0 = helloCount();
  check('자릿수가 모자라면 6자리를 적으라고 알린다', tryJoin('12345', '1번') === '접속 코드 숫자 6자리를 적어 주세요' && St.shown() === 'join-view');
  const typo = code.slice(0, 2) + ((+code[2] + 1) % 10) + code.slice(3);
  check('숫자 하나를 잘못 누르면 들어가지 않고 다시 확인하라고 알린다', tryJoin(typo, '1번') === '접속 코드가 맞지 않아요. 숫자를 다시 확인해 주세요.' && St.shown() === 'join-view', typo);
  const swapped = code[0] !== code[1] ? code[1] + code[0] + code.slice(2) : code.slice(0, 4) + code[5] + code[4];
  check('이웃한 숫자를 바꿔 눌러도 들어가지 않는다', swapped === code || (tryJoin(swapped, '1번').includes('맞지 않아요') && St.shown() === 'join-view'), swapped);
  await sleep(100);
  check('막힌 입장은 서버로 아무것도 보내지 않는다', helloCount() === h0);
  check('이름이 비면 이름을 적으라고 알린다', tryJoin(code, '') === '번호나 별명을 적어 주세요');
  tryJoin(fmtCode(code), '1번');
  await until(() => St.S.cfg && St.shown() === 'student-view', 5000, '띄어 적은 코드로 입장');
  check('「123 456」처럼 띄어 적어도 들어간다', St.S.code === code && St.S.cfg.question === '가젤은 사자를 용서해야 할까?');
  check('학생 화면의 코드 표시도 띄워 쓴 모양', St.$('#s-who').textContent === '코드 ' + fmtCode(code) + ' · 1번', St.$('#s-who').textContent);
  St.$('#s-text').value = '사과했으니까요'; St.$('#s-str').value = 3; St.ctx.setSide('L'); St.ctx.submitComposer();
  await until(() => A.T.g.cards.length === 1, 5000, '카드 도착');
  check('새 코드로 보낸 카드가 교사 판에 도착한다', A.T.g.cards[0].text === '사과했으니까요');

  const Qr = makePage(bus, { search: '?c=' + code });
  check('QR 주소(?c=6자리)로 열면 그 코드가 채워진 입장 화면이 뜬다', Qr.shown() === 'join-view' && Qr.$('#j-code').value === fmtCode(code), Qr.shown() + ' ' + Qr.$('#j-code').value);
  Qr.$('#j-name').value = '2번'; Qr.$('#j-go').onclick();
  await until(() => Qr.S.cfg && Qr.shown() === 'student-view', 5000, 'QR 입장');
  check('채워진 코드 그대로 「들어가기」를 누르면 들어간다', Qr.S.code === code);
  const two = code.slice(0, 2) + ' ' + code.slice(2, 4) + ' ' + code.slice(4), wide = [...code].map(d => String.fromCharCode(d.charCodeAt(0) + 0xFEE0)).join('');
  check('「12 34 56」처럼 두 자리씩 띄우거나 전각 숫자로 적어도 같은 코드로 읽는다', A.ctx.cleanCode(two) === code && A.ctx.cleanCode(wide) === code && A.ctx.cleanCode(' ' + code + ' ') === code && A.ctx.cleanCode(null) === '');
  const Sp = makePage(bus, { search: '?c=' + encodeURIComponent(fmtCode(code)) });
  check('주소의 코드에 빈칸이 끼어도 입장 화면이 뜬다', Sp.shown() === 'join-view' && Sp.$('#j-code').value === fmtCode(code), Sp.shown());
  const S3 = makePage(bus, {}); S3.ctx.openJoin(''); S3.$('#j-code').value = two; S3.$('#j-name').value = '4번'; S3.$('#j-go').onclick();
  await until(() => S3.S.cfg && S3.shown() === 'student-view', 5000, '두 자리씩 띄운 코드로 입장');
  check('두 자리씩 띄워 적은 코드로도 들어간다', S3.S.code === code);
  const Bad = makePage(bus, { search: '?c=' + typo });
  check('잘못된 코드가 든 주소는 입장 화면으로 가지 않는다', Bad.shown() !== 'join-view' && Bad.shown() !== 'student-view', Bad.shown());

  console.log('K5. 예전 4자리 수업');
  const bus2 = makeBus();
  const Old = makePage(bus2, { width: 1024 });
  await Old.ctx.createGame('예전 수업', '가', '나');
  await until(() => Old.T.connected, 8000, '교사 연결(예전)');
  // 예전에 만들어 보관한 수업처럼 코드를 4자리로 돌려 놓고 다시 연다
  vm.runInContext('(() => { const r = T.room; r.code = "4321"; r.boards.forEach(b => b.code = "4321"); saveGame(); T.probeCode = null; })()', Old.ctx);
  const Old2 = makePage(bus2, { width: 1024, storage: Old.storage, search: '?room=' + Old.T.room.storageId });
  await until(() => Old2.T.connected, 8000, '교사 다시 연결(4자리)');
  check('보관해 둔 4자리 수업은 그 코드 그대로 열린다', Old2.T.room.code === '4321' && Old2.$('#b-code b').textContent === '4321');
  const S4 = makePage(bus2, {});
  S4.ctx.openJoin(''); S4.$('#j-code').value = '4321'; S4.$('#j-name').value = '3번'; S4.$('#j-go').onclick();
  await until(() => S4.S.cfg && S4.shown() === 'student-view', 5000, '4자리 입장');
  check('학생은 예전 4자리 코드로도 들어간다', S4.S.code === '4321' && S4.S.cfg.question === '예전 수업');
  const S4q = makePage(bus2, { search: '?c=4321' });
  check('4자리 QR 주소도 그대로 받는다', S4q.shown() === 'join-view' && S4q.$('#j-code').value === '4321');

  console.log('K6. 저장·불러오기');
  const ok6 = vm.runInContext('(() => { try { return validateBackup(JSON.parse(JSON.stringify(backupObject(T.room)))).code; } catch (e) { return "ERR " + e.message; } })()', A.ctx);
  check('6자리 코드 수업이 JSON 검증을 통과한다', ok6 === code, ok6);
  const ok4 = vm.runInContext('(() => { try { return validateBackup(JSON.parse(JSON.stringify(backupObject(T.room)))).code; } catch (e) { return "ERR " + e.message; } })()', Old2.ctx);
  check('4자리 코드 수업도 JSON 검증을 통과한다', ok4 === '4321', ok4);
  const bad6 = vm.runInContext('(() => { try { const o = JSON.parse(JSON.stringify(backupObject(T.room))); const c = "' + typo + '"; o.room.code = c; o.room.boards.forEach(b => b.code = c); validateBackup(o); return "통과"; } catch (e) { return e.message; } })()', A.ctx);
  check('검사 숫자가 맞지 않는 코드가 든 파일은 받지 않는다', bad6.includes('접속 코드'), bad6);
  const src = require('fs').readFileSync('index.html', 'utf8');
  check('입장 칸은 6자리 안내와 띄어 적을 여유가 있는 길이', src.includes('id="j-code" inputmode="numeric" maxlength="12" placeholder="숫자 6자리"'));

  check('처리되지 않은 오류가 없다', rejections.length === 0, rejections.map(String).join(' | '));
  summary();
})();
