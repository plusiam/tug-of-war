const fs=require('fs');const {makePage,makeBus,check,summary}=require('./phone-test-harness');
const p=makePage(makeBus(),{width:1366});const r=JSON.parse(fs.readFileSync('../expand200/fixture.json','utf8'));const g=r.boards[0];r.offline=true;g.share=false;g.showNames=false;p.T.room=r;p.T.g=g;p.T.viewedBoardId=g.id;p.T.maskOff=g.id;p.ctx.show('board-view');
const c=Object.create(p.ctx);c.esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));c.stageOf=x=>x.stage??x.phase??0;const before=JSON.stringify(r),cfgBefore=JSON.stringify(c.cfgPayload());
const rows=h=>(h.match(/class="sx-r"/g)||[]).length;
// 목록 내용
let h=c.sidesHTML(g,0,0,c.sidesRows(g,0),'');
check('stage list: first + one extra',JSON.stringify(c.sidesStages(g))==='[0,1]');
check('rows = longer side',c.sidesRows(g,0)===120);
check('all 200 first reasons in one image',rows(h)===200);
check('both columns present',h.includes('sx-col L')&&h.includes('sx-col R'));
check('question shown',h.includes(c.esc(g.question)));
check('first stage has no extra-question box',!h.includes('sx-wf'));
check('label first',h.includes('<span>처음 생각</span>'));
check('names hidden when showNames off',!h.includes('sx-w"'));
const L=c.bigSideCards(g,0,'L');
check('same order as big view (strongest first)',h.indexOf(c.esc(L[0].text))<h.indexOf(c.esc(L[L.length-1].text))&&L[0].strength>=L[L.length-1].strength);
check('share off still exports reasons',g.share===false&&h.includes(c.esc(L[0].text)));
g.showNames=true;h=c.sidesHTML(g,0,0,200,'');check('names shown when showNames on',h.includes('sx-w"')&&h.includes(c.esc(L[0].name)));g.showNames=false;
// 숨긴 카드
L[0].hidden=true;h=c.sidesHTML(g,0,0,200,'');check('hidden card excluded',!h.includes(c.esc(L[0].text))&&rows(h)===199);L[0].hidden=false;
// HTML 글자 그대로
const keep=L[1].text;L[1].text='<img src=x onerror=1> & "따옴표"';h=c.sidesHTML(g,0,0,200,'');check('reason text escaped',h.includes('&lt;img src=x onerror=1&gt;')&&!h.includes('<img'));L[1].text=keep;
// 추가 질문
h=c.sidesHTML(g,1,0,c.sidesRows(g,1),'');
check('extra stage shows its question',h.includes('sx-wf')&&h.includes(c.esc(g.whatif[0]))&&h.includes('추가 질문 1의 생각'));
check('extra stage rows = extra cards',rows(h)===g.cards.filter(x=>!x.hidden&&c.stageOf(x)===1).length);
check('extra stage excludes first-stage cards',!h.includes(c.esc(c.bigSideCards(g,0,'L')[0].text))||c.bigSideCards(g,1,'L').some(x=>x.text===c.bigSideCards(g,0,'L')[0].text));
// 나눠 담기
const a=c.sidesHTML(g,0,0,60,'1/2'),b=c.sidesHTML(g,0,60,120,'2/2');
check('parts cover every row once',rows(a)+rows(b)===200);check('part label',a.includes('(1/2)')&&b.includes('(2/2)'));
check('short side does not print empty note in later part',!b.includes('sx-none'));
const e={...g,cards:g.cards.filter(x=>x.side==='L')};check('empty side note',c.sidesHTML(e,0,0,120,'').includes('아직 근거가 없어요'));
// 크기 계획
const P=(hh,s)=>c.sidesPlan(hh,s);
check('class size: x2 one image',P(1300,false).scale===2&&P(1300,false).parts===1);
check('200 people desktop: one image',P(8737,false).parts===1&&P(8737,false).scale===1.5);
check('desktop limits respected',[500,3000,7500,7501,10000,15000].every(x=>{const q=P(x,false);return q.parts===1&&x*q.scale<=15000&&1600*q.scale*x*q.scale<=60e6;}));
check('tablet limits respected',[500,2343,2344,4166,8000].every(x=>{const q=P(x,true);return q.parts===1&&x*q.scale<=8000&&1600*q.scale*x*q.scale<=15e6;}));
check('too tall splits',P(15001,false).parts===2&&P(8001,true).parts===2&&P(40000,true).parts>=5);
check('split parts fit at x1',[15001,30000,60000].every(x=>{const q=P(x,false);return x/q.parts<=15000;})&&[8001,20000,40000].every(x=>{const q=P(x,true);return x/q.parts<=8000;}));
// 가리기
r.offline=false;p.T.maskOff=null;
check('masked: only first stage offered',JSON.stringify(c.sidesStages(g))==='[0]');
let m=c.sidesMenuHTML();check('masked menu: single button + note',(m.match(/data-sx=/g)||[]).length===1&&m.includes('처음 생각만 저장할 수 있어요')&&!m.includes(c.esc(g.whatif[0])));
p.T.maskOff=g.id;m=c.sidesMenuHTML();check('unmasked menu: one button per stage',(m.match(/data-sx=/g)||[]).length===2&&m.includes('data-sx="0"')&&m.includes('data-sx="1"')&&!m.includes('처음 생각만 저장'));
r.offline=true;
// 크게 보기 단추
p.T.big={boardId:g.id,tab:'side',stage:0,sideStage:0,page:0,one:null};c.renderBig();let q=p.$('#bigq').innerHTML;
check('big side list has save button',q.includes('data-bq="save"')&&q.includes('이미지로 저장'));
check('big list still seven per side',(q.match(/class="bq-r"/g)||[]).length===14);
p.T.big.one=c.bigSideModel(g,p.T.big).seq[0].id;c.renderBig();check('one-card view has no save button',!p.$('#bigq').innerHTML.includes('data-bq="save"'));
p.T.big={boardId:g.id,tab:'q',stage:0,sideStage:0,page:0,one:null};c.renderBig();check('question tab has no save button',!p.$('#bigq').innerHTML.includes('data-bq="save"'));
const keepCards=g.cards;g.cards=[];p.T.big={boardId:g.id,tab:'side',stage:0,sideStage:0,page:0,one:null};c.renderBig();check('empty board has no save button',!p.$('#bigq').innerHTML.includes('data-bq="save"'));g.cards=keepCards;p.T.big=null;
// 아무것도 바꾸지 않는다
check('room data unchanged',JSON.stringify(r)===before);check('student config unchanged',JSON.stringify(c.cfgPayload())===cfgBefore);check('share still off',g.share===false);
// 휴대폰 교사 화면
const pp=makePage(makeBus(),{width:390});const r2=JSON.parse(fs.readFileSync('../expand200/fixture.json','utf8'));const g2=r2.boards[0];r2.offline=false;g2.showNames=false;pp.T.room=r2;pp.T.g=g2;pp.T.viewedBoardId=g2.id;pp.T.maskOff=null;pp.ctx.show('board-view');
check('phone board detected',pp.ctx.isPhoneBoard()===true);
check('phone: masking never applies, every stage offered',JSON.stringify(pp.ctx.sidesStages(g2))==='[0,1]');
const pm=pp.ctx.sidesMenuHTML();check('phone menu has a button per stage',(pm.match(/data-sx=/g)||[]).length===2);
check('phone menu note does not mention board image or big view',!pm.includes('판 이미지')&&!pm.includes('크게 보기')&&pm.includes('길게 눌러'));
check('narrow width plan: group size x2',pp.ctx.sidesPlan(1240,true,1080).scale===2&&pp.ctx.sidesPlan(1240,true,1080).parts===1);
check('narrow width plan respects phone limits',[600,3000,3500,5000,8000].every(x=>{const q=pp.ctx.sidesPlan(x,true,1080);return q.parts===1&&x*q.scale<=8000&&1080*q.scale*x*q.scale<=15e6;}));
check('narrow too tall splits',pp.ctx.sidesPlan(8001,true,1080).parts>=2);
check('default width unchanged',JSON.stringify(c.sidesPlan(8737,false))===JSON.stringify(c.sidesPlan(8737,false,1600)));
summary();process.exit(process.exitCode||0);
