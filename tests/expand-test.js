const {makePage,makeBus,check,summary}=require('./phone-test-harness');
const p=makePage(makeBus(),{width:1366}),f=p.ctx.expPack;
const U=(lane,left,height=30,o={})=>({lane,left,right:left+(o.w||150),height,manual:false,late:false,...o});
const noOverlap=us=>{for(let i=0;i<us.length;i++)for(let j=0;j<i;j++){const a=us[i],b=us[j];if(a.lane===b.lane&&a.left<b.right&&b.left<a.right&&a.dist<b.dist+b.height&&b.dist<a.dist+a.height)return false;}return true;};
let us=[U(1,0),U(1,0),U(1,0)],e=f(us,8,16);
check('below: first card sits next to the rope',us[0].dist===16);check('below: later cards go further down in arrival order',us[1].dist===54&&us[2].dist===92);check('below extent = last bottom',e.bottom===122&&e.top===0);
us=[U(0,0),U(0,0)];e=f(us,8,16);check('above: first card next to rope (negative dist)',us[0].dist===-46);check('above: later card further up',us[1].dist===-84);check('above extent',e.top===84&&e.bottom===0);
us=[U(1,0),U(1,200)];f(us,8,16);check('different columns share the same row',us[0].dist===16&&us[1].dist===16);
us=[U(1,0,30,{w:200}),U(1,150)];f(us,8,16);check('wide neighbour pushes the adjacent column down',us[1].dist===54);
us=[U(0,0),U(1,0)];f(us,8,16);check('lanes are independent',us[0].dist===-46&&us[1].dist===16);
us=[U(1,0,30,{late:true}),U(1,0),U(1,0)];f(us,8,16);check('late(그대로) cards go after changed ones',us[1].dist===16&&us[2].dist===54&&us[0].dist===92);
us=[U(1,0),U(1,0,30,{manual:true,pref:16})];f(us,8,16);check('manual card keeps its place; automatic card flows past it',us[1].dist===16&&us[0].dist===54);
us=[U(1,0,30,{manual:true,pref:40}),U(1,10,30,{manual:true,pref:50})];f(us,8,16);check('two manual cards on top of each other: later one moves away from rope',us[0].dist===40&&us[1].dist===78);
us=[U(0,0,30,{manual:true,pref:-60}),U(0,10,30,{manual:true,pref:-50})];f(us,8,16);check('manual overlap above rope: later one moves up',us[0].dist===-60&&us[1].dist===-98);
us=[U(1,0,30,{manual:true,pref:300}),U(1,0)];e=f(us,8,16);check('far manual card does not block the rope side',us[1].dist===16);check('extent covers far manual card',e.bottom===330);
us=[U(1,0,70,{manual:true,pref:20}),U(1,0),U(1,0)];f(us,8,16);check('automatic cards skip a tall manual unit(묶음)',us[1].dist===98&&us[2].dist===136);
const before=JSON.stringify(us.map(u=>[u.left,u.right,u.height,u.lane]));f(us,8,16);check('left/right/height/lane never change',JSON.stringify(us.map(u=>[u.left,u.right,u.height,u.lane]))===before);
let seed=7;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let t=0;t<60;t++){const n=40+Math.floor(rnd()*160);us=Array.from({length:n},()=>{const lane=rnd()<.5?0:1,h=20+Math.floor(rnd()*90),manual=rnd()<.15;return U(lane,Math.floor(rnd()*1200),h,{w:80+Math.floor(rnd()*160),manual,pref:manual?(lane?1:-1)*Math.floor(rnd()*500)-(lane?0:h):0,late:rnd()<.3});});e=f(us,8,16);
 const ok=noOverlap(us)&&us.every(u=>-u.dist<=e.top&&u.dist+u.height<=e.bottom)&&us.filter(u=>!u.manual).every(u=>u.lane?u.dist>=16:u.dist+u.height<=-16);check('random '+t+': no overlap, inside extents, right side of rope',ok);}
// 400장(200명 처음+추가)도 순식간에 끝나야 한다
us=[];for(let i=0;i<800;i++)us.push(U(i%2,(i%10)*130,30,{w:120+(i%3)*30}));const t0=Date.now();f(us,8,16);check('800 units pack quickly',Date.now()-t0<1500&&noOverlap(us));
// 상태는 화면 전용: 저장 형식에 들어가지 않는다
const r=JSON.parse(require('fs').readFileSync('fixture-200.json','utf8'));p.T.room=r;p.T.g=r.boards[0];p.T.viewedBoardId=p.T.g.id;p.ctx.show('board-view');const snap=JSON.stringify(r);p.ctx.renderBoard();
check('render in fake DOM does not throw or change the room',JSON.stringify(r)===snap);check('expanded state is not part of the saved room',!snap.includes('expand')&&!JSON.stringify(p.ctx.backupObject(r)).includes('"EXP"'));
r.offline=false;const cfgKeys=Object.keys(p.ctx.cfgPayload()||{});check('student config has no expansion field',cfgKeys.length>5&&!cfgKeys.some(k=>/^exp|expand/i.test(k)));r.offline=true;
check('toggle label starts on',p.$('#t-expand').textContent==='자동 확장: 켜짐');p.$('#t-expand').onclick();check('toggle off updates label, room untouched',p.$('#t-expand').textContent==='자동 확장: 꺼짐'&&JSON.stringify(r)===snap);p.$('#t-expand').onclick();check('toggle on again',p.$('#t-expand').textContent==='자동 확장: 켜짐');
summary();process.exit(process.exitCode||0);
