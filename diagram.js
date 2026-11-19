// 図解の部品：ダイヤモンド図をデータ（JSON）から描く。サーバー・ライブラリなし（SVGだけ）
// diagram の形：{ runners:["1","2","3"], outs:1, you:"SS", arrows:[{from:"1",to:"2"}] }
// 座標は 200x200 の盤面。home/1/2/3＝ベース、守備位置は下の POS
const BASE={H:[100,172],'1':[152,120],'2':[100,68],'3':[48,120]};
const POS={P:[100,120],C:[100,188],'1B':[138,108],'2B':[124,84],SS:[76,84],'3B':[62,108],LF:[36,56],CF:[100,30],RF:[164,56]};
const PT=k=>BASE[k]||POS[k];
const NS='http://www.w3.org/2000/svg';
const el=(n,a={},p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);p&&p.appendChild(e);return e};
const dia=(c,s=7)=>`${c[0]},${c[1]-s} ${c[0]+s},${c[1]} ${c[0]},${c[1]+s} ${c[0]-s},${c[1]}`;

export function drawDiagram(host,d,{showArrows=false}={}){
  host.innerHTML='';
  const svg=el('svg',{viewBox:'0 0 200 214',role:'img','aria-label':'野球の場面の図'},host);
  svg.style.cssText='width:100%;height:auto;display:block';
  // 外野の芝（扇形）と内野の土（ひし形）
  el('path',{d:'M100 172 L8 80 A130 130 0 0 1 192 80 Z',fill:'#e4ecd9'},svg);
  el('polygon',{points:[BASE.H,BASE['1'],BASE['2'],BASE['3']].map(p=>p.join(',')).join(' '),fill:'#f3e6cf',stroke:'#16181c','stroke-width':2},svg);
  // 守備位置：小さな点（選手の目安）
  Object.entries(POS).forEach(([k,p])=>{if(k===d.you)return;el('circle',{cx:p[0],cy:p[1],r:3.2,fill:'#9aa08f'},svg)});
  // ベース＋走者
  ['1','2','3'].forEach(k=>{
    const run=(d.runners||[]).includes(k);
    el('polygon',{points:dia(BASE[k]),fill:run?'#d6001c':'#fff',stroke:'#16181c','stroke-width':2},svg);
  });
  el('polygon',{points:`${BASE.H[0]-6},${BASE.H[1]-5} ${BASE.H[0]+6},${BASE.H[1]-5} ${BASE.H[0]+6},${BASE.H[1]+1} ${BASE.H[0]},${BASE.H[1]+7} ${BASE.H[0]-6},${BASE.H[1]+1}`,fill:'#fff',stroke:'#16181c','stroke-width':2},svg);
  // 自分の守備位置（★の代わりに、大きな丸＋ラベル）
  if(d.you){const p=PT(d.you);
    el('circle',{cx:p[0],cy:p[1],r:11,fill:'#f5a300',stroke:'#16181c','stroke-width':2.5},svg);
    const t=el('text',{x:p[0],y:p[1]+3.5,'text-anchor':'middle','font-size':9,'font-weight':900,fill:'#16181c'},svg);t.textContent='きみ'}
  // アウト数（左下）
  // 実際のアウトの丸
  [0,1,2].forEach(i=>el('circle',{cx:112+i*16,cy:201,r:5.5,fill:i<(d.outs||0)?'#16181c':'#fff',stroke:'#16181c','stroke-width':2},svg));
  el('text',{x:4,y:204,'font-size':11,'font-weight':700,fill:'#16181c'},svg).textContent='アウト';
  // 正解の動き（矢印）：解説の画面だけ。線が先に描かれていくアニメ
  if(showArrows&&d.arrows){
    const defs=el('defs',{},svg);
    const m=el('marker',{id:'ah',viewBox:'0 0 10 10',refX:6,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'},defs);
    el('path',{d:'M0 0L10 5L0 10z',fill:'#1b9e4b'},m);
    d.arrows.forEach((a,i)=>{
      const s=PT(a.from),e=PT(a.to),L=Math.hypot(e[0]-s[0],e[1]-s[1]),k=14/L;   // 端を少し縮めて、図形に重ならないように
      const x1=s[0]+(e[0]-s[0])*k,y1=s[1]+(e[1]-s[1])*k,x2=e[0]-(e[0]-s[0])*k,y2=e[1]-(e[1]-s[1])*k,len=Math.hypot(x2-x1,y2-y1);
      const ln=el('line',{x1,y1,x2,y2,stroke:'#1b9e4b','stroke-width':4,'stroke-linecap':'round','marker-end':'url(#ah)','stroke-dasharray':len,'stroke-dashoffset':len},svg);
      ln.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:600,delay:300+i*500,easing:'ease-out',fill:'forwards'});
    });
  }
  return svg;
}
