const {makeBus,makePage,check,summary,sleep,until}=require('./phone-test-harness');
(async()=>{
 const bus=makeBus(),T=makePage(bus),S=makePage(bus);await T.ctx.createGame('질문','왼','오');S.ctx.joinGame(T.T.room.code,'race');await until(()=>S.S.cfg,5000);
 const write=(text,side,n)=>{S.$('#s-text').value=text;S.$('#s-str').value=n;S.ctx.setSide(side)};
 const ask=async q=>{T.T.g.whatif.push(q);T.ctx.saveGame();T.ctx.pushConfig();await until(()=>S.S.cfg.stage===T.T.g.whatif.length,5000)};
 write('최초','L',2);S.ctx.submitComposer();await until(()=>S.S.me.cards[0]?.ok,5000);const baseline=S.S.me.cards[0].id;
 await ask('첫 회차');write('round1 rev0','L',2);S.ctx.submitComposer();await until(()=>S.S.me.cards.find(c=>c.stage===1)?.ok,5000);const c=S.S.me.cards.find(c=>c.stage===1),key=c.boardId+':'+c.id;
 check('round1 rev0 acknowledged at L2',c.accepted.rev===0&&c.accepted.side==='L'&&c.accepted.strength===2);
 bus.drop=m=>m.event==='ack';S.ctx.startEdit(c.id);write('round1 rev1','R',4);S.ctx.submitComposer();await until(()=>T.T.g.cards.find(x=>x.id===c.id)?.rev===1,5000);await sleep(200);
 check('teacher accepted R4 rev1 but ACK is lost',!c.ok&&c.accepted.rev===0&&T.T.g.cards.find(x=>x.id===c.id).side==='R');
 bus.drop=m=>m.event==='ack'||m.event==='card'&&m.payload.id===c.id&&m.payload.rev===2;
 write('round1 rev2 unsent','L',5);S.ctx.submitComposer();await sleep(200);check('rev2 L5 remains local, teacher still rev1',c.rev===2&&T.T.g.cards.find(x=>x.id===c.id).rev===1);
 await ask('둘째 회차');write('현재 회차 초안','L',3);const currentDraft=JSON.stringify(S.ctx.composerDraft()),storedDraft=JSON.stringify(S.S.me.stageDrafts[c.boardId+':2']);
 bus.drop=m=>m.event==='ack';S.ctx.toTeacher('card',{id:c.id,boardId:c.boardId,sid:S.S.me.sid,name:S.S.me.name,stage:1,rev:2,text:'round1 rev2 unsent',side:'L',strength:5,from:baseline});await until(()=>bus.sent.some(m=>m.event==='cardRejected'&&m.payload.id===c.id&&m.payload.rev===2),5000);await sleep(200);
 const rejection=bus.sent.findLast(m=>m.event==='cardRejected'&&m.payload.id===c.id).payload;
 check('closed rejection includes authoritative R4 rev1',rejection.code==='closed'&&rejection.acceptedCard?.rev===1&&rejection.acceptedCard?.side==='R'&&rejection.acceptedCard?.strength===4);
 check('student reconciles to teacher R4 rev1, not old ACK L2',c.rev===1&&c.side==='R'&&c.strength===4&&c.ok&&c.accepted.rev===1);
 check('rejected rev2 draft remains preserved',S.S.me.submissions[key].rejectedDraft?.text==='round1 rev2 unsent'&&S.S.me.stageDrafts[c.boardId+':1'].text==='round1 rev2 unsent');
 check('same-board current round composer untouched',JSON.stringify(S.ctx.composerDraft())===currentDraft);
 check('same-board current round saved draft untouched',JSON.stringify(S.S.me.stageDrafts[c.boardId+':2'])===storedDraft);
 check('rejected revision no longer has live retries',!S.S.pending[key]);
 // Only the reconciled authoritative version may be acknowledged; late other versions cannot replace it.
 S.ctx.acknowledgeCard({id:c.id,boardId:c.boardId,rev:0});check('late old rev0 ACK cannot downgrade authoritative rev1',c.rev===1&&c.side==='R'&&c.accepted.rev===1);
 S.ctx.acknowledgeCard({id:c.id,boardId:c.boardId,rev:2});check('late rejected rev2 ACK cannot confirm rejected L5',c.rev===1&&c.side==='R'&&c.accepted.rev===1);
 S.ctx.acknowledgeCard({id:c.id,boardId:c.boardId,rev:1});check('exact authoritative rev1 late ACK is allowed',c.ok&&S.S.me.submissions[key].state==='arrived'&&c.rev===1);
 check('all late ACKs preserve round2 draft',JSON.stringify(S.ctx.composerDraft())===currentDraft);
 bus.drop=()=>false;S.ctx.keepSame(baseline);await until(()=>S.S.me.cards.find(x=>x.stage===2)?.ok,5000);const next=S.S.me.cards.find(x=>x.stage===2);
 check('round2 keep copies authoritative R4 and links initial',next.side==='R'&&next.strength===4&&next.text==='round1 rev1'&&next.from===baseline);
 check('keep shortcut preserves unsent round2 composer',S.$('#s-text').value==='현재 회차 초안');
 // Without authoritative accepted data, an old local ACK must not be presented as current confirmed state.
 const unknown={id:'unknown',boardId:c.boardId,stage:1,rev:2,text:'미확인',side:'L',strength:5,from:baseline,ok:false,accepted:{rev:0,text:'오래된 ACK',side:'L',strength:2,from:baseline}};S.S.me.cards.push(unknown);S.S.me.submissions[c.boardId+':unknown']={id:'unknown',boardId:c.boardId,rev:2,state:'sending'};
 S.ctx.rejectCard({id:'unknown',boardId:c.boardId,rev:2,code:'closed',message:'닫힘'});
 check('unknown authoritative version never falsely confirms old ACK',!unknown.ok&&unknown.rejected&&unknown.rev===2);
 check('unknown rejection still preserves rejected input',S.S.me.submissions[c.boardId+':unknown'].rejectedDraft.text==='미확인');
 check('unknown rejection cannot replace known previous response',S.ctx.TugData.previousCard(S.S.me.cards,2).id===c.id);
 T.ctx.leaveTeacher();S.ctx.leaveChannels();summary();process.exit(process.exitCode||0);
})().catch(e=>{console.error(e);process.exit(1)});
