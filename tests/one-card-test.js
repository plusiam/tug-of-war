const {makeBus,makePage,check,summary,sleep,until}=require('./phone-test-harness');
const vm=require('vm');
(async()=>{
const p=makePage(makeBus()),D=p.ctx.TugData,b=D.boardNew('질문','왼','오','1234'),r={schemaVersion:4,storageId:'room1',code:'1234',created:b.created,configSeq:1,legacyBoardId:b.id,activeBoardId:b.id,boards:[b],offline:false};
const payload=(id,stage,rev=0,extra={})=>({id,sid:'sid1',boardId:b.id,stage,rev,text:'처음',side:'L',strength:2,...extra});
const a=payload('first',0);check('initial accepted',!!D.acceptCard(r,a));
check('old client second initial rejected',D.acceptCard(r,payload('dup',0))===null&&b.cards.length===1);
check('same round revision',D.acceptCard(r,payload('first',0,1,{text:'수정'})).changed&&b.cards[0].history.length===2);
const initialRetry=payload('first',0,1,{text:'수정'});b.whatif.push('만약 하나');
check('late identical closed initial retry ACK',D.acceptCard(r,initialRetry)?.changed===false);
check('closed initial higher revision rejected',D.acceptCard(r,payload('first',0,2))===null);
const w1=payload('round1',1,0,{side:'R',strength:4,text:'다른 근거'});
check('automatic initial link without from',D.acceptCard(r,w1)?.card.from==='first');
check('one card per sid stage teacher enforced',D.acceptCard(r,payload('dup1',1))===null);
b.whatif.push('만약 둘');
check('previous response not initial',D.previousCard(b.cards,2).id==='round1');
const w2={...w1,id:'round2',stage:2};check('round2 baseline still initial',D.acceptCard(r,w2)?.card.from==='first');
check('completed round exact retry',D.acceptCard(r,{...w1,from:r.boards[0].cards.find(c=>c.id===w1.id).from})?.changed===false);
check('completed round higher rev rejected',D.acceptCard(r,{...w1,rev:5})===null);
check('same id same rev changed payload not falsely ACK',D.acceptCard(r,{...w2,text:'다름'})===null);
b.whatifArchive.push(...b.whatif.splice(0));check('stage down initial remains locked',D.initialLocked(b)&&D.boardInputStage(b)===0&&D.acceptCard(r,payload('lateInitial',0))===null);
const legacy=JSON.parse(JSON.stringify(b.cards[0]));legacy.id='legacy';legacy.text='legacy';legacy.history=[{side:legacy.side,strength:legacy.strength,text:legacy.text,phase:0,t:b.created}];legacy.hidden=true;b.cards.push(legacy);
const saved=JSON.stringify(b.cards);check('legacy newest initial baseline chosen',D.initialCard(b.cards).id==='legacy');
const round=vm.runInContext('JSON.parse',p.ctx)(JSON.stringify(D.backupObject(r)));let valid=true;try{D.validateBackup(round)}catch(e){valid=e.message}
check('legacy JSON roundtrip byte-preserves card records',valid===true&&JSON.stringify(round.room.boards[0].cards)===saved,String(valid));
check('rejections no auto revive',D.autoResendPlan({state:'rejected'},false,true)==='skip');
const bus=makeBus(),T=makePage(bus),S=makePage(bus);await T.ctx.createGame('질문','왼','오');S.ctx.joinGame(T.T.room.code,'1');await until(()=>S.S.cfg,5000);
const write=(text,side='L',n=2)=>{S.$('#s-text').value=text;S.$('#s-str').value=n;S.ctx.setSide(side)};
write('처음');S.ctx.submitComposer();await until(()=>S.S.me.cards[0]?.ok,5000);const id=S.S.me.cards[0].id;
S.ctx.resetForm();write('비운 뒤 수정','R',4);S.ctx.submitComposer();await until(()=>S.S.me.cards[0]?.ok&&T.T.g.cards[0].text==='비운 뒤 수정',5000);
check('clear then send reuses unique current card',S.S.me.cards.length===1&&T.T.g.cards.length===1&&S.S.me.cards[0].id===id);
const ask=async q=>{T.T.g.whatif.push(q);T.ctx.saveGame();T.ctx.pushConfig();await until(()=>S.S.cfg.stage===T.T.g.whatif.length+T.T.g.whatifArchive.length,5000)};
await ask('하나');write('새 응답','L',3);S.ctx.submitComposer();await until(()=>S.S.me.cards.find(c=>c.stage===1)?.ok,5000);const first=S.S.me.cards[0],one=S.S.me.cards[1];
check('compose whatif automatically links baseline',one.from===id&&T.T.g.cards[1].from===id);
S.ctx.startEdit(one.id);write('직전 변경','R',5);S.ctx.submitComposer();await until(()=>one.ok&&T.T.g.cards[1].strength===5,5000);
await ask('둘');S.ctx.keepSame(id);S.ctx.keepSame(id);await until(()=>S.S.me.cards.find(c=>c.stage===2)?.ok,5000);const two=S.S.me.cards.find(c=>c.stage===2);
check('repeat keep creates one round card',S.S.me.cards.filter(c=>c.stage===2).length===1&&T.T.g.cards.filter(c=>c.stage===2).length===1);
check('keep copies previous but compares to initial',two.side==='R'&&two.strength===5&&two.text==='직전 변경'&&two.from===id);
check('direct whatif preview compares to initial',!S.$('#s-ghost').classList.contains('hide'));
const text=S.$('#s-text').value;S.ctx.startEdit(id);check('prior record edit blocked',S.$('#s-text').value===text&&S.S.editing!==id);
bus.drop=m=>m.event==='ack';S.ctx.startEdit(two.id);write('전송 초안','L',1);S.ctx.submitComposer();await sleep(300);write('아직 안 보낸 최신 글','R',2);const beforeAck=two.rev;S.ctx.acknowledgeCard({id:two.id,boardId:two.boardId,rev:two.rev-1});check('superseded revision ACK cannot confirm new revision',!two.ok&&two.rev===beforeAck);const late={id:two.id,boardId:two.boardId,rev:two.rev};S.ctx.acknowledgeCard(late);
check('late ACK preserves newer draft',S.$('#s-text').value==='아직 안 보낸 최신 글');
await ask('셋');check('new round does not relabel old typing as new',S.$('#s-text').value===''&&S.S.me.stageDrafts[two.boardId+':2'].text==='아직 안 보낸 최신 글');
S.ctx.acknowledgeCard(late);check('old stage ACK does not clear new stage',S.S.cfg.stage===3&&S.$('#s-text').value==='');
write('다음 초안');T.ctx.hideWhatif();await until(()=>S.S.cfg.stage===0,5000);const before=S.S.me.cards.length;write('처음 덮기');S.ctx.submitComposer();check('stage down pauses instead of reopening initial',S.$('#s-send').disabled&&S.S.me.cards.length===before&&first.text==='비운 뒤 수정');
bus.drop=()=>false;
// Outdated in-flight send is explicitly rejected, not counted received and not endlessly retried.
const local={id:'outdated',boardId:S.S.cfg.boardId,text:'늦은 초안',side:'L',strength:2,stage:3,from:id,rev:0,ok:false};S.S.me.cards.push(local);S.ctx.sendCard(local);await until(()=>S.S.me.submissions[local.boardId+':outdated']?.state==='rejected',5000);
const meta=S.S.me.submissions[local.boardId+':outdated'];check('reject preserves draft and does not falsely ACK',!local.ok&&meta.rejectedDraft.text==='늦은 초안'&&!T.T.g.cards.some(c=>c.id==='outdated'));
const sends=bus.sent.filter(m=>m.event==='card'&&m.payload.id==='outdated').length;S.ctx.resendStalled(true);await sleep(4000);check('reject stops retries even after reconnect config',bus.sent.filter(m=>m.event==='card'&&m.payload.id==='outdated').length===sends);
// Closed-board exact retry remains safe while new revisions are blocked.
const oldBoard=T.T.g,other=T.ctx.TugData.boardNew('다음 판','왼','오',T.T.room.code);T.T.room.boards.push(other);T.T.room.activeBoardId=other.id;T.ctx.saveGame();T.ctx.pushConfig();await until(()=>S.S.cfg.boardId===other.id,5000);
write('다른 판 초안');S.ctx.acknowledgeCard(late);check('board switch old ACK preserves new-board draft',S.$('#s-text').value==='다른 판 초안');
const savedTeacher=oldBoard.cards.find(c=>c.id===two.id),retry={...savedTeacher,sid:S.S.me.sid};check('closed board identical retry ACK',T.ctx.TugData.acceptCard(T.T.room,retry)?.changed===false);check('closed board new revision rejected',T.ctx.TugData.acceptCard(T.T.room,{...retry,rev:retry.rev+1})===null);
// Teacher already accepted an old-client card unknown on this local device. Recover its ID without deleting rejected text.
const existing={id:'already',sid:S.S.me.sid,boardId:other.id,stage:0,rev:0,text:'이미 도착',side:'L',strength:2};T.ctx.TugData.acceptCard(T.T.room,existing);
write('보관할 충돌 초안','R',4);S.ctx.submitComposer();await until(()=>S.S.me.cards.some(c=>c.id==='already'),5000);check('duplicate rejection returns canonical card and preserves composer',S.$('#s-text').value==='보관할 충돌 초안'&&S.S.me.cards.some(c=>c.rejected)&&other.cards.length===1);
S.ctx.submitComposer();await until(()=>other.cards[0].text==='보관할 충돌 초안',5000);check('duplicate draft can revise teacher canonical without extra card',other.cards.length===1&&other.cards[0].id==='already'&&other.cards[0].rev===1);
// Late join: no synthetic initial record, current round response has no baseline.
other.whatif.push('늦은 참여');T.ctx.saveGame();T.ctx.pushConfig();const lateStudent=makePage(bus);lateStudent.ctx.joinGame(T.T.room.code,'늦은 학생');await until(()=>lateStudent.S.cfg?.stage===1,5000);lateStudent.$('#s-text').value='현재 응답';lateStudent.$('#s-str').value=3;lateStudent.ctx.setSide('L');lateStudent.ctx.submitComposer();await until(()=>lateStudent.S.me.cards[0]?.ok,5000);check('late join submits own first response before current additional',lateStudent.S.me.cards.length===1&&lateStudent.S.me.cards[0].stage===0&&!lateStudent.S.me.cards[0].lateInitial&&lateStudent.ctx.curStage()===1&&lateStudent.$('#s-text').value==='');
lateStudent.ctx.leaveChannels();T.ctx.leaveTeacher();S.ctx.leaveChannels();summary();process.exit(process.exitCode||0);
})().catch(e=>{console.error(e);process.exit(1)});
