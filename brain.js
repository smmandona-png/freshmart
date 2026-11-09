'use strict';
/* FreshMart v4 add-on: smarter commands, expenses, stock removal, refresh */
(function(){
const KE='freshmart.expenses.v1',KA='freshmart.adjust.v1';
let E=load(KE,[]),A=load(KA,[]),PICK=[],viaMic=false,busy=0,rfBusy=false,dmg=null;
const lock=()=>{if(Date.now()-busy<700)return true;busy=Date.now();return false};
const sheet=h=>{$('vpanel').innerHTML=h;$('vsheet').classList.add('on')};
const day0=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const sum=(a,f)=>a.reduce((x,y)=>x+f(y),0);
function speak(t){if(!viaMic)return;try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t))}catch(e){}}
function sanitize(){P.forEach(p=>{p.qty=Math.max(0,+p.qty||0);p.cost=+p.cost||0;p.sell=+p.sell||0;p.low=+p.low||0})}

/* ---------- fuzzy product matching ---------- */
const lev=(a,b)=>{const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]};
const SZ=/\d+(?:\.\d+)?\s*(?:kg|g|ml|l|lb)\b/i;
const toks=s=>s.toLowerCase().replace(SZ,' ').split(/[^a-z0-9]+/).filter(x=>x.length>1);
function score(pn,qn){
  const pb=key(pn.replace(SZ,'')),qb=key(qn.replace(SZ,''));
  if(pb.length<2||qb.length<2)return 0;
  const ps=sizeOf(pn),qs=sizeOf(qn);if(ps&&qs&&ps!==qs)return 0;
  if(pb===qb)return 100;
  const mn=Math.min(pb.length,qb.length);
  if(mn>=3&&(pb.startsWith(qb)||qb.startsWith(pb)))return 90;
  if(mn>=3&&(pb.includes(qb)||qb.includes(pb)))return 78;
  const pt=toks(pn),qt=toks(qn);
  const hit=(a,b)=>a.every(x=>b.some(y=>x===y||(x.length>3&&1-lev(x,y)/Math.max(x.length,y.length)>=.75)));
  if(qt.length&&hit(qt,pt))return 82;
  if(pt.length&&hit(pt,qt))return 70;
  const r=1-lev(pb,qb)/Math.max(pb.length,qb.length);
  return r>=.72?Math.round(50+r*25):0;
}
function cands(name){
  const l=P.map(p=>({p,s:score(p.name,name)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  if(!l.length)return {kind:'none'};
  const top=l[0].s;
  const g=top>=100?l.filter(x=>x.s>=100):l.filter(x=>x.s>=top-6);
  return g.length===1?{kind:'one',p:g[0].p}:{kind:'many',list:g.slice(0,5).map(x=>x.p)};
}
function askWhich(title,opts,cb){
  PICK=opts;
  sheet(`<h2>${esc(title)}</h2><div class="muted">Tap the right one.</div>`+opts.map((o,i)=>`<button class="btn s" style="margin-top:8px;text-align:left" onclick="BR.pick(${i})">${esc(o.label)}</button>`).join('')+`<div class="acts"><button class="btn s" onclick="closeV()">Cancel</button></div>`);
  askWhich.cb=cb;
}
function resolve(items,done){
  const out=[];let i=0;
  (function next(){
    if(i>=items.length)return done(out);
    const it=items[i++],c=cands(it.name);
    if(c.kind==='one'){out.push({it,p:c.p});return next()}
    if(c.kind==='none'){out.push({it,p:null});return next()}
    askWhich('Which "'+it.name+'" do you mean?',c.list.map(p=>({label:p.name+' · '+M(p.sell)+' · '+fmt(p.qty)+' in stock',val:p})),v=>{out.push({it,p:v});next()});
  })();
}

/* ---------- understanding the sentence ---------- */
const UNITS=/\b(crates?|boxes|box|sacks?|trays?|cartons?|bundles?|sachets?)\b/g;
const STOCKPH=/\b(?:to|into|in|from|on)\s+(?:the\s+|my\s+|our\s+)?(?:stock|inventory|store|shelf|shelves)\b/g;
function classify(t){
  const n=/\d/.test(t),sellw=/^(?:sold|sell)\b|\bsold\b/.test(t);
  if(!n&&/\b(running (low|out)|low stock|out of stock|nearly finished|almost finished|need restock|restock list|finished)\b/.test(t))return 'low';
  if(/^(what|how much|show|tell|give|list)\b.*\b(spent|spend|expenses?)\b/.test(t))return 'sales';
  if(/^(what|how much|how many|show|tell|give|list)\b.*\b(sold|sell|sales|made|takings|income|profit)\b/.test(t)||/\b(today'?s sales|sales today|sales summary)\b/.test(t))return 'sales';
  if(/^(how many|how much|do we|are there|is there|what'?s the stock|what is the stock|check|stock (of|for)|quantity of)\b/.test(t)&&!sellw)return 'query';
  if(n&&!sellw&&/\b(spent|spend|paid|expense|expenses|pay)\b/.test(t))return 'expense';
  if(/\b(remove|removed|damaged|expired|spoilt|spoiled|lost|broken|stolen|write off|throw away|thrown away|dispose)\b/.test(t))return 'damage';
  if(sellw)return 'sell';
  if(/^(add|added|bought|buy|received|got|purchased|restock|restocked|stock|delivered|new)\b|\b(bought|received|purchased|delivered|cost|selling|markup)\b/.test(t))return 'stock';
  return null;
}
const priceToCost=t=>t.replace(/\b(?:at|for|@)\s+(\d+(?:\.\d+)?)(?:\s+(?:each|apiece|per\s+[a-z]+))?/g,' cost $1 ');
const dropPrice=t=>t.replace(/\b(?:at|for|@)\s+(\d+(?:\.\d+)?)(?:\s+(?:each|apiece|per\s+[a-z]+))?/g,' ');
const prep=t=>t.replace(STOCKPH,' ').replace(UNITS,' ');

window.runCmd=function(){
  const raw=$('qa').value.trim();
  if(!raw)return alert(mode==='sell'?'Say or type what was sold, e.g. sold 2 bread and 1 sugar':'Say or type what you want, e.g. add 10 bread cost 12 selling 15');  let t=norm(raw.replace(/[?!]/g,' '));
  t=t.replace(/^(?:(?:i|we|just|have|had|please|can you|could you|kindly|ok|okay|hey|freshmart)\b\s*)+/,'');
  const k=classify(t)||(mode==='sell'?'sell':'stock');
  $('qa').value='';
  ({low:showLow,sales:showSales,query:doQuery,expense:doExpense,damage:doDamage,sell:doSell,stock:doStock})[k](t);
  viaMic=false;
};

/* ---------- stock in ---------- */
function doStock(t){
  const items=parseAll(priceToCost(prep(t)));
  if(!items.length)return alert('I could not understand that. Try: add 10 bread cost 12 selling 15');
  resolve(items,res=>{
    res.forEach(r=>{if(r.p)r.it.name=r.p.name});
    startStock(res.map(r=>r.it));
  });
}
/* ---------- sell ---------- */
function doSell(t){
  const items=parseAll(dropPrice(prep(t)));
  if(!items.length)return alert('I could not understand that. Try: sold 2 bread and 1 sugar');
  resolve(items,res=>{
    cart=[];miss=[];givenVal='';
    res.forEach(r=>{if(r.p)addCart(r.p.id,r.it.qty===null?1:r.it.qty);else miss.push(r.it.name)});
    if(!cart.length)return sheet(`<h2>Not found</h2><div class="muted">I could not find: <b>${esc(miss.join(', '))}</b> in your stock. Add it first with <b>Stock in</b>, or try saying the name again.</div><div class="acts"><button class="btn p" onclick="closeV()">OK</button></div>`);
    openSale();
  });
}
const _cs=window.confirmSale;
window.confirmSale=function(){
  if(lock())return;
  const over=cart.filter(c=>{const p=P.find(x=>x.id===c.id);return p&&c.qty>p.qty});
  if(over.length){busy=0;return alert('Not enough stock for: '+over.map(c=>{const p=P.find(x=>x.id===c.id);return p.name+' (you have '+fmt(p.qty)+')'}).join(', ')+'.\nReduce the quantity, or add stock first.')}
  _cs();
};
const _cst=window.confirmStock;
window.confirmStock=function(){if(!sl.length||lock())return;_cst()};

/* ---------- questions ---------- */
function doQuery(t){
  let n=t.replace(/\b(how many|how much|do we|we|still|have|has|left|remaining|remain|in stock|stock of|stock for|stock|is there|are there|any|check|what'?s|what is|the|of|on hand|available|do you|you|got|there|much|many|currently|now|show|me|tell|give|quantity|qty|count|is|are|in|on)\b/g,' ');
  n=n.replace(UNITS,' ').replace(/\b(products?|items?|goods)\b/g,' ').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
  if(!n)return alert('Which product? For example: how many eggs do we have left');
  const c=cands(n);let list=[];
  if(c.kind==='one')list=[c.p];else if(c.kind==='many')list=c.list;
  if(!list.length){speak('I could not find '+n);return sheet(`<h2>Not found</h2><div class="muted">I could not find <b>${esc(n)}</b> in your stock.</div><div class="acts"><button class="btn p" onclick="closeV()">OK</button></div>`)}
  speak(list.map(p=>'You have '+fmt(p.qty)+' '+p.name).join('. '));
  sheet(`<h2>📦 Stock check</h2>`+list.map(p=>{const s=status(p);return `<div class="ln"><div class="ln-n"><b>${esc(p.name)}</b><div class="ln-s">${M(p.sell)} each · cost ${M(p.cost)}</div></div><div class="ln-t ${s!=='ok'?'red':''}">${fmt(p.qty)} ${esc(p.unit||'pcs')}${s==='out'?'<br><small>OUT</small>':s==='low'?'<br><small>LOW</small>':''}</div></div>`}).join('')+`<div class="acts"><button class="btn p" onclick="closeV()">Close</button></div>`);
}
function showLow(){
  const L=P.filter(p=>status(p)!=='ok').sort((a,b)=>a.qty-b.qty);
  speak(L.length?L.length+' products are running low':'Nothing is running low');
  sheet(`<h2>⚠ Running low</h2>`+(L.length?L.map(p=>`<div class="ln"><div class="ln-n"><b>${esc(p.name)}</b><div class="ln-s">Alert at ${fmt(p.low)}</div></div><div class="ln-t red">${fmt(p.qty)}${p.qty<=0?'<br><small>OUT</small>':''}</div><button class="undo" style="background:var(--gl);color:var(--g)" onclick="closeV();openRec('${p.id}')">+ Stock</button></div>`).join(''):'<div class="empty">✅ Nothing is running low.</div>')+`<div class="acts"><button class="btn p" onclick="closeV()">Close</button></div>`);
}
function showSales(){
  const T=todaySales();
  speak('Today you sold '+M(sum(T,s=>s.total))+' in '+T.length+(T.length===1?' sale':' sales'));
  openSales();
}

/* ---------- expenses ---------- */
function doExpense(t){
  const m=t.match(/\d+(?:\.\d+)?/);if(!m)return alert('How much was it? Try: I spent 500 on transport');
  const amount=parseFloat(m[0]);
  const nm=t.match(/\b(?:on|for)\s+(.+)$/);
  let note=nm?nm[1]:t.replace(/\b(spent|spend|paid|pay|expense|expenses|on|for|the|a|an|to)\b/g,' ').replace(/\d+(?:\.\d+)?/g,' ');
  note=note.replace(/[.,;:]+/g,' ').replace(/\s+/g,' ').trim();
  note=note.replace(/\b[a-z]/,c=>c.toUpperCase());
  sheet(`<h2>💸 Record expense</h2><div class="muted">Money spent running the shop. It is not a sale or stock.</div>
  <label>Amount (${esc(CFG.cur)})</label><input id="exA" type="number" inputmode="decimal" step="0.01" value="${amount}">  <label>What was it for?</label><input id="exN" value="${esc(note)}" maxlength="40">
  <div class="acts"><button class="btn s" onclick="closeV()">Cancel</button><button class="btn p" onclick="BR.exOk()">Confirm &amp; save</button></div>`);
}
/* ---------- remove damaged / lost stock ---------- */
function doDamage(t){
  const m=t.match(/\d+(?:\.\d+)?/),qty=m?parseFloat(m[0]):1;
  const reason=/expired/.test(t)?'Expired':/lost|stolen/.test(t)?'Lost or stolen':/damag|broke|spoil/.test(t)?'Damaged':'Other';
  let n=t.replace(/\b(remove|removed|take|write|off|damaged?|expired|spoil(?:t|ed)|lost|broken|broke|stolen|throw|thrown|away|dispose|of|from|stock|inventory|products?|items?|goods|units?|because|they|are|is|were|was|have|has|got|out|the|a|an|my|our)\b/g,' ');
  n=n.replace(UNITS,' ').replace(/\d+(?:\.\d+)?/g,' ').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
  const go=p=>{if(p.qty<=0)return alert(p.name+' has no stock to remove.');damageSheet(p,Math.min(qty,p.qty),reason)};
  if(!n){
    if(!P.length)return alert('You have no products yet.');
    return askWhich('Which product to remove?',P.map(p=>({label:p.name+' · '+fmt(p.qty)+' in stock',val:p})),go);
  }
  const c=cands(n);
  if(c.kind==='none')return alert('I could not find "'+n+'" in your stock.');
  if(c.kind==='one')return go(c.p);
  askWhich('Which "'+n+'" do you mean?',c.list.map(p=>({label:p.name+' · '+fmt(p.qty)+' in stock',val:p})),go);
}
function damageSheet(p,qty,reason){
  dmg=p;
  const o=['Damaged','Expired','Lost or stolen','Other'].map(r=>`<option ${r===reason?'selected':''}>${r}</option>`).join('');
  sheet(`<h2>🗑 Remove from stock</h2><div class="muted">Recorded as lost stock, not as a sale.</div>
  <div class="sl"><b>${esc(p.name)}</b><div class="ln-s">In stock: ${fmt(p.qty)}</div>
  <div class="row"><div><label>Quantity to remove</label><input id="dmQ" type="number" inputmode="decimal" value="${qty}" oninput="BR.dmInfo()"></div>
  <div><label>Reason</label><select id="dmR">${o}</select></div></div><div class="ln-s" id="dmI"></div></div>
  <div class="acts"><button class="btn s" onclick="closeV()">Cancel</button><button class="btn p" onclick="BR.dmOk()">Confirm</button></div>`);
  dmInfo();
}
function dmInfo(){
  const q=+$('dmQ').value||0,p=dmg;
  $('dmI').innerHTML=q>p.qty?`<span class="red">You only have ${fmt(p.qty)} in stock.</span>`:`Stock ${fmt(p.qty)} → <b>${fmt(p.qty-q)}</b> · value lost ${M(q*p.cost)}`;
}
function dmOk(){
  if(lock())return;
  const q=+$('dmQ').value,p=P.find(x=>x.id===dmg.id);
  if(!p||!(q>0)){busy=0;return alert('Enter how many to remove.')}
  if(q>p.qty){busy=0;return alert('You only have '+fmt(p.qty)+' in stock.')}
  p.qty=rnd(p.qty-q);
  A.unshift({t:Date.now(),id:p.id,name:p.name,qty:q,reason:$('dmR').value,cost:p.cost});
  if(!saveP())return;put(KA,A);closeV();render();toast('Removed '+fmt(q)+' × '+p.name+' · recorded as '+$('dmR')?.value);
}
function exOk(){
  if(lock())return;
  const a=+$('exA').value;if(!(a>0)){busy=0;return alert('Enter the amount.')}
  E.unshift({t:Date.now(),amount:a,note:$('exN').value.trim()||'Expense'});
  put(KE,E);closeV();toast('Expense saved · '+M(a));
}
/* ---------- today's sheet shows expenses & removals ---------- */
const _os=window.openSales;
window.openSales=function(){
  _os();
  const d=day0(),ex=E.filter(e=>e.t>=d),ad=A.filter(a=>a.t>=d);
  if(!ex.length&&!ad.length)return;
  const prof=sum(todaySales(),s=>sum(s.lines,l=>(l.price-l.cost)*l.qty)),exT=sum(ex,e=>e.amount);
  const h=`<div class="hr"></div><h2 style="font-size:16px">Expenses &amp; removed stock today</h2>`+
  ex.map(e=>`<div class="sale"><div class="sn"><b>${M(e.amount)}</b> · ${esc(e.note)}</div><button class="undo" onclick="BR.delExp(${e.t})">Remove</button></div>`).join('')+
  ad.map(a=>`<div class="sale"><div class="sn"><b>−${fmt(a.qty)} × ${esc(a.name)}</b><br>${esc(a.reason)} · value lost ${M(a.qty*a.cost)}</div><button class="undo" onclick="BR.undoAdj(${a.t})">Undo</button></div>`).join('')+
  `<div class="muted" style="margin-top:8px">Profit after expenses: <b>${M(prof-exT)}</b></div>`;
  $('vpanel').innerHTML=$('vpanel').innerHTML.replace('<div class="acts">',h+'<div class="acts">');
};
function delExp(t){if(!confirm('Remove this expense?'))return;E=E.filter(e=>e.t!==t);put(KE,E);openSales()}
function undoAdj(t){
  const i=A.findIndex(a=>a.t===t);if(i<0)return;
  if(!confirm('Put these items back into stock?'))return;
  const p=P.find(x=>x.id===A[i].id);if(p)p.qty=rnd(p.qty+A[i].qty);
  A.splice(i,1);saveP();put(KA,A);render();openSales();
}
/* ---------- backup includes new records ---------- */
const _sb=window.showBackup,_rb=window.restoreBackup;
window.showBackup=function(){_sb();try{const d=JSON.parse($('bk').value);d.expenses=E;d.adjust=A;$('bk').value=JSON.stringify(d)}catch(e){}};window.restoreBackup=function(){
  let d=null;try{d=JSON.parse($('bk').value)}catch(e){}
  const before=P;_rb();
  if(d&&P!==before){E=Array.isArray(d.expenses)?d.expenses:[];A=Array.isArray(d.adjust)?d.adjust:[];put(KE,E);put(KA,A);sanitize()}
};

/* ---------- microphone ---------- */
window.mic=async function(){
  const r=await listen(mode==='sell'?'What was sold?':'Say a command');
  if(r.err){
    $('qa').focus();
    return toast(r.err==='denied'?'Microphone is blocked. Allow it in phone Settings > Apps > this app > Permissions.':'Tap the 🎤 on your keyboard, speak, then tap Go');
  }
  if(!r.text)return;
  addText(r.text);viaMic=true;
  const t=norm($('qa').value.replace(/[?!]/g,' ')).replace(/^(?:(?:i|we|just|have|had|please|can you|could you|kindly|ok|okay|hey|freshmart)\b\s*)+/,'');
  if(!classify(t)&&mode==='stock'){
    const need=()=>parseAll($('qa').value).some(it=>!findProduct(it.name,true)&&it.cost===null&&it.sell===null);
    if(need()){toast('Now say the cost and selling price');const r2=await listen('Now say the cost and selling price');if(r2.text)addText(r2.text)}
  }
  runCmd();
};

/* ---------- refresh ---------- */
const st=document.createElement('style');
st.textContent='#rf{position:fixed;top:0;left:0;right:0;height:4px;z-index:40;background:linear-gradient(90deg,transparent,var(--g),transparent);background-size:50% 100%;background-repeat:no-repeat;animation:rfm .8s linear infinite;display:none}@keyframes rfm{from{background-position:-50% 0}to{background-position:150% 0}}#ptr{position:fixed;top:64px;left:50%;transform:translateX(-50%);background:#17211c;color:#fff;border-radius:20px;padding:6px 14px;font-size:12px;z-index:40;display:none}.gear.spin{animation:sp .7s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}';
document.head.appendChild(st);
const bar=document.createElement('div');bar.id='rf';document.body.appendChild(bar);
const ptr=document.createElement('div');ptr.id='ptr';document.body.appendChild(ptr);
const rb=document.createElement('button');rb.className='gear';rb.id='rfBtn';rb.textContent='⟳';rb.setAttribute('aria-label','Refresh');rb.onclick=()=>refresh(true);
const hdr=document.querySelector('header');hdr.insertBefore(rb,hdr.querySelector('.gear'));
function anyOpen(){return document.querySelector('.sheet.on')!==null}
function refresh(manual){
  if(rfBusy)return;
  if(anyOpen())return toast('Finish or close this screen first, then refresh');
  rfBusy=true;bar.style.display='block';rb.classList.add('spin');
  setTimeout(()=>{
    try{
      const p=JSON.parse(localStorage.getItem(KP)||'[]'),s=JSON.parse(localStorage.getItem(KS)||'[]');
      if(!Array.isArray(p)||!Array.isArray(s))throw new Error('bad');
      P=p;S=s;E=load(KE,[]);A=load(KA,[]);
      CFG=Object.assign({name:'FreshMart',theme:'green',cur:'K',logo:null},load(KC,{}));
      sanitize();applyTheme();render();
      if(manual)toast('Up to date ✓  '+P.length+' products');
    }catch(e){toast('Could not refresh. Your saved data was not changed. Close and reopen the app.')}
    bar.style.display='none';rb.classList.remove('spin');rfBusy=false;
  },500);
}
let y0=null,dy=0;
document.addEventListener('touchstart',e=>{y0=(window.scrollY<=0&&!anyOpen())?e.touches[0].clientY:null;dy=0},{passive:true});
document.addEventListener('touchmove',e=>{if(y0===null)return;dy=e.touches[0].clientY-y0;if(dy>40){ptr.style.display='block';ptr.textContent=dy>90?'Release to refresh':'Pull down to refresh'}else ptr.style.display='none'},{passive:true});
document.addEventListener('touchend',()=>{ptr.style.display='none';if(y0!==null&&dy>90)refresh(true);y0=null;dy=0});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!anyOpen())render()});

window.BR={pick:i=>{const o=PICK[i];if(o)askWhich.cb(o.val)},exOk,dmInfo,dmOk,delExp,undoAdj,refresh};
sanitize();
})();/* v4.1: default profit margin (editable in Settings) and cleaner names */
(function(){
const mk=()=>{const m=+CFG.markup;return isFinite(m)&&m>=0?m:0};
const KW=/\b(selling|sell|cost|costs|price|markup|quantity|qty)\b/gi;
const _st=window.startStock;
window.startStock=function(items){
  items=items.filter(it=>{it.name=(it.name||'').replace(KW,' ').replace(/\s+/g,' ').trim();return it.name});
  if(!items.length)return alert('I could not understand that. Try: add 10 bread cost 12 selling 15');
  items.forEach(it=>{if(it.sell===null&&it.mark===null&&!findProduct(it.name,true))it.mark=mk()});
  _st(items);
};
const _of=window.openForm;
window.openForm=function(id){_of(id);if(!id){$('fMark').value=mk();calc()}};
const _os=window.openSettings;
window.openSettings=function(){
  _os();
  const h='<label>Default profit margin (%)</label><input id="cfMk" type="number" inputmode="decimal" step="0.1" min="0" value="'+mk()+'"><div class="muted">Used to suggest a selling price when you give only a cost. 0 means the selling price equals the cost until you set it.</div>';
  $('vpanel').innerHTML=$('vpanel').innerHTML.replace('<div class="acts">',h+'<div class="acts">');
};
const _sv=window.saveSettings;
window.saveSettings=function(){const e=$('cfMk'),v=e?parseFloat(e.value):NaN;_sv();if(v>=0){CFG.markup=v;saveC()}};
})();
