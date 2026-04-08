import { useState, useRef, useCallback, useMemo, useEffect } from "react";
const PPF=12,SNAP_PX=PPF/2,CREAM="#f2eacc",DG="#1e4d3a",DEF_W_FT=70,DEF_H_FT=50,PAD_FT=8;
const BS=[{id:"builder",cat:"Turf",name:"Builder Grade",price:8.73,color:"#5d8a48"},{id:"standard",cat:"Turf",name:"Standard Turf",price:10.84,color:"#4a7a38"},{id:"premium",cat:"Turf",name:"Premium Turf",price:12.31,color:"#3a6a28"},{id:"blackstar",cat:"Rock",name:"Texas Blackstar",price:12.18,color:"#404040"},{id:"sunset",cat:"Rock",name:"Alabama Sunset",price:4.79,color:"#b87a4a"}];
const PUT={id:"putting",name:"Putting Green",price:14.60,color:"#2a5e20"};
const LAB=4.50,PVP=150,TAX=0.0825,PW=4,PH=2,FPR=41/12/2,FPP=3500;
const sn=(x,y)=>({x:Math.round(x/SNAP_PX)*SNAP_PX,y:Math.round(y/SNAP_PX)*SNAP_PX});
const p2f=px=>px/PPF,f2p=ft=>ft*PPF,p2s=a=>a/(PPF*PPF);
const fmt=ft=>{const t=Math.round(Math.abs(ft)*12),f=Math.floor(t/12),i=t%12;return i===0?f+"'":f===0?i+'"':f+"'"+i+'"';};
const pA=v=>{let a=0;for(let i=0;i<v.length;i++){const j=(i+1)%v.length;a+=v[i].x*v[j].y-v[j].x*v[i].y;}return Math.abs(a/2);};
const ct=v=>({x:v.reduce((s,p)=>s+p.x,0)/v.length,y:v.reduce((s,p)=>s+p.y,0)/v.length});
const cSF=r=>Math.PI*(p2f(r)**2);
function cAP(pts){const p=[];for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length,a=pts[i],b=pts[j];p.push({x:a.x,y:a.y});if(b.cx!==undefined){for(let t=0.1;t<1;t+=0.1)p.push({x:(1-t)*(1-t)*a.x+2*(1-t)*t*b.cx+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*b.cy+t*t*b.y});}}return pA(p);}
function zA(z){return z.type==='circle'?cSF(z.r):z.type==='curve'?p2s(cAP(z.pts)):p2s(pA(z.pts));}
function zP(pts){if(!pts.length)return"";let d=`M ${pts[0].x} ${pts[0].y}`;for(let i=1;i<pts.length;i++){const p=pts[i];d+=p.cx!==undefined?` Q ${p.cx} ${p.cy} ${p.x} ${p.y}`:` L ${p.x} ${p.y}`;}const f=pts[0];if(f.cx!==undefined)d+=` Q ${f.cx} ${f.cy} ${f.x} ${f.y}`;return d+" Z";}
function Pats({render}){const pre=render?"r":"";return(<defs>
<pattern id={pre+"p-builder"} width={render?20:16} height={render?24:20} patternUnits="userSpaceOnUse" patternTransform={`rotate(${render?3:2})`}><rect width={render?20:16} height={render?24:20} fill={render?"#5a8545":"#5d8a48"}/>{(render?[.5,1.8,3.2,4.5,6,7.5,9,10.5,12,13.5,15,16.8,18.5]:[1,4,7.2,10.5,14]).map((x,i)=><line key={i} x1={x} y1="0" x2={x+(render?.15:.3)} y2={render?24:20} stroke={render?"#6da055":"#6fa058"} strokeWidth={render?.5+i*.03:.8+Math.random()*.4} opacity={render?.25+i*.02:.35+Math.random()*.15}/>)}{render&&[2,5.5,9,12.5,16].map((x,i)=><line key={`b${i}`} x1={x} y1={i*4} x2={x+.2} y2={i*4+8} stroke="#78b060" strokeWidth=".3" opacity=".18"/>)}</pattern>
<pattern id={pre+"p-standard"} width={render?18:14} height={render?22:18} patternUnits="userSpaceOnUse" patternTransform={`rotate(${render?2:1})`}><rect width={render?18:14} height={render?22:18} fill={render?"#468230":"#4a7a38"}/>{(render?[.4,1.6,2.8,4,5.4,6.8,8.2,9.6,11,12.4,13.8,15.4,17]:[.8,3.8,6.8,10,13]).map((x,i)=><line key={i} x1={x} y1="0" x2={x+(render?.12:.2)} y2={render?22:18} stroke={render?"#5e9248":"#62964e"} strokeWidth={render?.45+i*.02:.7+Math.random()*.5} opacity={render?.22+i*.015:.35+Math.random()*.15}/>)}{render&&[1.2,4.5,8,11.5,15].map((x,i)=><line key={`s${i}`} x1={x} y1={i*3} x2={x+.15} y2={i*3+7} stroke="#6aa052" strokeWidth=".25" opacity=".15"/>)}</pattern>
<pattern id={pre+"p-premium"} width={render?16:12} height={render?20:16} patternUnits="userSpaceOnUse" patternTransform={`rotate(${render?-2:-1})`}><rect width={render?16:12} height={render?20:16} fill={render?"#387025":"#3a6a28"}/>{(render?[.3,1.3,2.3,3.3,4.5,5.7,6.9,8.1,9.3,10.5,11.7,13,14.3]:[.7,3.4,6.2,9.2]).map((x,i)=><line key={i} x1={x} y1="0" x2={x+(render?.1:.15)} y2={render?20:16} stroke={render?"#4c8838":"#528a40"} strokeWidth={render?.4+i*.02:.8+Math.random()*.4} opacity={render?.2+i*.012:.38+Math.random()*.15}/>)}{render&&[1,4,7,10,13].map((x,i)=><line key={`p${i}`} x1={x} y1={i*3+1} x2={x+.1} y2={i*3+6} stroke="#58943e" strokeWidth=".2" opacity=".14"/>)}</pattern>
<pattern id={pre+"p-putting"} width={render?12:8} height={render?14:10} patternUnits="userSpaceOnUse"><rect width={render?12:8} height={render?14:10} fill={render?"#247818":"#2a5e20"}/>{(render?[.3,1.2,2.1,3,3.9,4.8,5.7,6.6,7.5,8.4,9.3,10.2,11.1]:[.5,2.5,4.5,6.5]).map((x,i)=><line key={i} x1={x} y1="0" x2={x} y2={render?14:10} stroke={render?"#328a28":"#3a7630"} strokeWidth={render?".2":".3"} opacity={render?".2":".28"}/>)}{render&&<>{[2,5,8,11].map((x,i)=><line key={`c${i}`} x1={x} y1={0} x2={x} y2={14} stroke="#1a6014" strokeWidth=".15" opacity=".12"/>)}<rect x="0" y="6.5" width="12" height=".3" fill="#2a7020" opacity=".08"/></>}</pattern>
<pattern id={pre+"p-blackstar"} width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill={render?"#383838":"#3a3a3a"}/><polygon points="2,3 7,1.5 8,5.5 4,7.5" fill="#4a4a4a" opacity=".6"/><polygon points="10,1 15.5,2 14.5,6.5 11,5.5" fill="#333" opacity=".5"/><polygon points="1,9 5.5,8 7,12.5 2.5,13.5" fill="#3e3e3e" opacity=".5"/><polygon points="8.5,8.5 14,7 15.5,12 13,14.5 9,13" fill="#2e2e2e" opacity=".6"/><polygon points="3,15 7,14 8.5,18 5,19.5" fill="#484848" opacity=".55"/><polygon points="10,15.5 14.5,14.5 15,19 11.5,20" fill="#363636" opacity=".5"/>{render&&<>{[{x:5,y:4},{x:12,y:3},{x:4,y:11},{x:11,y:10},{x:5,y:17},{x:12,y:17}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".4" fill="#555" opacity=".3"/>)}<line x1="3" y1="6" x2="7" y2="5" stroke="#44444440" strokeWidth=".3"/><line x1="9" y1="13" x2="14" y2="12" stroke="#44444440" strokeWidth=".3"/></>}</pattern>
<pattern id={pre+"p-sunset"} width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill={render?"#ae6e3e":"#b07040"}/><ellipse cx="4.5" cy="4" rx="3.2" ry="2.5" fill="#c88a5a" opacity=".55"/><ellipse cx="14" cy="3.5" rx="2.8" ry="3" fill="#a06030" opacity=".5"/><ellipse cx="8" cy="11" rx="3.5" ry="2.2" fill="#be7e4e" opacity=".5"/><ellipse cx="18" cy="10.5" rx="2.2" ry="3" fill="#cc9060" opacity=".55"/><ellipse cx="5" cy="19" rx="2.8" ry="2" fill="#d4a070" opacity=".5"/><ellipse cx="13" cy="18.5" rx="3" ry="2.8" fill="#b47848" opacity=".5"/>{render&&<>{[{x:3,y:6},{x:10,y:8},{x:17,y:5},{x:6,y:15},{x:15,y:15},{x:21,y:20}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".6" fill="#c89060" opacity=".25"/>)}<ellipse cx="20" cy="3" rx="2" ry="1.5" fill="#d49868" opacity=".35"/><ellipse cx="2" cy="13" rx="1.8" ry="2.2" fill="#c08050" opacity=".3"/></>}</pattern>
<pattern id={pre+"p-paver"} width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#c4b48e"/><rect x="1" y="1" width="6.5" height="14" rx=".8" fill="#d0c098" opacity=".45"/><rect x="8.5" y="1" width="6.5" height="6.5" rx=".8" fill="#b8a882" opacity=".4"/><rect x="8.5" y="8.5" width="6.5" height="6.5" rx=".8" fill="#cabc96" opacity=".42"/></pattern>
<radialGradient id="fp-g" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#1a1a1a"/><stop offset="45%" stopColor="#2a2a2a"/><stop offset="55%" stopColor="#444"/><stop offset="85%" stopColor="#666"/><stop offset="100%" stopColor="#555"/></radialGradient>
<radialGradient id="fp-f" cx="50%" cy="55%" r="40%"><stop offset="0%" stopColor="#ff6600" stopOpacity=".7"/><stop offset="40%" stopColor="#ff4400" stopOpacity=".4"/><stop offset="100%" stopColor="#ff2200" stopOpacity="0"/></radialGradient>
<filter id="zsh"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity=".18"/></filter>
<filter id="stsh"><feDropShadow dx="1" dy="1.5" stdDeviation="1.5" floodOpacity=".25"/></filter>
<filter id="sel"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#c87830" floodOpacity=".5"/></filter>
<filter id="fpsh"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity=".35"/></filter>
{render&&<><pattern id="fence" width="8" height="40" patternUnits="userSpaceOnUse"><rect width="8" height="40" fill="#8B7355"/><rect x="0" y="0" width="7.5" height="40" fill="#9B8365" rx=".5"/><line x1="0" y1="0" x2="0" y2="40" stroke="#7a6345" strokeWidth=".5"/></pattern>
<pattern id="rwall" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#8a7a6a"/><rect x=".5" y=".5" width="11" height="5" rx=".5" fill="#9a8a7a" stroke="#7a6a5a" strokeWidth=".3"/><rect x="12.5" y=".5" width="11" height="5" rx=".5" fill="#8a7a68" stroke="#7a6a5a" strokeWidth=".3"/><rect x="6" y="6.5" width="11" height="5" rx=".5" fill="#92826e" stroke="#7a6a5a" strokeWidth=".3"/></pattern>
<linearGradient id="ambient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" stopOpacity=".06"/><stop offset="100%" stopColor="#000000" stopOpacity=".05"/></linearGradient>
<radialGradient id="treeG" cx="45%" cy="40%" r="50%"><stop offset="0%" stopColor="#3a7828"/><stop offset="50%" stopColor="#2a6020"/><stop offset="100%" stopColor="#1a4a14"/></radialGradient>
<filter id="rsh"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="3" dy="5"/><feComponentTransfer><feFuncA type="linear" slope=".25"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></>}
</defs>);}
const SK="hf-quotes";
export default function App(){
  const ref=useRef(null),rRef=useRef(null);
  const[yard,setYard]=useState(null);const[yd,setYd]=useState([]);const[dY,setDY]=useState(true);
  const[zones,setZones]=useState([]);const[greens,setGreens]=useState([]);
  const[pvs,setPvs]=useState([]);const[fps,setFps]=useState([]);
  const[selPv,setSelPv]=useState(null);const[selFp,setSelFp]=useState(null);
  const[dPts,setDPts]=useState([]);const[dMode,setDMode]=useState(null);
  const[actS,setActS]=useState("standard");const[sel,setSel]=useState(null);
  const[drag,setDrag]=useState(null);const[hov,setHov]=useState(null);
  const[tool,setTool]=useState("poly");const[cDrag,setCDrag]=useState(null);
  const[eDrag,setEDrag]=useState(null);const[rDrag,setRDrag]=useState(null);
  const[placing,setPlacing]=useState(null);
  const[straight,setStraight]=useState(false);// constrain drawing to H/V
  const[gridLvl,setGridLvl]=useState(1);// 0=off,1=subtle,2=strong
  const[pvMode,setPvMode]=useState("single");// "single"|"walkway"|"patio"
  const[pvCfg,setPvCfg]=useState({spacing:2,count:10,cols:3,rows:3,gap:1});
  const[pvStart,setPvStart]=useState(null);// walkway first click
  const[view,setView]=useState("edit");
  const[rep,setRep]=useState("");const[cust,setCust]=useState("");const[addr,setAddr]=useState("");const[notes,setNotes]=useState("");
  const[vers,setVers]=useState([]);const[aVer,setAVer]=useState(null);const[showV,setShowV]=useState(false);
  const[sMsg,setSMsg]=useState(null);const[sName,setSName]=useState("");const[showSave,setShowSave]=useState(false);
  // Quick Layout Builder
  const[showLayout,setShowLayout]=useState(false);
  const[layoutData,setLayoutData]=useState({width:'',length:'',cutouts:[],sections:[]});
  // Undo/Redo
  const[history,setHistory]=useState([]);const[histIdx,setHistIdx]=useState(-1);const[histLock,setHistLock]=useState(false);
  // Retaining walls
  const[walls,setWalls]=useState([]);const[wallHeight,setWallHeight]=useState('');const[showWallH,setShowWallH]=useState(false);
  const WALL_PRICE=45; // per linear foot
  const PW_PX=f2p(PW),PH_PX=f2p(PH),FPR_PX=f2p(FPR),ROT_D=PW_PX/2+14;

  useEffect(()=>{(async()=>{try{const r=(() => { try { const v = localStorage.getItem(SK); return v ? {value: v} : null; } catch(e) { return null; } })();if(r&&r.value)setVers(JSON.parse(r.value));}catch(e){}})();},[]);
  const pV=async v=>{try{(() => { try { localStorage.setItem(SK, JSON.stringify(v)); return true; } catch(e) { return false; } })();return true;}catch(e){return false;}};
  const gS=()=>({yard,zones,greens,pvs,fps,walls,rep,cust,addr,notes});
  const lS=s=>{setYard(s.yard||null);setZones(s.zones||[]);setGreens(s.greens||[]);setPvs(s.pvs||s.pavers||[]);setFps(s.fps||s.firePits||[]);setWalls(s.walls||[]);setRep(s.rep||"");setCust(s.cust||"");setAddr(s.addr||"");setNotes(s.notes||"");setDY(!s.yard);setDPts([]);setDMode(null);setSel(null);setSelPv(null);setSelFp(null);setPlacing(null);setStraight(false);setPvStart(null);setPvMode("single");};
  const doSave=async nm=>{const v={id:Date.now(),name:nm||`v${vers.length+1}`,date:new Date().toISOString(),state:gS()};const nv=[v,...vers];if(await pV(nv)){setVers(nv);setAVer(v.id);setSMsg("✓ Saved");}else setSMsg("⚠ Failed");setShowSave(false);setSName("");setTimeout(()=>setSMsg(null),2000);};
  const loadV=id=>{const v=vers.find(x=>x.id===id);if(v){lS(v.state);setAVer(id);setView("edit");setShowV(false);}};
  const delV=async id=>{const nv=vers.filter(x=>x.id!==id);setVers(nv);if(aVer===id)setAVer(null);await pV(nv);};

  // --- Undo/Redo ---
  const snapState=useCallback(()=>{if(histLock)return;const s=JSON.stringify({yard,zones,greens,pvs,fps,walls});const nh=[...history.slice(0,histIdx+1),s];if(nh.length>40)nh.shift();setHistory(nh);setHistIdx(nh.length-1);},[yard,zones,greens,pvs,fps,walls,history,histIdx,histLock]);
  const undo=useCallback(()=>{if(histIdx<=0)return;const s=JSON.parse(history[histIdx-1]);setHistLock(true);setYard(s.yard);setZones(s.zones);setGreens(s.greens);setPvs(s.pvs);setFps(s.fps);setWalls(s.walls||[]);setHistIdx(histIdx-1);setTimeout(()=>setHistLock(false),50);},[history,histIdx]);
  const redo=useCallback(()=>{if(histIdx>=history.length-1)return;const s=JSON.parse(history[histIdx+1]);setHistLock(true);setYard(s.yard);setZones(s.zones);setGreens(s.greens);setPvs(s.pvs);setFps(s.fps);setWalls(s.walls||[]);setHistIdx(histIdx+1);setTimeout(()=>setHistLock(false),50);},[history,histIdx]);
  // Auto-snapshot on meaningful changes
  useEffect(()=>{if(!histLock&&yard)snapState();},[yard,zones.length,greens.length,pvs.length,fps.length,walls.length]);

  // --- Quick Layout Builder ---
  const generateLayout=useCallback(()=>{
    const w=parseFloat(layoutData.width),l=parseFloat(layoutData.length);
    if(!w||!l||w<=0||l<=0)return;
    const sx=f2p(PAD_FT),sy=f2p(PAD_FT);
    const wp=f2p(w),lp=f2p(l);
    // Build yard polygon with corner cutouts
    const corners={tl:{x:sx,y:sy},tr:{x:sx+wp,y:sy},br:{x:sx+wp,y:sy+lp},bl:{x:sx,y:sy+lp}};
    const cutMap={};
    layoutData.cutouts.forEach(c=>{if(c.pos&&c.w&&c.h)cutMap[c.pos]={w:f2p(parseFloat(c.w)),h:f2p(parseFloat(c.h))};});
    const verts=[];
    // Walk clockwise: TL -> TR -> BR -> BL
    if(cutMap['top-left']){const c=cutMap['top-left'];verts.push({x:sx,y:sy+c.h},{x:sx+c.w,y:sy+c.h},{x:sx+c.w,y:sy});}else verts.push(corners.tl);
    if(cutMap['top-right']){const c=cutMap['top-right'];verts.push({x:sx+wp-c.w,y:sy},{x:sx+wp-c.w,y:sy+c.h},{x:sx+wp,y:sy+c.h});}else verts.push(corners.tr);
    if(cutMap['bottom-right']){const c=cutMap['bottom-right'];verts.push({x:sx+wp,y:sy+lp-c.h},{x:sx+wp-c.w,y:sy+lp-c.h},{x:sx+wp-c.w,y:sy+lp});}else verts.push(corners.br);
    if(cutMap['bottom-left']){const c=cutMap['bottom-left'];verts.push({x:sx+c.w,y:sy+lp},{x:sx+c.w,y:sy+lp-c.h},{x:sx,y:sy+lp-c.h});}else verts.push(corners.bl);
    // Snap all vertices
    const snapped=verts.map(v=>sn(v.x,v.y));
    setYard({v:snapped});setDY(false);
    // Create a zone covering the yard
    setZones(prev=>{
      const newZones=[...prev,{type:'poly',pts:[...snapped],s:actS}];
      // Add extra sections as separate zones offset to the right
      layoutData.sections.forEach((sec,i)=>{
        const sw=parseFloat(sec.w),sh=parseFloat(sec.h);
        if(!sw||!sh)return;
        const ox=sx+wp+f2p(5),oy=sy+i*(f2p(sh)+f2p(3));
        const pts=[sn(ox,oy),sn(ox+f2p(sw),oy),sn(ox+f2p(sw),oy+f2p(sh)),sn(ox,oy+f2p(sh))];
        newZones.push({type:'poly',pts,s:actS,label:sec.label||`Section ${i+1}`});
      });
      return newZones;
    });
    setShowLayout(false);setLayoutData({width:'',length:'',cutouts:[],sections:[]});
    setDPts([]);setDMode(null);clr();
  },[layoutData,actS]);

  // --- Wall helpers ---
  const wallLen=useCallback(w=>{let d=0;for(let i=0;i<w.pts.length-1;i++)d+=Math.hypot(w.pts[i+1].x-w.pts[i].x,w.pts[i+1].y-w.pts[i].y);return p2f(d);},[]);

  const allPts=useMemo(()=>{const pts=[];yd.forEach(p=>pts.push(p));if(yard)yard.v.forEach(p=>pts.push(p));zones.forEach(z=>{if(z.type==='circle'){pts.push({x:z.cx-z.r,y:z.cy-z.r},{x:z.cx+z.r,y:z.cy+z.r});}else z.pts.forEach(p=>{pts.push(p);if(p.cx!==undefined)pts.push({x:p.cx,y:p.cy});});});greens.forEach(g=>{if(g.type==='circle'){pts.push({x:g.cx-g.r,y:g.cy-g.r},{x:g.cx+g.r,y:g.cy+g.r});}else g.pts.forEach(p=>{pts.push(p);if(p.cx!==undefined)pts.push({x:p.cx,y:p.cy});});});pvs.forEach(p=>pts.push(p));fps.forEach(p=>{pts.push({x:p.x-FPR_PX,y:p.y-FPR_PX},{x:p.x+FPR_PX,y:p.y+FPR_PX});});walls.forEach(w=>w.pts.forEach(p=>pts.push(p)));dPts.forEach(p=>pts.push(p));if(hov)pts.push(hov);if(cDrag){pts.push({x:cDrag.cx,y:cDrag.cy});if(hov?.r)pts.push({x:cDrag.cx+hov.r,y:cDrag.cy+hov.r},{x:cDrag.cx-hov.r,y:cDrag.cy-hov.r});}return pts;},[yd,yard,zones,greens,pvs,fps,walls,dPts,hov,cDrag]);
  const vb=useMemo(()=>{let wf=DEF_W_FT,hf=DEF_H_FT;if(allPts.length){let mx=0,my=0;allPts.forEach(p=>{if(p.x>mx)mx=p.x;if(p.y>my)my=p.y;});const nw=p2f(mx)+PAD_FT,nh=p2f(my)+PAD_FT;if(nw>wf)wf=Math.ceil(nw/10)*10;if(nh>hf)hf=Math.ceil(nh/10)*10;}return{w:f2p(wf),h:f2p(hf),wf,hf};},[allPts]);
  const CW=vb.w,CH=vb.h;

  const gXY=useCallback(e=>{if(!ref.current)return{x:0,y:0};const svg=ref.current;const r=svg.getBoundingClientRect();let cx,cy;if(e.touches?.length)({clientX:cx,clientY:cy}=e.touches[0]);else if(e.changedTouches?.length)({clientX:cx,clientY:cy}=e.changedTouches[0]);else({clientX:cx,clientY:cy}=e);
    // Use SVG's own coordinate transform to handle aspect ratio correctly
    const pt=svg.createSVGPoint();pt.x=cx;pt.y=cy;
    try{const ctm=svg.getScreenCTM();if(ctm){const inv=ctm.inverse();const svgP=pt.matrixTransform(inv);return{x:svgP.x,y:svgP.y};}}catch(ex){}
    // Fallback
    return{x:(cx-r.left)*(CW/r.width),y:(cy-r.top)*(CH/r.height)};},[CW,CH]);
  const lDim=useCallback(()=>{if(!hov)return null;const pts=dY?yd:dPts;if(!pts.length)return null;const last=pts[pts.length-1],d=p2f(Math.hypot(hov.x-last.x,hov.y-last.y));if(d<0.5)return null;return{x:(last.x+hov.x)/2,y:(last.y+hov.y)/2,d};},[hov,dY,yd,dPts]);
  const clr=()=>{setSel(null);setSelPv(null);setSelFp(null);};

  const hDown=useCallback((e,t,pl)=>{e.stopPropagation();if(e.cancelable)e.preventDefault();if(t==='paver'){setEDrag({t:'paver',i:pl.i});setSelPv(pl.i);setSel(null);setSelFp(null);}else if(t==='fp'){setEDrag({t:'fp',i:pl.i});setSelFp(pl.i);setSel(null);setSelPv(null);}else if(t==='rot'){setRDrag(pl.i);setSelPv(pl.i);}else if(t==='zmove'){if(dY||dMode)return;const raw=gXY(e);setDrag({t:'zmove',layer:pl.layer,idx:pl.idx,sx:raw.x,sy:raw.y,oPts:pl.layer==='zone'?zones[pl.idx]?.pts?.map(p=>({...p})):greens[pl.idx]?.pts?.map(p=>({...p}))});setSel({type:pl.layer,idx:pl.idx});setSelPv(null);setSelFp(null);}else if(t==='v'){if(dY||dMode)return;setDrag(pl);if(pl.layer)setSel({type:pl.layer,idx:pl.idx});}},[dY,dMode,gXY,zones,greens]);
  const lastTap=useRef({time:0,x:0,y:0});const rectStart=useRef(null);
  const closeShape=useCallback(()=>{if(dY&&yd.length>=4){setYard({v:yd});setYd([]);setDY(false);}else if(dMode&&dPts.length>=4){if(dMode==='zone'){setZones(p=>[...p,{pts:dPts,s:actS,type:tool==="curve"?"curve":"poly"}]);setSel({type:'zone',idx:zones.length});}else if(dMode==='green'){setGreens(p=>[...p,{pts:dPts,type:tool==="curve"?"curve":"poly"}]);setSel({type:'green',idx:greens.length});}else if(dMode==='wall'){setWalls(p=>[...p,{pts:dPts,height:24,side:'left'}]);setShowWallH(true);}setDPts([]);setDMode(null);}},[dY,yd,dMode,dPts,actS,zones.length,greens.length,tool]);
  const hClick=useCallback(e=>{if(drag||eDrag||rDrag!==null)return;const raw=gXY(e);let s=sn(raw.x,raw.y);if(straight){const pts=dY?yd:dPts;if(pts.length>0){const last=pts[pts.length-1],dx=Math.abs(s.x-last.x),dy=Math.abs(s.y-last.y);if(dx>dy)s={x:s.x,y:last.y};else s={x:last.x,y:s.y};}}
  // Double-tap to close
  const now=Date.now(),lt=lastTap.current;const isDblTap=(now-lt.time<400)&&Math.hypot(s.x-lt.x,s.y-lt.y)<20;lastTap.current={time:now,x:s.x,y:s.y};
  if(isDblTap){const pts=dY?yd:dPts;if(pts.length>=4){if(dY){setYard({v:yd});setYd([]);setDY(false);}else if(dMode==='wall'){setWalls(p=>[...p,{pts:dPts,height:24,side:'left'}]);setShowWallH(true);setDPts([]);setDMode(null);}else if(dMode){if(dMode==='zone'){setZones(p=>[...p,{pts:dPts,s:actS,type:tool==="curve"?"curve":"poly"}]);setSel({type:'zone',idx:zones.length});}else{setGreens(p=>[...p,{pts:dPts,type:tool==="curve"?"curve":"poly"}]);setSel({type:'green',idx:greens.length});}setDPts([]);setDMode(null);}return;}}
  // Rectangle tool
  if(dMode&&tool==="rect"){if(!rectStart.current){rectStart.current=s;}else{const r=rectStart.current,x1=Math.min(r.x,s.x),y1=Math.min(r.y,s.y),x2=Math.max(r.x,s.x),y2=Math.max(r.y,s.y);const pts=[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];if(dMode==='zone'){setZones(p=>[...p,{pts,s:actS,type:'poly'}]);setSel({type:'zone',idx:zones.length});}else if(dMode==='green'){setGreens(p=>[...p,{pts,type:'poly'}]);setSel({type:'green',idx:greens.length});}rectStart.current=null;setDPts([]);setDMode(null);}return;}
  if(placing==='paver'){if(pvMode==='walkway'){if(!pvStart){setPvStart(s);setPvs(p=>[...p,{x:s.x,y:s.y,rot:0}]);return;}const dx=s.x-pvStart.x,dy=s.y-pvStart.y,dist=Math.hypot(dx,dy);if(dist<1){setPvStart(null);return;}const ux=dx/dist,uy=dy/dist,rot=Math.round(Math.atan2(uy,ux)*180/Math.PI/5)*5,stepPx=f2p(pvCfg.spacing);const newPvs=[];for(let i=1;i<pvCfg.count;i++){newPvs.push({x:pvStart.x+ux*stepPx*i,y:pvStart.y+uy*stepPx*i,rot});}setPvs(p=>[...p,...newPvs]);setPvStart(null);return;}if(pvMode==='patio'){const gapPx=f2p(pvCfg.gap+PW),newPvs=[];for(let r=0;r<pvCfg.rows;r++)for(let c=0;c<pvCfg.cols;c++)newPvs.push({x:s.x+c*gapPx,y:s.y+r*gapPx,rot:0});setPvs(p=>[...p,...newPvs]);return;}setPvs(p=>[...p,{x:s.x,y:s.y,rot:0}]);return;}if(placing==='fp'){setFps(p=>[...p,{x:s.x,y:s.y}]);return;}if(placing==='wall'){setDPts(p=>[...p,{x:s.x,y:s.y}]);return;}if(dMode&&tool==="circle"){if(!cDrag)setCDrag({cx:s.x,cy:s.y});return;}if(dY){if(yd.length>=4&&Math.hypot(s.x-yd[0].x,s.y-yd[0].y)<20){setYard({v:yd});setYd([]);setDY(false);return;}setYd(p=>[...p,s]);return;}if(dMode){if(dPts.length>=4&&Math.hypot(s.x-dPts[0].x,s.y-dPts[0].y)<20){if(dMode==='zone'){setZones(p=>[...p,{pts:dPts,s:actS,type:tool==="curve"?"curve":"poly"}]);setSel({type:'zone',idx:zones.length});}else{setGreens(p=>[...p,{pts:dPts,type:tool==="curve"?"curve":"poly"}]);setSel({type:'green',idx:greens.length});}setDPts([]);setDMode(null);return;}if(tool==="curve"&&dPts.length>0){const prev=dPts[dPts.length-1];setDPts(p=>[...p,{x:s.x,y:s.y,cx:(prev.x+s.x)/2,cy:(prev.y+s.y)/2}]);}else setDPts(p=>[...p,{x:s.x,y:s.y}]);return;}clr();},[drag,eDrag,rDrag,gXY,dY,yd,dMode,dPts,actS,zones.length,greens.length,tool,cDrag,placing,straight,pvMode,pvCfg,pvStart]);
  const hMove=useCallback(e=>{if(e.cancelable)e.preventDefault();const raw=gXY(e),s=sn(raw.x,raw.y);if(rDrag!==null){const st=pvs[rDrag];if(st){const a=Math.atan2(raw.y-st.y,raw.x-st.x)*180/Math.PI;setPvs(p=>{const u=[...p];u[rDrag]={...u[rDrag],rot:Math.round(a/5)*5};return u;});}return;}if(eDrag){if(eDrag.t==='paver')setPvs(p=>{const u=[...p];u[eDrag.i]={...u[eDrag.i],x:s.x,y:s.y};return u;});else setFps(p=>{const u=[...p];u[eDrag.i]={...u[eDrag.i],x:s.x,y:s.y};return u;});return;}if(cDrag&&dMode&&tool==="circle"){setHov({x:raw.x,y:raw.y,r:Math.hypot(raw.x-cDrag.cx,raw.y-cDrag.cy)});return;}if(drag){if(drag.t==='zmove'&&drag.oPts){const dx=raw.x-drag.sx,dy=raw.y-drag.sy;const newPts=drag.oPts.map(p=>sn(p.x+dx,p.y+dy));(drag.layer==='green'?setGreens:setZones)(prev=>{const u=[...prev];u[drag.idx]={...u[drag.idx],pts:newPts};return u;});}else if(drag.t==='y'&&yard){const nv=[...yard.v];nv[drag.i]=s;setYard({v:nv});}else if(drag.t==='z'&&drag.layer==='wall'){setWalls(p=>{const u=[...p];const vv=[...u[drag.idx].pts];vv[drag.i]={...vv[drag.i],x:s.x,y:s.y};u[drag.idx]={...u[drag.idx],pts:vv};return u;});}else if(drag.t==='z'){(drag.layer==='green'?setGreens:setZones)(p=>{const u=[...p];if(u[drag.idx].type==='circle')u[drag.idx]={...u[drag.idx],cx:s.x,cy:s.y};else{const vv=[...u[drag.idx].pts];vv[drag.i]={...vv[drag.i],x:s.x,y:s.y};u[drag.idx]={...u[drag.idx],pts:vv};}return u;});}else if(drag.t==='cp'){(drag.layer==='green'?setGreens:setZones)(p=>{const u=[...p];const vv=[...u[drag.idx].pts];vv[drag.i]={...vv[drag.i],cx:s.x,cy:s.y};u[drag.idx]={...u[drag.idx],pts:vv};return u;});}}else if(dY||dMode){let h=tool==="circle"?{x:raw.x,y:raw.y}:s;if(straight&&tool!=="circle"){const pts=dY?yd:dPts;if(pts.length>0){const last=pts[pts.length-1],dx=Math.abs(h.x-last.x),dy=Math.abs(h.y-last.y);if(dx>dy)h={x:h.x,y:last.y};else h={x:last.x,y:h.y};}}setHov(h);}else if(placing)setHov(s);},[drag,eDrag,rDrag,gXY,dY,dMode,yard,tool,cDrag,pvs,straight,yd,dPts,placing]);
  const hUp=useCallback(()=>{if(cDrag&&hov?.r>8){if(dMode==='zone'){setZones(p=>[...p,{type:'circle',s:actS,cx:cDrag.cx,cy:cDrag.cy,r:hov.r}]);setSel({type:'zone',idx:zones.length});}else if(dMode==='green'){setGreens(p=>[...p,{type:'circle',cx:cDrag.cx,cy:cDrag.cy,r:hov.r}]);setSel({type:'green',idx:greens.length});}setCDrag(null);setHov(null);setDMode(null);return;}setEDrag(null);setRDrag(null);setDrag(null);},[cDrag,hov,dMode,actS,zones.length,greens.length]);

  const isD=dY||!!dMode;const cur=dY?yd:dPts;
  const ySF=yard?p2s(pA(yard.v)):0;const tGSF=greens.reduce((s,g)=>s+zA(g),0);const tBSF=zones.reduce((s,z)=>s+zA(z),0);
  const bI=zones.map(z=>{const raw=zA(z),prop=tBSF>0?raw/tBSF:0,gs=tGSF*prop,net=Math.max(0,raw-gs),s=BS.find(x=>x.id===z.s);return{name:s?.name,rawSF:raw,netSF:net,price:s?.price||0,mat:net*(s?.price||0),lab:net*LAB,color:s?.color};});
  const gI={sf:tGSF,mat:tGSF*PUT.price,lab:tGSF*LAB};
  const pvT=pvs.length*PVP,fpTot=fps.length*FPP;
  const wallTot=walls.reduce((s,w)=>s+wallLen(w)*(w.height||24)/12*WALL_PRICE,0);
  const matT=bI.reduce((s,l)=>s+l.mat,0)+(tGSF>0?gI.mat:0);
  const labT=bI.reduce((s,l)=>s+l.lab,0)+(tGSF>0?gI.lab:0);
  const sub=matT+labT+pvT+fpTot+wallTot,tax=sub*TAX,grand=sub+tax;
  const ld=lDim();const selZ=sel?.type==='zone'?zones[sel.idx]:null;const selG=sel?.type==='green'?greens[sel.idx]:null;
  const gSt=vb.wf>100?f2p(5):f2p(1);const mE=vb.wf>100?2:5;
  const hasC=zones.length>0||greens.length>0||walls.length>0;

  // Alignment guides: gather all reference points for snap lines
  const guides=useMemo(()=>{
    if(!hov&&!drag)return{hLines:[],vLines:[]};
    const t=hov||{x:0,y:0};const refPts=[];
    if(yard)yard.v.forEach(p=>refPts.push(p));
    zones.forEach(z=>{if(z.type==='circle')refPts.push({x:z.cx,y:z.cy});else z.pts.forEach(p=>refPts.push(p));});
    greens.forEach(g=>{if(g.type==='circle')refPts.push({x:g.cx,y:g.cy});else g.pts.forEach(p=>refPts.push(p));});
    const cur=dY?yd:dPts;cur.forEach(p=>refPts.push(p));
    const THRESH=SNAP_PX*1.5,hLines=[],vLines=[];
    refPts.forEach(p=>{
      if(Math.abs(t.x-p.x)<THRESH&&Math.abs(t.y-p.y)>THRESH)vLines.push(p.x);
      if(Math.abs(t.y-p.y)<THRESH&&Math.abs(t.x-p.x)>THRESH)hLines.push(p.y);
    });
    return{hLines:[...new Set(hLines)],vLines:[...new Set(vLines)]};
  },[hov,drag,yard,zones,greens,dY,yd,dPts]);

  // Paver spacing: compute distances between adjacent pavers
  const pvDists=useMemo(()=>{
    if(pvs.length<2)return[];
    const dists=[];
    for(let i=0;i<pvs.length;i++){
      let minD=Infinity,minJ=-1;
      for(let j=0;j<pvs.length;j++){
        if(i===j)continue;
        const d=Math.hypot(pvs[i].x-pvs[j].x,pvs[i].y-pvs[j].y);
        if(d<minD){minD=d;minJ=j;}
      }
      if(minJ!==-1&&minJ>i){
        const a=pvs[i],b=pvs[minJ];
        // Edge-to-edge distance (approx center-to-center minus half each paver diagonal)
        const cDist=p2f(Math.hypot(a.x-b.x,a.y-b.y));
        const edgeDist=Math.max(0,cDist-PW/2-PW/2);
        dists.push({i,j:minJ,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,d:cDist,edge:edgeDist,ax:a.x,ay:a.y,bx:b.x,by:b.y});
      }
    }
    return dists;
  },[pvs]);

  const dlPDF=()=>{const w=window.open('','_blank','width=800,height=1100');if(!w)return;
    const lines=bI.filter(l=>l.netSF>0).map(l=>`<tr><td>${l.name}</td><td>${l.netSF.toFixed(1)}sf × $${l.price}</td><td style="text-align:right">$${(l.mat+l.lab).toFixed(2)}</td></tr>`).join('');
    const gRow=tGSF>0?`<tr><td>Putting Green</td><td>${tGSF.toFixed(1)}sf × $${PUT.price}</td><td style="text-align:right">$${(gI.mat+gI.lab).toFixed(2)}</td></tr>`:'';
    const pvRow=pvs.length?`<tr><td>Limestone Pavers (2'×4')</td><td>${pvs.length} × $150</td><td style="text-align:right">$${pvT}</td></tr>`:'';
    const fpRow=fps.length?`<tr><td>Fire Pit (41")</td><td>${fps.length} × $3,500</td><td style="text-align:right">$${fpTot.toLocaleString()}</td></tr>`:'';
    const wallRow=walls.length?`<tr><td>Retaining Walls</td><td>${walls.reduce((s,w)=>s+wallLen(w),0).toFixed(1)}lf</td><td style="text-align:right">$${wallTot.toFixed(0)}</td></tr>`:'';
    const svgEl=rRef.current||ref.current;let svgStr='';if(svgEl)svgStr=new XMLSerializer().serializeToString(svgEl);
    w.document.write(`<!DOCTYPE html><html><head><title>HomeField - ${cust||'Quote'}</title><style>*{margin:0;box-sizing:border-box;font-family:system-ui,sans-serif}body{padding:40px;color:#1e4d3a;max-width:750px;margin:0 auto}h1{font-size:26px;font-weight:800}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd;font-size:12px}th{font-weight:600;background:#f5f5f0}.total{font-size:24px;font-weight:800;text-align:right;padding:16px 0;border-top:3px solid #1e4d3a}.hdr{display:flex;justify-content:space-between;margin-bottom:20px}.info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px}.info div{padding:8px;background:#f5f5f0;border-radius:4px}svg{width:100%;height:auto;margin:12px 0;border:1px solid #ddd;border-radius:8px}@media print{body{padding:20px}}</style></head><body><div class="hdr"><div><div style="font-size:9px;font-weight:600;color:#888;letter-spacing:2px">PROPOSAL</div><h1>Project Estimate</h1></div><div style="text-align:right"><div style="font-size:18px;font-weight:700;font-style:italic">HomeField</div><div style="font-size:8px;color:#888;letter-spacing:2px">ARTIFICIAL TURF CO.</div><div style="font-size:10px;color:#888;margin-top:4px">${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div></div></div><div class="info"><div><b>Rep:</b> ${rep||'—'}</div><div><b>Customer:</b> ${cust||'—'}</div><div style="grid-column:1/-1"><b>Address:</b> ${addr||'—'}</div></div>${svgStr}<table><thead><tr><th>Item</th><th>Details</th><th style="text-align:right">Cost (mat+labor)</th></tr></thead><tbody>${lines}${gRow}${pvRow}${fpRow}${wallRow}</tbody></table><table><tbody><tr><td>Subtotal</td><td></td><td style="text-align:right">$${sub.toFixed(2)}</td></tr><tr><td>Tax (8.25%)</td><td></td><td style="text-align:right">$${tax.toFixed(2)}</td></tr></tbody></table><div class="total">Total: $${grand.toFixed(2)}</div>${notes?`<div style="margin-top:12px;padding:10px;background:#f5f5f0;border-radius:4px;font-size:11px"><b>Notes:</b> ${notes}</div>`:''}<div style="margin-top:12px;font-size:8px;color:#999">* Estimate only. Subject to site inspection. Valid 30 days.</div><script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();};

  const exportForOrdering=()=>{const data={id:aVer||Date.now(),exportDate:new Date().toISOString(),cust:cust||'',addr:addr||'',rep:rep||'',notes:notes||'',yard:yard?{sqft:ySF}:null,zones:zones.map(z=>{const a=zA(z),s=BS.find(x=>x.id===z.s);return{type:z.type,s:z.s,name:s?.name||z.s,sqft:Math.round(a*100)/100,price:s?.price||0};}),greens:greens.map(g=>({type:g.type,sqft:Math.round(zA(g)*100)/100})),pvs:pvs.length,fps:fps.length,walls:walls.map(w=>({points:w.pts,height:w.height||24,side:w.side||'left',linearFeet:Math.round(wallLen(w)*100)/100})),totals:{yardSqft:Math.round(ySF),turfSqft:Math.round(tBSF*100)/100,greenSqft:Math.round(tGSF*100)/100,paverCount:pvs.length,firePitCount:fps.length,wallLinearFeet:Math.round(walls.reduce((s,w)=>s+wallLen(w),0)*100)/100,subtotal:Math.round(sub*100)/100,tax:Math.round(tax*100)/100,grandTotal:Math.round(grand*100)/100}};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`design-${(cust||'quote').replace(/[^a-zA-Z0-9]/g,'-').toLowerCase()}-${Date.now()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);setSMsg("✓ Exported");setTimeout(()=>setSMsg(null),2000);};

  const IS={padding:"10px 12px",borderRadius:8,border:`1px solid ${DG}33`,background:"#fff",color:DG,fontSize:13,fontFamily:"'Outfit',sans-serif"};
  // Zone/shape renderer for both editor and render views
  const renderZone=(z,i,isSel,inter,pre="")=>{const s=BS.find(x=>x.id===z.s),c=z.type==='circle'?{x:z.cx,y:z.cy}:ct(z.pts),a=zA(z);
    return(<g key={`z${i}`} {...(inter?{onClick:e=>{e.stopPropagation();if(!isD&&!placing){setSel({type:'zone',idx:i});setSelPv(null);setSelFp(null);}},onMouseDown:e=>{if(!isD&&!placing&&sel?.type==='zone'&&sel.idx===i&&z.type!=='circle')hDown(e,'zmove',{layer:'zone',idx:i});},onTouchStart:e=>{if(!isD&&!placing&&sel?.type==='zone'&&sel.idx===i&&z.type!=='circle')hDown(e,'zmove',{layer:'zone',idx:i});},style:{cursor:isSel?"grab":"pointer"}}:{})}>{z.type==='circle'?<circle cx={z.cx} cy={z.cy} r={z.r} fill={`url(#${pre}p-${z.s})`} stroke={isSel?"#c87830":`${DG}20`} strokeWidth={isSel?2.5:1} filter={inter?"url(#zsh)":""}/>:<path d={zP(z.pts)} fill={`url(#${pre}p-${z.s})`} stroke={isSel?"#c87830":`${DG}20`} strokeWidth={isSel?2.5:1} filter={inter?"url(#zsh)":""}/>}{inter&&<><rect x={c.x-32} y={c.y-12} width={64} height={24} rx={4} fill="rgba(255,255,255,.88)"/><text x={c.x} y={c.y} textAnchor="middle" fill={DG} fontSize="8" fontFamily="'JetBrains Mono',monospace" fontWeight="600">{s?.name?.split(" ")[0]}</text><text x={c.x} y={c.y+9} textAnchor="middle" fill={`${DG}66`} fontSize="7" fontFamily="'JetBrains Mono',monospace">{a.toFixed(0)}sf</text></>}</g>);};
  const renderGreen=(g,i,isSel,inter,pre="")=>{const c=g.type==='circle'?{x:g.cx,y:g.cy}:ct(g.pts),a=zA(g);
    return(<g key={`g${i}`} {...(inter?{onClick:e=>{e.stopPropagation();if(!isD&&!placing){setSel({type:'green',idx:i});setSelPv(null);setSelFp(null);}},style:{cursor:"pointer"}}:{})}>{g.type==='circle'?<circle cx={g.cx} cy={g.cy} r={g.r} fill={`url(#${pre}p-putting)`} stroke={isSel?"#c87830":"#fff"} strokeWidth={isSel?2.5:2} filter={inter?"url(#zsh)":""}/>:<path d={zP(g.pts)} fill={`url(#${pre}p-putting)`} stroke={isSel?"#c87830":"#fff"} strokeWidth={isSel?2.5:2} filter={inter?"url(#zsh)":""}/>}{inter&&<><rect x={c.x-28} y={c.y-10} width={56} height={20} rx={10} fill="rgba(255,255,255,.9)"/><text x={c.x} y={c.y} textAnchor="middle" fill="#2a5e20" fontSize="7.5" fontFamily="'JetBrains Mono',monospace" fontWeight="600">Putting</text><text x={c.x} y={c.y+8} textAnchor="middle" fill="#2a5e2088" fontSize="6.5" fontFamily="'JetBrains Mono',monospace">{a.toFixed(0)}sf</text></>}{!inter&&g.type==='circle'&&<><line x1={c.x+8} y1={c.y} x2={c.x+8} y2={c.y-18} stroke="#888" strokeWidth="1"/><polygon points={`${c.x+8},${c.y-18} ${c.x+18},${c.y-14} ${c.x+8},${c.y-10}`} fill="#cc3333"/><circle cx={c.x+8} cy={c.y} r="2.5" fill="#1a3a10"/></>}</g>);};
  const renderPv=(st,i,isSel,inter,pre="")=>{const rad=(st.rot||0)*Math.PI/180,hx=st.x+Math.cos(rad)*ROT_D,hy=st.y+Math.sin(rad)*ROT_D;
    return(<g key={`pv${i}`}><g {...(inter?{onMouseDown:e=>hDown(e,'paver',{i}),onTouchStart:e=>hDown(e,'paver',{i}),onClick:e=>{e.stopPropagation();setSelPv(i);setSel(null);setSelFp(null);},style:{cursor:"grab"}}:{})}><rect x={st.x-PW_PX/2} y={st.y-PH_PX/2} width={PW_PX} height={PH_PX} rx={2} fill={`url(#${pre}p-paver)`} stroke={isSel?"#c87830":"#a09070"} strokeWidth={isSel?2:1.2} filter={inter?(isSel?"url(#sel)":"url(#stsh)"):""} transform={`rotate(${st.rot||0} ${st.x} ${st.y})`}/></g>{inter&&isSel&&<><line x1={st.x} y1={st.y} x2={hx} y2={hy} stroke="#c87830" strokeWidth="1" strokeDasharray="3 2" opacity=".6"/><g onMouseDown={e=>hDown(e,'rot',{i})} onTouchStart={e=>hDown(e,'rot',{i})} style={{cursor:"grab"}}><circle cx={hx} cy={hy} r={8} fill="transparent"/><circle cx={hx} cy={hy} r={5} fill="#c87830" stroke="#fff" strokeWidth="1.5"/></g><text x={st.x} y={st.y-PH_PX/2-6} textAnchor="middle" fill="#c87830" fontSize="7" fontFamily="'JetBrains Mono',monospace" fontWeight="600">{st.rot||0}°</text></>}</g>);};
  const renderFp=(fp,i,isSel,inter)=>(
    <g key={`fp${i}`} {...(inter?{onMouseDown:e=>hDown(e,'fp',{i}),onTouchStart:e=>hDown(e,'fp',{i}),onClick:e=>{e.stopPropagation();setSelFp(i);setSel(null);setSelPv(null);},style:{cursor:"grab"}}:{})}><circle cx={fp.x} cy={fp.y} r={FPR_PX+2} fill="#444" filter={inter?(isSel?"url(#sel)":"url(#fpsh)"):""}/><circle cx={fp.x} cy={fp.y} r={FPR_PX} fill="url(#fp-g)" stroke={isSel?"#c87830":"#666"} strokeWidth={isSel?2.5:1.5}/><circle cx={fp.x} cy={fp.y} r={FPR_PX*.55} fill="url(#fp-f)"/><circle cx={fp.x} cy={fp.y} r={FPR_PX*.3} fill="#ff8800" opacity=".3"/>{inter&&isSel&&<text x={fp.x} y={fp.y-FPR_PX-6} textAnchor="middle" fill="#c87830" fontSize="7" fontFamily="'JetBrains Mono',monospace" fontWeight="600">Fire Pit 41"</text>}</g>);

  return(
<div style={{minHeight:"100vh",background:CREAM,color:DG,fontFamily:"'Outfit',sans-serif",touchAction:"none",userSelect:"none"}}>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${DG}30;border-radius:3px}::placeholder{color:${DG}55}input:focus,textarea:focus{outline:none;border-color:${DG}66!important}`}</style>

{/* HEADER */}
<div style={{height:48,padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${DG}22`,background:"#f5edcf"}}>
  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:26,height:26,borderRadius:6,background:DG,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:CREAM}}>H</div><span style={{fontSize:13,fontWeight:700,fontStyle:"italic"}}>HomeField</span></div>
  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
    <button onClick={()=>setShowV(!showV)} style={{padding:"4px 8px",borderRadius:5,border:`1px solid ${DG}30`,background:"transparent",fontSize:9,fontWeight:600,cursor:"pointer",color:DG}}>💾{vers.length}</button>
    {yard&&!showSave&&<button onClick={()=>{setSName(`v${vers.length+1} - ${cust||"Quote"}`);setShowSave(true);}} style={{padding:"4px 8px",borderRadius:5,border:`1px solid ${DG}30`,background:`${DG}10`,fontSize:9,fontWeight:600,cursor:"pointer",color:DG}}>Save</button>}
    {showSave&&<div style={{display:"flex",gap:2,alignItems:"center"}}><input autoFocus value={sName} onChange={e=>setSName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doSave(sName);if(e.key==='Escape')setShowSave(false);}} style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${DG}44`,fontSize:9,width:110,color:DG,background:"#fff"}}/><button onClick={()=>doSave(sName)} style={{padding:"3px 6px",borderRadius:4,border:"none",background:DG,color:CREAM,fontSize:9,cursor:"pointer"}}>✓</button><button onClick={()=>setShowSave(false)} style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${DG}30`,background:"transparent",fontSize:9,cursor:"pointer",color:DG}}>✕</button></div>}
    {sMsg&&<span style={{fontSize:9,fontWeight:600,color:sMsg.includes("✓")?"#2a7a2a":"#c05030"}}>{sMsg}</span>}
    {hasC&&["edit","render","quote"].map(m=><button key={m} onClick={()=>setView(m)} style={{padding:"4px 8px",borderRadius:5,border:view===m?`1.5px solid ${DG}`:`1px solid ${DG}30`,background:view===m?`${DG}15`:"transparent",fontSize:9,fontWeight:view===m?700:500,cursor:"pointer",color:DG}}>{m==="render"?"🎨 Render":m==="quote"?"Quote":m}</button>)}
  </div>
</div>

{/* Versions panel */}
{showV&&<div style={{position:"fixed",top:48,right:0,width:260,maxHeight:"60vh",background:"#fff",border:`1px solid ${DG}20`,borderRadius:"0 0 0 10px",boxShadow:`0 8px 24px ${DG}20`,zIndex:100,overflow:"auto",padding:12}}>
  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,fontWeight:700}}>Saved</span><button onClick={()=>setShowV(false)} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:12,color:DG}}>✕</button></div>
  {vers.length===0&&<div style={{fontSize:10,color:`${DG}55`,textAlign:"center",padding:12}}>None yet</div>}
  {vers.map(v=><div key={v.id} onClick={()=>loadV(v.id)} style={{padding:"6px 8px",borderRadius:5,border:`1px solid ${aVer===v.id?DG:`${DG}20`}`,marginBottom:3,cursor:"pointer",background:aVer===v.id?`${DG}08`:"transparent"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,fontWeight:600}}>{v.name}</span><button onClick={e=>{e.stopPropagation();delV(v.id);}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:8,color:"#c05030"}}>✕</button></div><div style={{fontSize:7,color:`${DG}55`}}>{new Date(v.date).toLocaleDateString()}</div></div>)}
</div>}

{/* Wall Height Prompt */}
{showWallH&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowWallH(false)}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:24,width:280,boxShadow:`0 12px 40px ${DG}30`}}>
  <div style={{fontSize:14,fontWeight:700,color:DG,marginBottom:12}}>Wall Height</div>
  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}><input type="number" autoFocus value={wallHeight||walls[walls.length-1]?.height||24} onChange={e=>setWallHeight(+e.target.value||12)} style={{...IS,width:80,fontSize:16,textAlign:"center"}} step="6"/><span style={{fontSize:12,color:`${DG}88`}}>inches</span></div>
  <div style={{display:"flex",gap:8,marginBottom:16}}>{["left","right"].map(s=><button key={s} onClick={()=>{const w=[...walls];w[w.length-1]={...w[w.length-1],side:s};setWalls(w);}} style={{flex:1,padding:"8px",borderRadius:6,border:`1.5px solid ${walls[walls.length-1]?.side===s?"#8B6914":`${DG}30`}`,background:walls[walls.length-1]?.side===s?"#8B691415":"transparent",fontSize:10,fontWeight:600,cursor:"pointer",color:DG}}>High {s}</button>)}</div>
  <button onClick={()=>{const h=+wallHeight||walls[walls.length-1]?.height||24;const w=[...walls];w[w.length-1]={...w[w.length-1],height:h};setWalls(w);setShowWallH(false);setWallHeight('');}} style={{width:"100%",padding:"10px",borderRadius:6,background:"#8B6914",color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>Done</button>
</div></div>}

{/* Quick Layout Builder */}
{showLayout&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowLayout(false)}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:24,width:360,maxHeight:"85vh",overflow:"auto",boxShadow:`0 12px 40px ${DG}30`}}>
  <div style={{fontSize:16,fontWeight:700,color:DG,marginBottom:16}}>Quick Layout Builder</div>
  <div style={{fontSize:8,fontWeight:600,letterSpacing:2,color:`${DG}77`,marginBottom:6}}>MAIN YARD</div>
  <div style={{display:"flex",gap:10,marginBottom:16}}>
    <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:DG,marginBottom:3}}>Width (ft)</div><input type="number" inputMode="decimal" step="0.5" value={layoutData.width} onChange={e=>setLayoutData(d=>({...d,width:e.target.value}))} style={{...IS,width:"100%",fontSize:16,textAlign:"center"}} placeholder="44"/></div>
    <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:DG,marginBottom:3}}>Length (ft)</div><input type="number" inputMode="decimal" step="0.5" value={layoutData.length} onChange={e=>setLayoutData(d=>({...d,length:e.target.value}))} style={{...IS,width:"100%",fontSize:16,textAlign:"center"}} placeholder="23.5"/></div>
  </div>
  <div style={{fontSize:8,fontWeight:600,letterSpacing:2,color:`${DG}77`,marginBottom:6}}>CUTOUTS (planters, obstacles)</div>
  {layoutData.cutouts.map((c,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,padding:8,background:`${DG}05`,borderRadius:6}}>
    <select value={c.pos} onChange={e=>{const u=[...layoutData.cutouts];u[i]={...u[i],pos:e.target.value};setLayoutData(d=>({...d,cutouts:u}));}} style={{...IS,padding:"6px",fontSize:11,flex:1}}>
      <option value="">Position</option><option value="top-left">Top Left</option><option value="top-right">Top Right</option><option value="bottom-left">Bottom Left</option><option value="bottom-right">Bottom Right</option>
    </select>
    <input type="number" inputMode="decimal" step="0.25" placeholder="W" value={c.w} onChange={e=>{const u=[...layoutData.cutouts];u[i]={...u[i],w:e.target.value};setLayoutData(d=>({...d,cutouts:u}));}} style={{...IS,width:55,fontSize:13,textAlign:"center"}}/>
    <span style={{fontSize:10,color:`${DG}55`}}>×</span>
    <input type="number" inputMode="decimal" step="0.25" placeholder="L" value={c.h} onChange={e=>{const u=[...layoutData.cutouts];u[i]={...u[i],h:e.target.value};setLayoutData(d=>({...d,cutouts:u}));}} style={{...IS,width:55,fontSize:13,textAlign:"center"}}/>
    <button onClick={()=>setLayoutData(d=>({...d,cutouts:d.cutouts.filter((_,j)=>j!==i)}))} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:14,color:"#c05030",padding:"4px"}}>✕</button>
  </div>)}
  <button onClick={()=>setLayoutData(d=>({...d,cutouts:[...d.cutouts,{pos:'',w:'',h:''}]}))} style={{padding:"8px 12px",borderRadius:5,border:`1px dashed ${DG}33`,background:"transparent",fontSize:10,fontWeight:600,cursor:"pointer",color:DG,marginBottom:16,width:"100%"}}>+ Add Cutout</button>
  <div style={{fontSize:8,fontWeight:600,letterSpacing:2,color:`${DG}77`,marginBottom:6}}>EXTRA SECTIONS (side yards, etc.)</div>
  {layoutData.sections.map((sec,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,padding:8,background:`${DG}05`,borderRadius:6}}>
    <input placeholder="Label" value={sec.label||''} onChange={e=>{const u=[...layoutData.sections];u[i]={...u[i],label:e.target.value};setLayoutData(d=>({...d,sections:u}));}} style={{...IS,flex:1,fontSize:11}}/>
    <input type="number" inputMode="decimal" step="0.5" placeholder="W" value={sec.w} onChange={e=>{const u=[...layoutData.sections];u[i]={...u[i],w:e.target.value};setLayoutData(d=>({...d,sections:u}));}} style={{...IS,width:55,fontSize:13,textAlign:"center"}}/>
    <span style={{fontSize:10,color:`${DG}55`}}>×</span>
    <input type="number" inputMode="decimal" step="0.5" placeholder="L" value={sec.h} onChange={e=>{const u=[...layoutData.sections];u[i]={...u[i],h:e.target.value};setLayoutData(d=>({...d,sections:u}));}} style={{...IS,width:55,fontSize:13,textAlign:"center"}}/>
    <button onClick={()=>setLayoutData(d=>({...d,sections:d.sections.filter((_,j)=>j!==i)}))} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:14,color:"#c05030",padding:"4px"}}>✕</button>
  </div>)}
  <button onClick={()=>setLayoutData(d=>({...d,sections:[...d.sections,{label:'',w:'',h:''}]}))} style={{padding:"8px 12px",borderRadius:5,border:`1px dashed ${DG}33`,background:"transparent",fontSize:10,fontWeight:600,cursor:"pointer",color:DG,marginBottom:20,width:"100%"}}>+ Add Section</button>
  <div style={{display:"flex",gap:8}}>
    <button onClick={generateLayout} style={{flex:1,padding:"12px",borderRadius:8,background:`linear-gradient(135deg,${DG},#2a6b4a)`,color:CREAM,border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>Generate Layout</button>
    <button onClick={()=>setShowLayout(false)} style={{padding:"12px 16px",borderRadius:8,border:`1px solid ${DG}30`,background:"transparent",color:DG,fontSize:12,cursor:"pointer"}}>Cancel</button>
  </div>
</div></div>}

{/* RENDER VIEW */}
{view==="render"&&yard&&<div style={{padding:16,maxWidth:900,margin:"0 auto"}}>
  <button onClick={dlPDF} style={{padding:"10px 20px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${DG},#2a6b4a)`,color:CREAM,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:12}}>📄 Download PDF</button>
  <div style={{background:"#2a2a2a",borderRadius:14,padding:3,boxShadow:"0 12px 48px rgba(0,0,0,.3)"}}>
    <svg ref={rRef} viewBox={`${-f2p(4)} ${-f2p(5)} ${CW+f2p(8)} ${CH+f2p(10)}`} style={{width:"100%",borderRadius:12,background:"linear-gradient(180deg,#c8b888,#d4c898)"}}>
      <Pats render={true}/>
      <rect x={-f2p(4)} y={-f2p(5)} width={CW+f2p(8)} height={CH+f2p(10)} fill="#c4b080" opacity=".3"/>
      <rect x={-f2p(3)} y={-f2p(3.5)} width={CW+f2p(6)} height={f2p(1.5)} fill="url(#fence)" rx="2" opacity=".8"/>
      <rect x={-f2p(3)} y={-f2p(3.5)} width={f2p(1)} height={CH+f2p(7)} fill="url(#fence)" rx="2" opacity=".6"/>
      <rect x={CW+f2p(2)} y={-f2p(3.5)} width={f2p(1)} height={CH+f2p(7)} fill="url(#fence)" rx="2" opacity=".6"/>
      <polygon points={yard.v.map(v=>`${v.x},${v.y}`).join(" ")} fill="#d8cc9e" stroke="#b8a87060" strokeWidth="3"/>
      {zones.map((z,i)=>renderZone(z,i,false,false,"r"))}
      {greens.map((g,i)=>renderGreen(g,i,false,false,"r"))}
      {pvs.map((st,i)=><g key={`rpv${i}`}><rect x={st.x-PW_PX/2+2} y={st.y-PH_PX/2+3} width={PW_PX} height={PH_PX} rx="2" fill="#00000020" transform={`rotate(${st.rot||0} ${st.x+2} ${st.y+3})`}/><rect x={st.x-PW_PX/2} y={st.y-PH_PX/2} width={PW_PX} height={PH_PX} rx="2" fill="url(#rp-paver)" stroke="#a0906840" strokeWidth="1" transform={`rotate(${st.rot||0} ${st.x} ${st.y})`}/></g>)}
      {fps.map((fp,i)=><g key={`rfp${i}`}><circle cx={fp.x+2} cy={fp.y+4} r={FPR_PX+4} fill="#00000025"/><circle cx={fp.x} cy={fp.y} r={FPR_PX+3} fill="#3a3a3a"/><circle cx={fp.x} cy={fp.y} r={FPR_PX} fill="url(#fp-g)" stroke="#555" strokeWidth="2"/><circle cx={fp.x} cy={fp.y} r={FPR_PX*.7} fill="#222"/><circle cx={fp.x} cy={fp.y} r={FPR_PX*.45} fill="url(#fp-f)"/></g>)}
      {walls.map((w,i)=><g key={`rw${i}`}><polyline points={w.pts.map(p=>`${p.x+3},${p.y+5}`).join(" ")} fill="none" stroke="#00000020" strokeWidth={8+(w.height||24)/6} strokeLinecap="round"/>{w.pts.slice(0,-1).map((a,j)=>{const b=w.pts[j+1],fo=(w.height||24)/4;return<polygon key={j} points={`${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y+fo} ${a.x},${a.y+fo}`} fill="#8a7a6a" stroke="#66554480" strokeWidth=".5"/>;})}<polyline points={w.pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#998877" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"/></g>)}
      {[[CW+f2p(.5),-f2p(.5),f2p(3.5)],[CW+f2p(1),CH+f2p(2),f2p(3)],[-f2p(1),CH+f2p(1),f2p(2.5)]].map(([tx,ty,tr],i)=><g key={`tr${i}`}><ellipse cx={tx+5} cy={ty+8} rx={tr*1.3} ry={tr*.8} fill="#00000010"/><circle cx={tx} cy={ty} r={tr} fill="url(#treeG)"/><circle cx={tx-tr*.2} cy={ty-tr*.15} r={tr*.6} fill="#3a8030" opacity=".5"/></g>)}
      <rect x={-f2p(4)} y={-f2p(5)} width={CW+f2p(8)} height={CH+f2p(10)} fill="url(#ambient)"/>
      <text x={CW/2} y={CH+f2p(3.5)} textAnchor="middle" fill="#1e4d3a" fontSize="12" fontFamily="'Outfit',sans-serif" fontWeight="700" fontStyle="italic" opacity=".2">HomeField Artificial Turf Co.</text>
    </svg>
  </div>
  <div style={{marginTop:10,textAlign:"center",fontSize:9,color:`${DG}55`}}>{ySF.toFixed(0)}sf yard · {cust||"Customer"}</div>
</div>}

{/* QUOTE VIEW */}
{view==="quote"&&<div style={{maxWidth:660,margin:"0 auto",padding:"24px 16px"}}>
  <div style={{display:"flex",gap:8,marginBottom:16}}>
  <button onClick={dlPDF} style={{padding:"10px 20px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${DG},#2a6b4a)`,color:CREAM,fontSize:12,fontWeight:600,cursor:"pointer"}}>📄 Download PDF</button>
  <button onClick={exportForOrdering} style={{padding:"10px 20px",borderRadius:8,border:`1.5px solid ${DG}`,background:"transparent",color:DG,fontSize:12,fontWeight:600,cursor:"pointer"}}>📦 Export for Ordering</button>
  </div>
  <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><div><div style={{fontSize:9,fontWeight:600,color:`${DG}88`,letterSpacing:2}}>PROPOSAL</div><h1 style={{fontSize:24,fontWeight:800,margin:"4px 0 0"}}>Project Estimate</h1></div><div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,fontStyle:"italic"}}>HomeField</div><div style={{fontSize:10,color:`${DG}66`,marginTop:4}}>{new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div></div></div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><input placeholder="Sales Rep" value={rep} onChange={e=>setRep(e.target.value)} style={IS}/><input placeholder="Customer" value={cust} onChange={e=>setCust(e.target.value)} style={IS}/><input placeholder="Address" value={addr} onChange={e=>setAddr(e.target.value)} style={{...IS,gridColumn:"1/-1"}}/></div>
  <div style={{background:"#fff",borderRadius:10,border:`1px solid ${DG}22`,padding:10,marginBottom:14}}><svg viewBox={`0 0 ${CW} ${CH}`} style={{width:"100%",borderRadius:6,background:CREAM}}><Pats render={false}/>{yard&&<polygon points={yard.v.map(v=>`${v.x},${v.y}`).join(" ")} fill="none" stroke={`${DG}44`} strokeWidth="1.5" strokeDasharray="6 3"/>}{zones.map((z,i)=>renderZone(z,i,false,false))}{greens.map((g,i)=>renderGreen(g,i,false,false))}{pvs.map((st,i)=>renderPv(st,i,false,false))}{fps.map((fp,i)=>renderFp(fp,i,false,false))}{walls.map((w,i)=><g key={`qw${i}`}><polyline points={w.pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#8B6914" strokeWidth={4} strokeLinecap="round" strokeDasharray="8 4"/>{(()=>{const mid=w.pts[Math.floor(w.pts.length/2)];return<text x={mid.x} y={mid.y-6} textAnchor="middle" fill="#8B6914" fontSize="7" fontWeight="600">{wallLen(w).toFixed(1)}ft · {(w.height||24)}"</text>;})()}</g>)}</svg></div>
  <div style={{background:DG,borderRadius:12,overflow:"hidden",color:CREAM}}>
    <div style={{padding:"12px 16px 8px",borderBottom:`1px solid ${CREAM}15`}}><div style={{fontSize:8,fontWeight:600,letterSpacing:2,color:`${CREAM}88`}}>LINE ITEMS</div></div>
    {bI.filter(l=>l.netSF>0).map((l,i)=><div key={i} style={{padding:"8px 16px",borderBottom:`1px solid ${CREAM}10`,display:"flex",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:2,background:l.color}}/><div><div style={{fontSize:11,fontWeight:600}}>{l.name}</div><div style={{fontSize:8,color:`${CREAM}88`}}>{l.netSF.toFixed(1)}sf × ${l.price}</div></div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,fontWeight:600}}>${l.mat.toFixed(2)}</div><div style={{fontSize:7,color:`${CREAM}66`}}>+${l.lab.toFixed(2)} labor</div></div></div>)}
    {tGSF>0&&<div style={{padding:"8px 16px",borderBottom:`1px solid ${CREAM}10`,display:"flex",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:PUT.color}}/><div><div style={{fontSize:11,fontWeight:600}}>Putting Green</div><div style={{fontSize:8,color:`${CREAM}88`}}>{tGSF.toFixed(1)}sf × ${PUT.price}</div></div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,fontWeight:600}}>${gI.mat.toFixed(2)}</div><div style={{fontSize:7,color:`${CREAM}66`}}>+${gI.lab.toFixed(2)} labor</div></div></div>}
    {pvs.length>0&&<div style={{padding:"8px 16px",borderBottom:`1px solid ${CREAM}10`,display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:600}}>Limestone Pavers</div><div style={{fontSize:8,color:`${CREAM}88`}}>{pvs.length} × $150</div></div><div style={{fontSize:11,fontWeight:600}}>${pvT}</div></div>}
    {fps.length>0&&<div style={{padding:"8px 16px",borderBottom:`1px solid ${CREAM}10`,display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:600}}>Fire Pit (41")</div><div style={{fontSize:8,color:`${CREAM}88`}}>{fps.length} × $3,500</div></div><div style={{fontSize:11,fontWeight:600}}>${fpTot.toLocaleString()}</div></div>}
    {walls.length>0&&<div style={{padding:"8px 16px",borderBottom:`1px solid ${CREAM}10`,display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:600}}>Retaining Walls</div><div style={{fontSize:8,color:`${CREAM}88`}}>{walls.reduce((s,w)=>s+wallLen(w),0).toFixed(1)}lf</div></div><div style={{fontSize:11,fontWeight:600}}>${wallTot.toFixed(0)}</div></div>}
    <div style={{padding:"10px 16px",background:`${CREAM}08`}}>
      {[["Materials",matT],["Labor",labT],...(pvs.length?[["Pavers",pvT]]:[]),...(fps.length?[["Fire Pit",fpTot]]:[]),...(walls.length?[["Walls",wallTot]]:[])].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:9,color:`${CREAM}66`,padding:"1px 0"}}><span>{l}</span><span>${v.toFixed(2)}</span></div>)}
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:`${CREAM}66`,borderTop:`1px solid ${CREAM}15`,marginTop:4,paddingTop:4}}><span>Tax 8.25%</span><span>${tax.toFixed(2)}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:8,borderTop:`2px solid ${CREAM}`,marginTop:4}}><span style={{fontSize:14,fontWeight:700}}>Total</span><span style={{fontSize:18,fontWeight:800}}>${grand.toFixed(2)}</span></div>
    </div>
  </div>
  <textarea placeholder="Notes..." value={notes} onChange={e=>setNotes(e.target.value)} style={{...IS,marginTop:10,width:"100%",minHeight:50,resize:"vertical"}}/>
  <div style={{marginTop:6,fontSize:7,color:`${DG}44`}}>* Estimate. Subject to site inspection. Valid 30 days.</div>
</div>}

{/* EDITOR VIEW */}
{view==="edit"&&<div style={{display:"flex",height:"calc(100vh - 48px)",flexDirection:window.innerWidth<768?"column":"row"}}>
  <div style={{width:window.innerWidth<768?"100%":230,maxHeight:window.innerWidth<768?170:"none",borderRight:window.innerWidth>=768?`1px solid ${DG}18`:"none",borderBottom:window.innerWidth<768?`1px solid ${DG}18`:"none",display:"flex",flexDirection:"column",background:"#f0e8c8",overflow:"hidden"}}>
    <div style={{padding:"8px 10px",borderBottom:`1px solid ${DG}15`}}>
      {dY?<div style={{fontSize:11,fontWeight:600,color:"#c87830"}}>🔴 Drawing Yard</div>
      :dMode?<div style={{fontSize:11,fontWeight:600,color:dMode==='green'?PUT.color:dMode==='wall'?"#8B6914":DG}}>{dMode==='green'?"🟢 Putting Green":dMode==='wall'?"🟤 Wall":"🔷 Zone"}</div>
      :placing?<div style={{fontSize:11,fontWeight:600,color:placing==='fp'?"#555":"#a08040"}}>{placing==='fp'?"⚫ Fire Pits":"🟫 Pavers"}</div>
      :yard?<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[["zone","+ Zone",DG],["green","+ Putting",PUT.color],["paver","+ Pavers","#8a6a30"],["fp","+ Fire Pit","#555"],["wall","+ Wall","#8B6914"]].map(([k,l,c])=>
          <button key={k} onClick={()=>{if(k==='zone'){setDMode('zone');setDPts([]);clr();setTool("poly");}else if(k==='green'){setDMode('green');setDPts([]);clr();setTool("circle");}else if(k==='wall'){setDMode('wall');setDPts([]);clr();setTool("poly");}else{setPlacing(k);clr();}}} style={{flex:"1 1 45%",padding:"10px 8px",borderRadius:6,border:`1px dashed ${c}55`,background:"transparent",color:c,fontSize:10,fontWeight:600,cursor:"pointer",minHeight:44}}>{l}</button>)}
      </div>:null}
    </div>
    {dMode&&dMode!=='wall'&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`,display:"flex",gap:3}}>{[["poly","▬"],["rect","▭"],["curve","〰"],["circle","◯"]].map(([id,ic])=><button key={id} onClick={()=>{setTool(id);setDPts([]);setCDrag(null);rectStart.current=null;}} style={{flex:1,padding:"8px 4px",borderRadius:4,border:`1.5px solid ${tool===id?DG:DG+"30"}`,background:tool===id?`${DG}15`:"transparent",cursor:"pointer",fontSize:11,color:tool===id?DG:`${DG}55`,minHeight:40}}>{ic}</button>)}</div>}
    {(dY||dMode)&&<div style={{padding:"5px 10px",borderBottom:`1px solid ${DG}15`}}><button onClick={()=>setStraight(!straight)} style={{width:"100%",padding:"5px",borderRadius:4,border:`1.5px solid ${straight?"#3080d0":DG+"30"}`,background:straight?"#3080d015":"transparent",cursor:"pointer",fontSize:9,fontWeight:600,color:straight?"#3080d0":`${DG}88`,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>📐 {straight?"Straight ON":"Straight"}</button></div>}
    {placing==='paver'&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`}}>
      <div style={{display:"flex",gap:2,marginBottom:4}}>{[["single","Single"],["walkway","Walkway"],["patio","Patio"]].map(([id,lb])=><button key={id} onClick={()=>{setPvMode(id);setPvStart(null);}} style={{flex:1,padding:"4px",borderRadius:4,border:`1.5px solid ${pvMode===id?"#8a6a30":"#8a6a3030"}`,background:pvMode===id?"#8a6a3015":"transparent",cursor:"pointer",fontSize:8,fontWeight:pvMode===id?700:400,color:pvMode===id?"#8a6a30":`${DG}77`}}>{lb}</button>)}</div>
      {pvMode==='walkway'&&<div style={{display:"flex",gap:4,marginTop:2}}>
        <div style={{flex:1}}><div style={{fontSize:6,color:`${DG}55`,marginBottom:1}}>Spacing (ft)</div><input type="number" value={pvCfg.spacing} onChange={e=>setPvCfg(c=>({...c,spacing:+e.target.value||1}))} style={{width:"100%",padding:"3px 5px",borderRadius:3,border:`1px solid ${DG}30`,fontSize:9,color:DG,background:"#fff"}}/></div>
        <div style={{flex:1}}><div style={{fontSize:6,color:`${DG}55`,marginBottom:1}}>Count</div><input type="number" value={pvCfg.count} onChange={e=>setPvCfg(c=>({...c,count:Math.max(1,+e.target.value||1)}))} style={{width:"100%",padding:"3px 5px",borderRadius:3,border:`1px solid ${DG}30`,fontSize:9,color:DG,background:"#fff"}}/></div>
      </div>}
      {pvMode==='walkway'&&pvStart&&<div style={{fontSize:8,color:"#8a6a30",fontWeight:600,marginTop:3,textAlign:"center"}}>Tap endpoint direction →</div>}
      {pvMode==='patio'&&<div style={{display:"flex",gap:4,marginTop:2}}>
        <div style={{flex:1}}><div style={{fontSize:6,color:`${DG}55`,marginBottom:1}}>Cols</div><input type="number" value={pvCfg.cols} onChange={e=>setPvCfg(c=>({...c,cols:Math.max(1,+e.target.value||1)}))} style={{width:"100%",padding:"3px 5px",borderRadius:3,border:`1px solid ${DG}30`,fontSize:9,color:DG,background:"#fff"}}/></div>
        <div style={{flex:1}}><div style={{fontSize:6,color:`${DG}55`,marginBottom:1}}>Rows</div><input type="number" value={pvCfg.rows} onChange={e=>setPvCfg(c=>({...c,rows:Math.max(1,+e.target.value||1)}))} style={{width:"100%",padding:"3px 5px",borderRadius:3,border:`1px solid ${DG}30`,fontSize:9,color:DG,background:"#fff"}}/></div>
        <div style={{flex:1}}><div style={{fontSize:6,color:`${DG}55`,marginBottom:1}}>Gap (ft)</div><input type="number" value={pvCfg.gap} onChange={e=>setPvCfg(c=>({...c,gap:+e.target.value||0}))} style={{width:"100%",padding:"3px 5px",borderRadius:3,border:`1px solid ${DG}30`,fontSize:9,color:DG,background:"#fff"}}/></div>
      </div>}
    </div>}
    {!dY&&!dMode&&!placing&&(sel||selPv!==null||selFp!==null)&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`}}><button onClick={()=>{if(sel?.type==='zone')setZones(p=>p.filter((_,j)=>j!==sel.idx));else if(sel?.type==='green')setGreens(p=>p.filter((_,j)=>j!==sel.idx));else if(sel?.type==='wall')setWalls(p=>p.filter((_,j)=>j!==sel.idx));else if(selPv!==null)setPvs(p=>p.filter((_,j)=>j!==selPv));else if(selFp!==null)setFps(p=>p.filter((_,j)=>j!==selFp));clr();}} style={{width:"100%",padding:"8px",borderRadius:6,background:"#c05030",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",border:"none",minHeight:40}}>Delete Selected</button></div>}
    {(dY||dMode)&&(dY?yd:dPts).length>=4&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`}}><button onClick={closeShape} style={{width:"100%",padding:"10px",borderRadius:6,background:"#c87830",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",minHeight:44}}>Close Shape</button></div>}
    {dMode==='wall'&&dPts.length>=2&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`}}><button onClick={()=>{setWalls(p=>[...p,{pts:[...dPts],height:24,side:'left'}]);setShowWallH(true);setDPts([]);setDMode(null);}} style={{width:"100%",padding:"10px",borderRadius:6,background:"#8B6914",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",minHeight:44}}>Finish Wall</button></div>}
    {(placing||dMode)&&<div style={{padding:"6px 10px",borderBottom:`1px solid ${DG}15`}}><button onClick={()=>{setPlacing(null);setDMode(null);setDPts([]);setCDrag(null);setStraight(false);setPvStart(null);setPvMode("single");rectStart.current=null;}} style={{width:"100%",padding:"8px",borderRadius:4,background:DG,color:CREAM,fontSize:10,fontWeight:600,cursor:"pointer",border:"none",minHeight:40}}>{placing?"Done":"Cancel"}</button></div>}
    {yard&&!dY&&<div style={{flex:1,overflowY:"auto",padding:"4px 0",fontSize:10}}>
      {!dMode&&!placing&&<>{["Turf","Rock"].map(cat=><div key={cat}><div style={{padding:"3px 10px 1px",fontSize:7,fontWeight:600,color:`${DG}77`,letterSpacing:1}}>{cat}</div>
        {BS.filter(x=>x.cat===cat).map(s=><button key={s.id} onClick={()=>{setActS(s.id);if(sel?.type==='zone'&&zones[sel.idx])setZones(p=>{const u=[...p];u[sel.idx]={...u[sel.idx],s:s.id};return u;});}} style={{width:"100%",padding:"4px 10px",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,background:actS===s.id?`${DG}12`:"transparent",borderRadius:3}}>
          <div style={{width:10,height:10,borderRadius:2,background:s.color,border:actS===s.id?`2px solid ${DG}`:`1px solid ${DG}30`}}/><div style={{flex:1,fontWeight:actS===s.id?600:400,color:actS===s.id?DG:`${DG}88`}}>{s.name}</div><span style={{fontSize:7,color:`${DG}55`}}>${s.price}</span>
        </button>)}</div>)}</>}
      {zones.length>0&&<div style={{padding:"6px 10px 2px",borderTop:`1px solid ${DG}12`}}><div style={{fontSize:6,fontWeight:600,letterSpacing:2,color:`${DG}55`,marginBottom:2}}>ZONES</div>{zones.map((z,i)=>{const s=BS.find(x=>x.id===z.s);return<div key={i} onClick={()=>{setSel({type:'zone',idx:i});setSelPv(null);setSelFp(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 5px",borderRadius:3,cursor:"pointer",background:sel?.type==='zone'&&sel.idx===i?`${DG}12`:"transparent"}}><div style={{flex:1}}>{s?.name} · {zA(z).toFixed(0)}sf</div><button onClick={e=>{e.stopPropagation();setZones(p=>p.filter((_,j)=>j!==i));}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:7,color:"#c05030"}}>✕</button></div>;})}</div>}
      {greens.length>0&&<div style={{padding:"6px 10px 2px",borderTop:`1px solid ${DG}12`}}><div style={{fontSize:6,fontWeight:600,letterSpacing:2,color:`${DG}55`,marginBottom:2}}>GREENS</div>{greens.map((g,i)=><div key={i} onClick={()=>{setSel({type:'green',idx:i});setSelPv(null);setSelFp(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 5px",borderRadius:3,cursor:"pointer",background:sel?.type==='green'&&sel.idx===i?"#2a5e2012":"transparent"}}><div style={{flex:1}}>Putting · {zA(g).toFixed(0)}sf</div><button onClick={e=>{e.stopPropagation();setGreens(p=>p.filter((_,j)=>j!==i));}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:7,color:"#c05030"}}>✕</button></div>)}</div>}
      {pvs.length>0&&<div style={{padding:"6px 10px 2px",borderTop:`1px solid ${DG}12`}}><div style={{fontSize:6,fontWeight:600,letterSpacing:2,color:`${DG}55`,marginBottom:2}}>PAVERS ({pvs.length})</div>{pvs.map((st,i)=><div key={i} onClick={()=>{setSelPv(i);setSel(null);setSelFp(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 5px",borderRadius:3,cursor:"pointer",background:selPv===i?"#a0804012":"transparent"}}><div style={{flex:1}}>Paver {i+1} · {st.rot||0}°</div><button onClick={e=>{e.stopPropagation();setPvs(p=>p.filter((_,j)=>j!==i));}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:7,color:"#c05030"}}>✕</button></div>)}</div>}
      {fps.length>0&&<div style={{padding:"6px 10px 2px",borderTop:`1px solid ${DG}12`}}><div style={{fontSize:6,fontWeight:600,letterSpacing:2,color:`${DG}55`,marginBottom:2}}>FIRE PITS ({fps.length})</div>{fps.map((fp,i)=><div key={i} onClick={()=>{setSelFp(i);setSel(null);setSelPv(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 5px",borderRadius:3,cursor:"pointer",background:selFp===i?"#44444412":"transparent"}}><div style={{flex:1}}>Fire Pit {i+1}</div><button onClick={e=>{e.stopPropagation();setFps(p=>p.filter((_,j)=>j!==i));}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:7,color:"#c05030"}}>✕</button></div>)}</div>}
      {walls.length>0&&<div style={{padding:"6px 10px 2px",borderTop:`1px solid ${DG}12`}}><div style={{fontSize:6,fontWeight:600,letterSpacing:2,color:`${DG}55`,marginBottom:2}}>WALLS ({walls.length})</div>{walls.map((w,i)=><div key={i} onClick={()=>{setSel({type:'wall',idx:i});setSelPv(null);setSelFp(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 5px",borderRadius:3,cursor:"pointer",background:sel?.type==='wall'&&sel.idx===i?"#8B691412":"transparent"}}><div style={{flex:1}}>Wall {i+1} · {wallLen(w).toFixed(1)}ft · {(w.height||24)}"</div><button onClick={e=>{e.stopPropagation();setWalls(p=>p.filter((_,j)=>j!==i));}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:10,color:"#c05030",padding:"4px"}}>✕</button></div>)}</div>}
      <div style={{padding:"8px 10px",borderTop:`1px solid ${DG}12`,marginTop:2,display:"flex",gap:4,flexWrap:"wrap"}}>
        <button onClick={()=>setShowLayout(true)} style={{flex:"1 1 45%",padding:"6px",borderRadius:4,border:`1px solid ${DG}33`,background:`${DG}08`,color:DG,fontSize:8,cursor:"pointer",fontWeight:600}}>Quick Layout</button>
        <button onClick={()=>{setYard(null);setYd([]);setDY(true);setZones([]);setGreens([]);setDPts([]);setDMode(null);clr();setPvs([]);setFps([]);setWalls([]);setPlacing(null);}} style={{flex:"1 1 45%",padding:"6px",borderRadius:4,border:"1px solid #c0503033",background:"transparent",color:"#c05030",fontSize:8,cursor:"pointer"}}>Reset All</button>
      </div>
    </div>}
  </div>
  <div style={{flex:1,display:"flex",flexDirection:"column",background:CREAM,minHeight:0}}>
    <div style={{padding:"4px 10px",borderBottom:`1px solid ${DG}12`,fontSize:7,color:`${DG}55`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{display:"flex",alignItems:"center",gap:4}}>
        <button onClick={undo} disabled={histIdx<=0} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${DG}30`,background:histIdx>0?`${DG}10`:"transparent",cursor:histIdx>0?"pointer":"default",fontSize:10,color:histIdx>0?DG:`${DG}33`,fontWeight:600}}>↩</button>
        <button onClick={redo} disabled={histIdx>=history.length-1} style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${DG}30`,background:histIdx<history.length-1?`${DG}10`:"transparent",cursor:histIdx<history.length-1?"pointer":"default",fontSize:10,color:histIdx<history.length-1?DG:`${DG}33`,fontWeight:600}}>↪</button>
        {yard?(()=>{const xs=yard.v.map(v=>v.x),ys=yard.v.map(v=>v.y),yw=p2f(Math.max(...xs)-Math.min(...xs)),yh=p2f(Math.max(...ys)-Math.min(...ys));return`${fmt(yw)}×${fmt(yh)} yard`;})():`${vb.wf}×${vb.hf}ft`} · 6" snap
      </span>
      <div style={{display:"flex",alignItems:"center",gap:3}}>
        <span style={{marginRight:2}}>Grid:</span>
        {[["Off",0],["Light",1],["Strong",2]].map(([l,v])=><button key={v} onClick={()=>setGridLvl(v)} style={{padding:"1px 5px",borderRadius:3,border:`1px solid ${gridLvl===v?DG:`${DG}30`}`,background:gridLvl===v?`${DG}15`:"transparent",fontSize:7,fontWeight:gridLvl===v?700:400,cursor:"pointer",color:DG}}>{l}</button>)}
      </div>
    </div>
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:6,minHeight:0}}>
      <svg ref={ref} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="xMinYMin meet" style={{width:"100%",maxHeight:"100%",borderRadius:8,cursor:isD||placing?"crosshair":drag||eDrag||rDrag!==null?"grabbing":"default",background:"#ede5c7",border:`1.5px solid ${DG}20`,touchAction:"none"}} onClick={hClick} onMouseMove={hMove} onMouseUp={hUp} onMouseLeave={hUp} onTouchStart={e=>{if(isD||placing)hClick(e);}} onTouchMove={hMove} onTouchEnd={hUp}>
        <Pats render={false}/>
        {gridLvl>0&&Array.from({length:Math.floor(CW/gSt)+1}).map((_,i)=><line key={`v${i}`} x1={i*gSt} y1={0} x2={i*gSt} y2={CH} stroke={DG} strokeWidth={i%mE===0?(gridLvl===2?1:.5):(gridLvl===2?.4:.15)} opacity={i%mE===0?(gridLvl===2?.3:.15):(gridLvl===2?.14:.06)}/>)}
        {gridLvl>0&&Array.from({length:Math.floor(CH/gSt)+1}).map((_,i)=><line key={`h${i}`} x1={0} y1={i*gSt} x2={CW} y2={i*gSt} stroke={DG} strokeWidth={i%mE===0?(gridLvl===2?1:.5):(gridLvl===2?.4:.15)} opacity={i%mE===0?(gridLvl===2?.3:.15):(gridLvl===2?.14:.06)}/>)}
        {gridLvl>0&&Array.from({length:Math.floor(vb.wf/10)+1}).map((_,i)=>i>0&&<text key={`xl${i}`} x={f2p(i*10)} y={10} textAnchor="middle" fill={DG} fontSize="7" opacity={gridLvl===2?".4":".25"}>{i*10}'</text>)}
        {gridLvl>0&&Array.from({length:Math.floor(vb.hf/10)+1}).map((_,i)=>i>0&&<text key={`yl${i}`} x={6} y={f2p(i*10)+3} fill={DG} fontSize="7" opacity={gridLvl===2?".4":".25"}>{i*10}'</text>)}
        {/* 1ft grid labels for strong mode */}
        {gridLvl===2&&Array.from({length:Math.floor(vb.wf/5)+1}).map((_,i)=>i>0&&i*5%10!==0&&<text key={`xl5_${i}`} x={f2p(i*5)} y={10} textAnchor="middle" fill={DG} fontSize="5.5" opacity=".2">{i*5}'</text>)}
        {gridLvl===2&&Array.from({length:Math.floor(vb.hf/5)+1}).map((_,i)=>i>0&&i*5%10!==0&&<text key={`yl5_${i}`} x={6} y={f2p(i*5)+3} fill={DG} fontSize="5.5" opacity=".2">{i*5}'</text>)}
        <g transform={`translate(20,${CH-12})`}><line x1="0" y1="0" x2={f2p(10)} y2="0" stroke={DG} strokeWidth="1.5" opacity=".3"/><text x={f2p(5)} y="-4" textAnchor="middle" fill={DG} fontSize="7" opacity=".4">10ft</text></g>
        {yard&&<polygon points={yard.v.map(v=>`${v.x},${v.y}`).join(" ")} fill={`${DG}08`} stroke={DG} strokeWidth="1.5" strokeDasharray="8 4" opacity=".5"/>}
        {zones.map((z,i)=>renderZone(z,i,sel?.type==='zone'&&sel.idx===i,true))}
        {greens.map((g,i)=>renderGreen(g,i,sel?.type==='green'&&sel.idx===i,true))}
        {pvs.map((st,i)=>renderPv(st,i,selPv===i,true))}
        {fps.map((fp,i)=>renderFp(fp,i,selFp===i,true))}
        {/* Walls */}
        {walls.map((w,i)=>{const isSel=sel?.type==='wall'&&sel.idx===i;return(<g key={`w${i}`} onClick={e=>{e.stopPropagation();if(!isD&&!placing){setSel({type:'wall',idx:i});setSelPv(null);setSelFp(null);}}} style={{cursor:"pointer"}}><polyline points={w.pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={isSel?"#c87830":"#8B6914"} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" filter={isSel?"url(#sel)":"url(#zsh)"}/>{w.pts.slice(0,-1).map((a,j)=>{const b=w.pts[j+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,sign=w.side==='left'?1:-1,cnt=Math.max(1,Math.floor(len/f2p(2)));return Array.from({length:cnt}).map((_,k)=>{const t=(k+1)/(cnt+1),mx=a.x+dx*t,my=a.y+dy*t;return<line key={`wh${j}-${k}`} x1={mx} y1={my} x2={mx+nx*8*sign} y2={my+ny*8*sign} stroke="#8B6914" strokeWidth={1.5}/>;});})}{(()=>{const mid=w.pts[Math.floor(w.pts.length/2)];return(<><rect x={mid.x-20} y={mid.y-10} width={40} height={18} rx={3} fill="rgba(255,255,255,.92)"/><text x={mid.x} y={mid.y+3} textAnchor="middle" fill="#8B6914" fontSize="8" fontWeight="600">{(w.height||24)}" wall</text></>);})()}{isSel&&w.pts.map((p,j)=><g key={`wv${j}`} onMouseDown={e=>hDown(e,'v',{t:'z',i:j,idx:i,layer:'wall'})} onTouchStart={e=>hDown(e,'v',{t:'z',i:j,idx:i,layer:'wall'})} style={{cursor:"grab"}}><circle cx={p.x} cy={p.y} r={12} fill="transparent"/><circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#8B6914" strokeWidth={2}/></g>)}</g>);})}
        {/* Vertex handles */}
        {yard&&!isD&&!placing&&yard.v.map((v,i)=><g key={`yv${i}`} onMouseDown={e=>hDown(e,'v',{t:'y',i})} onTouchStart={e=>hDown(e,'v',{t:'y',i})} style={{cursor:"grab"}}><circle cx={v.x} cy={v.y} r={12} fill="transparent"/><circle cx={v.x} cy={v.y} r={4.5} fill="#fff" stroke={DG} strokeWidth="2"/></g>)}
        {selZ&&!isD&&!placing&&(selZ.type==='circle'?<g onMouseDown={e=>hDown(e,'v',{t:'z',i:0,idx:sel.idx,layer:'zone'})} onTouchStart={e=>hDown(e,'v',{t:'z',i:0,idx:sel.idx,layer:'zone'})} style={{cursor:"grab"}}><circle cx={selZ.cx} cy={selZ.cy} r={14} fill="transparent"/><circle cx={selZ.cx} cy={selZ.cy} r={5} fill="#fff" stroke="#c87830" strokeWidth="2"/></g>:selZ.pts.map((v,i)=><g key={i} onMouseDown={e=>hDown(e,'v',{t:'z',i,idx:sel.idx,layer:'zone'})} onTouchStart={e=>hDown(e,'v',{t:'z',i,idx:sel.idx,layer:'zone'})} style={{cursor:"grab"}}><circle cx={v.x} cy={v.y} r={14} fill="transparent"/><circle cx={v.x} cy={v.y} r={5} fill="#fff" stroke="#c87830" strokeWidth="2"/></g>))}
        {selG&&!isD&&!placing&&(selG.type==='circle'?<g onMouseDown={e=>hDown(e,'v',{t:'z',i:0,idx:sel.idx,layer:'green'})} onTouchStart={e=>hDown(e,'v',{t:'z',i:0,idx:sel.idx,layer:'green'})} style={{cursor:"grab"}}><circle cx={selG.cx} cy={selG.cy} r={14} fill="transparent"/><circle cx={selG.cx} cy={selG.cy} r={5} fill="#fff" stroke="#c87830" strokeWidth="2"/></g>:selG.pts.map((v,i)=><g key={i} onMouseDown={e=>hDown(e,'v',{t:'z',i,idx:sel.idx,layer:'green'})} onTouchStart={e=>hDown(e,'v',{t:'z',i,idx:sel.idx,layer:'green'})} style={{cursor:"grab"}}><circle cx={v.x} cy={v.y} r={14} fill="transparent"/><circle cx={v.x} cy={v.y} r={5} fill="#fff" stroke="#c87830" strokeWidth="2"/></g>))}
        {/* Yard dims */}
        {yard&&!isD&&!placing&&yard.v.map((v,i)=>{const j=(i+1)%yard.v.length,w=yard.v[j],mx=(v.x+w.x)/2,my=(v.y+w.y)/2,f=p2f(Math.hypot(w.x-v.x,w.y-v.y));if(f<2)return null;const lb=fmt(f),lw=lb.length*5+8;return(<g key={`d${i}`}><rect x={mx-lw/2} y={my-8} width={lw} height={14} rx={3} fill="rgba(255,255,255,.92)"/><text x={mx} y={my+2} textAnchor="middle" fill={DG} fontSize="7" fontWeight="600">{lb}</text></g>);})}
        {/* Drawing */}
        {/* Live dimensions on placed segments */}
        {isD&&cur.length>=2&&cur.map((v,i)=>{if(i===0)return null;const prev=cur[i-1],mx=(prev.x+v.x)/2,my=(prev.y+v.y)/2,d=p2f(Math.hypot(v.x-prev.x,v.y-prev.y));if(d<1)return null;const lb=fmt(d),lw=lb.length*5+8,col=dY?"#c87830":dMode==='green'?PUT.color:dMode==='wall'?"#8B6914":DG;return(<g key={`ld${i}`}><rect x={mx-lw/2} y={my-18} width={lw} height={14} rx={3} fill={col} opacity=".85"/><text x={mx} y={my-8} textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="600">{lb}</text></g>);})}
        {/* Rect tool preview */}
        {dMode&&tool==="rect"&&rectStart.current&&hov&&<rect x={Math.min(rectStart.current.x,hov.x)} y={Math.min(rectStart.current.y,hov.y)} width={Math.abs(hov.x-rectStart.current.x)} height={Math.abs(hov.y-rectStart.current.y)} fill={dMode==='green'?"#2a5e2033":`${BS.find(x=>x.id===actS)?.color||DG}33`} stroke={dMode==='green'?PUT.color:DG} strokeWidth="1.5" strokeDasharray="6 3"/>}
        {isD&&cur.length>=2&&<polyline points={cur.map(v=>`${v.x},${v.y}`).join(" ")} fill="none" stroke={dY?"#c87830":dMode==='green'?PUT.color:dMode==='wall'?"#8B6914":DG} strokeWidth={dMode==='wall'?4:2} strokeDasharray="6 3"/>}
        {isD&&hov&&cur.length>0&&!cDrag&&<line x1={cur[cur.length-1].x} y1={cur[cur.length-1].y} x2={hov.x} y2={hov.y} stroke={dY?"#c87830":dMode==='green'?PUT.color:DG} strokeWidth="1.5" strokeDasharray="4 3" opacity=".5"/>}
        {isD&&ld&&!cDrag&&(()=>{const lb=fmt(ld.d),lw=lb.length*5+10,col=dY?"#c87830":dMode==='green'?PUT.color:DG;return(<g><rect x={ld.x-lw/2} y={ld.y-20} width={lw} height={16} rx={3} fill={col} opacity=".92"/><text x={ld.x} y={ld.y-9} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{lb}</text></g>);})()}
        {cDrag&&hov?.r&&(()=>{const rf=p2f(hov.r),lb=fmt(rf)+" r",sf=cSF(hov.r);return(<><circle cx={cDrag.cx} cy={cDrag.cy} r={hov.r} fill={dMode==='green'?"#2a5e2033":`${BS.find(x=>x.id===actS)?.color}33`} stroke={dMode==='green'?PUT.color:DG} strokeWidth="1.5" strokeDasharray="6 3"/><rect x={cDrag.cx-34} y={cDrag.cy-9} width={68} height={18} rx={3} fill={dMode==='green'?PUT.color:DG} opacity=".92"/><text x={cDrag.cx} y={cDrag.cy+3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{lb} · {sf.toFixed(0)}sf</text></>);})()}
        {isD&&cur.map((v,i)=>{const col=dY?"#c87830":dMode==='green'?PUT.color:dMode==='wall'?"#8B6914":DG;return(<g key={i}><circle cx={v.x} cy={v.y} r={i===0&&cur.length>=4?14:6} fill={i===0&&cur.length>=4?col:"#fff"} stroke={i===0&&cur.length>=4?"#fff":col} strokeWidth="2" opacity={i===0&&cur.length>=4?.8:1}/>{i===0&&cur.length>=4&&dMode!=='wall'&&<text x={v.x} y={v.y-16} textAnchor="middle" fill={col} fontSize="8" fontWeight="600">tap to close</text>}</g>);})}
        {placing==='fp'&&hov&&<circle cx={hov.x} cy={hov.y} r={FPR_PX} fill="#44444433" stroke="#555" strokeWidth="1" strokeDasharray="4 3"/>}
        {/* Walkway preview */}
        {placing==='paver'&&pvMode==='walkway'&&pvStart&&hov&&(()=>{const dx=hov.x-pvStart.x,dy=hov.y-pvStart.y,dist=Math.hypot(dx,dy);if(dist<1)return null;const ux=dx/dist,uy=dy/dist,stepPx=f2p(pvCfg.spacing),rot=Math.round(Math.atan2(uy,ux)*180/Math.PI/5)*5;return(<g>{Array.from({length:pvCfg.count-1}).map((_,i)=>{const px=pvStart.x+ux*stepPx*(i+1),py=pvStart.y+uy*stepPx*(i+1);return<rect key={i} x={px-PW_PX/2} y={py-PH_PX/2} width={PW_PX} height={PH_PX} rx={2} fill="#a0804033" stroke="#a08040" strokeWidth=".7" strokeDasharray="3 2" transform={`rotate(${rot} ${px} ${py})`}/>;})}<line x1={pvStart.x} y1={pvStart.y} x2={pvStart.x+ux*stepPx*(pvCfg.count-1)} y2={pvStart.y+uy*stepPx*(pvCfg.count-1)} stroke="#a08040" strokeWidth=".5" strokeDasharray="4 3" opacity=".4"/></g>);})()}
        {/* Patio preview */}
        {placing==='paver'&&pvMode==='patio'&&hov&&(()=>{const gapPx=f2p(pvCfg.gap+PW);return(<g>{Array.from({length:pvCfg.rows}).map((_,r)=>Array.from({length:pvCfg.cols}).map((_,c)=>{const px=hov.x+c*gapPx,py=hov.y+r*gapPx;return<rect key={`${r}-${c}`} x={px-PW_PX/2} y={py-PH_PX/2} width={PW_PX} height={PH_PX} rx={2} fill="#a0804033" stroke="#a08040" strokeWidth=".7" strokeDasharray="3 2"/>;}))}</g>);})()}
        {/* Straight-line constraint indicator */}
        {straight&&(dY||dMode)&&hov&&(()=>{const pts=dY?yd:dPts;if(!pts.length)return null;const last=pts[pts.length-1],isH=Math.abs(hov.x-last.x)>=Math.abs(hov.y-last.y);return<line x1={last.x} y1={last.y} x2={isH?hov.x:last.x} y2={isH?last.y:hov.y} stroke={isH?"#3080d0":"#30a040"} strokeWidth="1.2" strokeDasharray="6 3" opacity=".6"/>;})()}
        {/* Alignment guides */}
        {(isD||placing)&&hov&&guides.vLines.map((x,i)=><line key={`gv${i}`} x1={x} y1={0} x2={x} y2={CH} stroke="#e06020" strokeWidth=".8" strokeDasharray="4 4" opacity=".55"/>)}
        {(isD||placing)&&hov&&guides.hLines.map((y,i)=><line key={`gh${i}`} x1={0} y1={y} x2={CW} y2={y} stroke="#e06020" strokeWidth=".8" strokeDasharray="4 4" opacity=".55"/>)}
        {/* Paver spacing labels */}
        {(placing==='paver'||selPv!==null)&&pvDists.map((d,i)=>{const lb=fmt(d.d),lw=lb.length*4.5+8;return(<g key={`pd${i}`}><line x1={d.ax} y1={d.ay} x2={d.bx} y2={d.by} stroke="#a08040" strokeWidth=".7" strokeDasharray="3 2" opacity=".6"/><rect x={d.mx-lw/2} y={d.my-7} width={lw} height={13} rx={3} fill="rgba(255,255,255,.92)" stroke="#a0804044" strokeWidth=".5"/><text x={d.mx} y={d.my+2.5} textAnchor="middle" fill="#8a6a30" fontSize="6.5" fontFamily="'JetBrains Mono',monospace" fontWeight="600">{lb}</text></g>);})}
        {dY&&yd.length===0&&<><text x={CW/2} y={CH/2-20} textAnchor="middle" fill={`${DG}55`} fontSize="13" fontWeight="500">Tap to outline the yard</text><text x={CW/2} y={CH/2-4} textAnchor="middle" fill={`${DG}33`} fontSize="9">6" snap · Double-tap to close</text><text x={CW/2} y={CH/2+16} textAnchor="middle" fill={`${DG}55`} fontSize="10" fontWeight="600" style={{cursor:"pointer"}} onClick={e=>{e.stopPropagation();setShowLayout(true);}}>— or —</text><rect x={CW/2-55} y={CH/2+26} width={110} height={30} rx={6} fill={DG} style={{cursor:"pointer"}} onClick={e=>{e.stopPropagation();setShowLayout(true);}}/><text x={CW/2} y={CH/2+45} textAnchor="middle" fill={CREAM} fontSize="10" fontWeight="600" style={{cursor:"pointer",pointerEvents:"none"}}>Quick Layout</text></>}
      </svg>
    </div>
    {hasC&&!isD&&!placing&&<div style={{padding:"5px 10px",borderTop:`1px solid ${DG}12`,display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:8,color:`${DG}66`}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{bI.filter(l=>l.netSF>0).map((l,i)=><span key={i}>{l.name} {l.netSF.toFixed(0)}sf</span>)}{tGSF>0&&<span>Putting {tGSF.toFixed(0)}sf</span>}{pvs.length>0&&<span>{pvs.length} pavers</span>}{fps.length>0&&<span>{fps.length} fire pit{fps.length>1?"s":""}</span>}{walls.length>0&&<span>{walls.length} wall{walls.length>1?"s":""}</span>}</div>
      <span style={{color:DG,fontWeight:600,fontSize:10}}>${grand.toFixed(0)}</span>
    </div>}
  </div>
</div>}
</div>);
}
