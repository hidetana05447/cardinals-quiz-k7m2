// 野球ルールクイズ（デモ）：静的サイト＋JSON。サーバーなし。スマホ前提の3画面構成。
//  ① 出題（クイズだけ）→ ② 解説（回答の後、キャラが解説）→ ③ 結果
// 動きは Motion（バネ）。?plain=1 で、標準の動きに切り替えて比べられる
const Q=new URLSearchParams(location.search);
const PLAIN=Q.has('plain');
let motionAnimate=null;
if(!PLAIN){try{({animate:motionAnimate}=await import('https://cdn.jsdelivr.net/npm/motion@14.12.0/+esm'))}catch(e){console.warn('Motion読み込み失敗。標準の動きに切り替え',e)}}
const USE_MOTION=!!motionAnimate;
import {drawDiagram} from './diagram.js';
import {GEN} from './gen.js';
const $=id=>document.getElementById(id);

// ---- 動きの共通関数（Motionがあればバネ、なければ標準）----
function pop(el,{from=0}={}){
  if(USE_MOTION)return motionAnimate(el,{scale:[from,1],opacity:[0,1]},{type:'spring',stiffness:520,damping:11});
  return el.animate([{transform:`scale(${from})`,opacity:0},{transform:'scale(1)',opacity:1}],{duration:200,easing:'ease-out',fill:'both'});
}
function shake(el){
  if(USE_MOTION)return motionAnimate(el,{x:[0,-9,9,-6,6,0]},{duration:.4});
  return el.animate([{transform:'translateX(0)'},{transform:'translateX(-9px)'},{transform:'translateX(9px)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:400});
}
function slideIn(el){   // 画面の切り替え：横から入る（入りは減速）
  if(USE_MOTION)return motionAnimate(el,{x:[32,0],opacity:[0,1]},{type:'spring',stiffness:300,damping:28});
  return el.animate([{transform:'translateX(32px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:260,easing:'cubic-bezier(.05,.7,.1,1)',fill:'both'});
}
function countUp(el,to){
  if(USE_MOTION)motionAnimate(0,to,{duration:1.1,ease:'easeOut',onUpdate:v=>{el.firstChild.nodeValue=Math.round(v)}});
  else el.firstChild.nodeValue=to;
}

// ---- データ（questions.json）----
const DATA=await fetch('questions.json').then(r=>r.json());
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const PASS=60,PER_ROUND=5;let level=1,passed=false;
let order=[],idx=0,correctCount=0,phase='quiz',last=null,history=[];

// ---- キャラ：解説画面＝しゃべる（Museが生成）／合格＝2人のジャンプ／不合格＝静止画 ----
const MOVIE={explain:'img/chara_talk.webp',pass:'img/pair_jump.webp',fail:'img/chara_gakkari.webp'};
const STILL={explain:'img/wink.png',pass:'img/jump.png',fail:'img/run.png'};
function setChara(el,key){el.src=MOVIE[key]?MOVIE[key]+'?t='+Date.now():STILL[key]}   // ?t=で、動画を最初から再生し直す

// ---- 表示の切り替え ----
function showScreen(n){['s0','s1','s2','s3'].forEach(id=>$(id).classList.toggle('hidden',id!=='s'+n));$('src').classList.toggle('hidden',n!==0);const el=$('s'+n);slideIn(el);window.scrollTo(0,0)}
function setAct(text){const b=$('act');if(!text){b.classList.add('hidden');return}b.textContent=text;b.classList.remove('hidden');pop(b,{from:.92})}
function drawDots(){const d=$('dots');d.innerHTML='';order.forEach((_,i)=>{const e=document.createElement('i');if(i<=idx)e.className='on';d.appendChild(e)});$('prog').textContent=`だい ${idx+1} 問 / ${order.length} 問`}

function menu(){phase='menu';$('dots').innerHTML='';$('prog').textContent='';setAct(null);showScreen(0)}
// レベル1＝はじめて（diff0）／レベル2＝3〜6年（やさしい1・ふつう2・むずかしい2、やさしい順に出題）／レベル3＝鬼レベル（diff4だけ）
// ---- 「前に見た問題」を減らす工夫：①場面問題は、毎回、組み合わせを変えて自動生成 ②決まった問題は、見たことのないものを優先（ブラウザに記録。記録できなくても動く）
let seenSet=new Set();
try{seenSet=new Set(JSON.parse(localStorage.getItem('quizSeen')||'[]'))}catch(e){}
const markSeen=q=>{seenSet.add(q);try{localStorage.setItem('quizSeen',JSON.stringify([...seenSet].slice(-400)))}catch(e){}};
const rnd=n=>Math.floor(Math.random()*n);
function pickStatic(df,used){
  let pool=DATA.filter(d=>d.diff===df&&!used.has(d.q));
  const fresh=pool.filter(d=>!seenSet.has(d.q));
  if(fresh.length)pool=fresh;else pool.forEach(d=>seenSet.delete(d.q));   // 全部見たら、見た記録をリセット
  return pool[rnd(pool.length)];
}
// 1スロット＝1問。generators＝[[生成の種類,やさしさ],…]。pGen＝自動生成を使う確率
function slot(df,gens,pGen,used){
  for(let k=0;k<8;k++){
    let q;
    if(gens.length&&Math.random()<pGen){const [g,lv]=gens[rnd(gens.length)];q=GEN[g](lv);q.diff=df}else q=pickStatic(df,used);
    if(q&&!used.has(q.q)&&!seenSet.has(q.q)){used.add(q.q);return q}
    if(k===7&&q&&!used.has(q.q)){used.add(q.q);return q}
  }
  return pickStatic(df,new Set())
}
function makeOrder(){
  const used=new Set();
  if(level===1)return shuffle(DATA.filter(d=>d.diff===0)).slice(0,PER_ROUND);
  if(level===3){   // 鬼レベル：条件が複雑な場面問題を中心に
    const G=[['tori',0],['furi',3],['iff',3],['balk',3],['force',3]];
    return Array.from({length:PER_ROUND},()=>slot(4,G,.7,used));
  }
  return [   // 3〜6年生：やさしい1・ふつう2・むずかしい2（やさしい順）
    slot(1,[['force',1],['iff',1],['furi',1],['foul',1],['interf',1]],.6,used),
    slot(2,[['force',2],['iff',2],['balk',1],['furi',2],['tag',2],['foul',2],['interf',2]],.6,used),
    slot(2,[['force',2],['iff',2],['balk',1],['furi',2],['tag',2],['foul',2],['interf',2]],.6,used),
    slot(3,[['force',3],['iff',3],['balk',2],['furi',3],['tag',3],['interf',3],['foul',3]],.6,used),
    slot(3,[['force',3],['iff',3],['balk',2],['furi',3],['tag',3],['interf',3],['foul',3]],.6,used),
  ];
}
function start(){order=makeOrder();idx=0;correctCount=0;history=[];phase='quiz';showQuestion()}
function showQuestion(){
  phase='quiz';drawDots();setAct(null);
  const item=order[idx];markSeen(item.q);$('q').textContent=item.q;
  const opts=shuffle(item.choices.map((t,i)=>({t,ok:i===item.answer})));   // 選択肢と正解の位置をランダムに
  const f1=$('fig1');f1.classList.toggle('hidden',!item.diagram);if(item.diagram)drawDiagram(f1,item.diagram);
  const box=$('choices');box.innerHTML='';
  opts.forEach(o=>{
    const b=document.createElement('button');b.className='choice';b.textContent=o.t;
    const m=document.createElement('span');m.className='mark';b.appendChild(m);
    b._ok=o.ok;b.onclick=()=>answer(b,o.ok,box,item,opts);box.appendChild(b);
  });
  showScreen(1);
}
// ① 回答：その場で◯✕だけ見せる（解説は、次の画面）
function answer(btn,ok,box,item){
  [...box.children].forEach(b=>{b.disabled=true});
  const mark=btn.querySelector('.mark');
  const right=[...box.children].find(b=>b._ok);
  if(ok){
    correctCount++;navigator.vibrate&&navigator.vibrate(30);btn.classList.add('right');mark.textContent='◯';pop(mark);
  }else{
    navigator.vibrate&&navigator.vibrate([20,40,20]);btn.classList.add('wrong');mark.textContent='✕';pop(mark,{from:.5});shake(btn);
    right.classList.add('right');const rm=right.querySelector('.mark');rm.textContent='◯';pop(rm);
  }
  last={ok,item,answerText:right.firstChild.nodeValue};history.push({ok,q:item.q,you:btn.firstChild.nodeValue,right:right.firstChild.nodeValue});phase='answered';
  setAct('解説を見る →');
}
// ② 解説
function showExplain(){
  phase='explain';const {ok,item,answerText}=last;
  $('vd').className='verdict '+(ok?'ok':'ng');$('vmark').textContent=ok?'◯':'✕';
  $('vtext').textContent=ok?'せいかい！':'おしい！';$('vans').textContent='こたえ：'+answerText;
  $('recap').textContent=item.q;$('bubble').textContent=item.explain;
  const f2=$('fig2');f2.classList.toggle('hidden',!item.diagram);if(item.diagram)drawDiagram(f2,item.diagram,{showArrows:true});
  const mo=$('more');mo.classList.toggle('hidden',!item.more);mo.innerHTML=item.more?'<b>ここがポイント</b><ul>'+item.more.map(t=>'<li></li>').join('')+'</ul>':'';if(item.more)[...mo.querySelectorAll('li')].forEach((li,i)=>li.textContent=item.more[i]);
  setChara($('chara'),'explain');
  showScreen(2);pop($('bubble'),{from:.94});
  setAct(idx+1<order.length?'次の問題へ →':'けっかを見る →');
}
// ③ 結果
function showResult(){
  phase='result';
  const score=Math.round(correctCount/order.length*100),pass=score>=PASS;passed=pass;
  const sc=$('score');sc.innerHTML='0<small>点</small>';sc.firstChild.nodeValue='0';
  const v=$('verdict2');v.textContent=pass?'合格！':'もうすこし！';v.className=pass?'pass':'fail';
  $('detail').textContent=`${order.length}問中 ${correctCount}問せいかい（合格ライン ${PASS}点）`;
  const rv=$('review');rv.innerHTML='<h3>今回の問題（どこを まちがえた？）</h3>';
  history.forEach((h,i)=>{const r=document.createElement('div');r.className='rv '+(h.ok?'ok':'ng');
    const m=document.createElement('span');m.className='m';m.textContent=h.ok?'◯':'✕';
    const t=document.createElement('div');t.className='t';t.append(`${i+1}. ${h.q}`);
    const s=document.createElement('small');
    if(h.ok){s.textContent='こたえ：'+h.right}else{const a=document.createElement('span');a.className='you';a.textContent='えらんだ答え：'+h.you;const b=document.createElement('span');b.className='ans';b.textContent='正しい答え：'+h.right;s.append(a,document.createElement('br'),b)}
    t.append(s);r.append(m,t);rv.append(r)});
  setChara($('chara3'),pass?'pass':'fail');
  showScreen(3);countUp(sc,score);pop(v,{from:.4});
  setAct(pass?'ほかのレベルであそぶ':'もう一度チャレンジ');
}
// 下の固定ボタン：いまの場面に応じて動く
$('act').onclick=()=>{
  if(phase==='answered')showExplain();
  else if(phase==='explain'){idx++;if(idx<order.length)showQuestion();else showResult()}
  else if(phase==='result'){passed?menu():start()}
};
document.querySelectorAll('.lv').forEach(b=>b.onclick=()=>{level=+b.dataset.lv;start()});
menu();
if(Q.has('dev'))$('devLinks').innerHTML=(USE_MOTION?'動き：Motion ／ <a href="?dev=1&plain=1">Motionなしで見る</a>':'動き：標準 ／ <a href="?dev=1">Motionありで見る</a>');
