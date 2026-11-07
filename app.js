'use strict';
/* ===== data ===== */
const KP='freshmart.products.v1',KS='freshmart.sales.v1',KC='freshmart.settings.v1';
const load=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
let P=load(KP,[]),S=load(KS,[]),CFG=Object.assign({name:'FreshMart',theme:'green',cur:'K',logo:null},load(KC,{}));
let mode='stock',filter='all',editId=null,img=null,recId=null,cart=[],miss=[],sl=[],givenVal='',cfLogo=null,cfTheme='green';
const $=id=>document.getElementById(id);
const rnd=n=>Math.round((+n||0)*100)/100;
const fmt=n=>rnd(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const M=n=>(CFG.cur||'K')+fmt(n);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function put(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){alert('Phone storage is full. Remove some product photos.');return false}}
const saveP=()=>put(KP,P),saveS=()=>put(KS,S),saveC=()=>put(KC,CFG);
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3800)}
const hue=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return h};
const badge=(n,im)=>im?`<img src="${im}">`:((n||'?').trim().charAt(0).toUpperCase()||'?');
const bgc=n=>`background:hsl(${hue(n||'?')},52%,42%)`;
function shrink(file,max,cb){
  const r=new FileReader();
  r.onload=e=>{const i=new Image();i.onload=()=>{
    const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');
    c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);
    c.getContext('2d').drawImage(i,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.72))};i.src=e.target.result};
  r.readAsDataURL(file);
}

/* ===== theme & shop identity ===== */
const THEMES={green:{n:'Fresh Green',g:'#1b7f4b',d:'#145f38',l:'#eaf5ee'},blue:{n:'Ocean Blue',g:'#1f6fb2',d:'#164f82',l:'#e8f1f9'},orange:{n:'Sunset Orange',g:'#d9660b',d:'#a84d05',l:'#fdf0e3'}};
const LOGO='<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#fff"/><path d="M14 26h36l-4 22a4 4 0 0 1-4 3H22a4 4 0 0 1-4-3z" fill="currentColor"/><path d="M22 26l8-12M42 26l-8-12" stroke="#e0a100" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="38" r="3" fill="#fff"/><circle cx="38" cy="38" r="3" fill="#fff"/></svg>';
function applyTheme(){
  const t=THEMES[CFG.theme]||THEMES.green,r=document.documentElement.style;
  r.setProperty('--g',t.g);r.setProperty('--gd',t.d);r.setProperty('--gl',t.l);
  $('themeMeta').content=t.g;
  $('hName').textContent=CFG.name||'FreshMart';
  document.title=(CFG.name||'FreshMart')+' Stock';
  $('hLogo').innerHTML=CFG.logo?`<img src="${CFG.logo}">`:LOGO;
}

/* ===== main list ===== */
const status=p=>p.qty<=0?'out':(p.qty<=p.low?'low':'ok');
function setFilter(f){filter=f;['All','Low','Out'].forEach(x=>$('c'+x).classList.toggle('on',x.toLowerCase()===f));render()}
function todaySales(){const d=new Date();d.setHours(0,0,0,0);return S.filter(s=>s.t>=d.getTime())}
function render(){
  const q=($('q').value||'').toLowerCase();
  let L=P.filter(p=>p.name.toLowerCase().includes(q));
  const nl=P.filter(p=>status(p)==='low').length,no=P.filter(p=>status(p)==='out').length;
  $('cLow').textContent='Low'+(nl?' ('+nl+')':'');$('cOut').textContent='Out'+(no?' ('+no+')':'');
  if(filter!=='all')L=L.filter(p=>status(p)===filter);
  $('list').innerHTML=L.length?L.map(p=>{
    const st=status(p);
    return `<div class="item"><div class="thumb" style="${p.img?'':bgc(p.name)}" onclick="openForm('${p.id}')">${badge(p.name,p.img)}</div>
    <div class="info" onclick="openForm('${p.id}')"><h3>${esc(p.name)}</h3>
    <div class="price">${p.sell>0?`<b>${M(p.sell)}</b>`:'<b class="red">set price</b>'}<span>cost ${M(p.cost)}</span></div>
    <div class="pp">Profit ${M(p.sell-p.cost)} each · all sold ${M((p.sell-p.cost)*p.qty)}</div></div>
    <div class="side"><button class="qty ${st}" onclick="openRec('${p.id}')">${fmt(p.qty)}<small>${st==='out'?'OUT · +stock':st==='low'?'LOW · +stock':esc(p.unit||'pcs')+' · +stock'}</small></button>
    <button class="sellb" onclick="sellOne('${p.id}')">Sell</button></div></div>`}).join(''):
    `<div class="empty">${P.length?'Nothing matches.':'No products yet.<br>Tap <b>Stock in</b> above and say what you have,<br>e.g. “bread 20 cost 12 selling 15”.'}</div>`;
  const T=todaySales();
  $('sToday').textContent=M(T.reduce((a,s)=>a+s.total,0));
  $('sCount').innerHTML=T.length+(T.length===1?' sale':' sales')+'<br>tap to view';
  $('sItems').textContent=P.length;
  $('sValue').textContent=M(P.reduce((a,p)=>a+p.sell*p.qty,0));
  $('sProfit').textContent=M(P.reduce((a,p)=>a+(p.sell-p.cost)*p.qty,0));
}

/* ===== speech text -> items ===== */
//PARSE_START
const NW={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,dozen:12,half:0.5};
const TENS='twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety',ONES='one|two|three|four|five|six|seven|eight|nine';
const LEAD=/^(?:i\s+)?(?:have\s+|just\s+)?(?:sold|sell|sale|add|stock|received|bought|buying|got|new|products?)\b\s*/;
const key=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sizeOf=s=>{const m=(s||'').toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|lb)\b/);return m?m[1]+m[2]:''};function norm(t){
  t=(t||'').toLowerCase();
  t=t.replace(new RegExp('\\b('+TENS+')[\\s-]+('+ONES+')\\b','g'),(m,a,b)=>NW[a]+NW[b]);
  t=t.replace(new RegExp('\\b('+Object.keys(NW).join('|')+')\\b','g'),m=>NW[m]);
  t=t.replace(/\b(\d+)\s+hundred\b/g,(m,n)=>n*100).replace(/\bhundred\b/g,'100');
  t=t.replace(/\bk(?=\d)/g,'').replace(/\b(kwacha|zmw|please|um|uh)\b/g,' ');
  t=t.replace(/cost price/g,'cost').replace(/(selling|sell|sale)\s+price/g,'selling').replace(/mark\s*up/g,'markup').replace(/\b(percent|per cent)\b|%/g,' ');
  return t.replace(/\s+/g,' ').trim();
}
function splitItems(t){
  return t.split(/\s*(?:,|;|\.\s|\b(?:then|next|also|plus)\b|\band\b(?!\s+(?:cost|selling|sell|price|markup|quantity|qty|stock)\b))\s*/).map(s=>s.trim()).filter(Boolean);
}
function parseSeg(s){
  s=s.replace(LEAD,' ').trim();
  const num='(\\d+(?:\\.\\d+)?)';
  const take=re=>{const m=s.match(re);if(!m)return null;s=s.replace(m[0],' ');return parseFloat(m[1])};
  const cost=take(new RegExp('\\b(?:cost|costs|bought|buying)\\b\\D{0,10}?'+num));
  const sell=take(new RegExp('\\b(?:selling|sell|sells|price)\\b\\D{0,10}?'+num));
  const mark=take(new RegExp('\\bmarkup\\b\\D{0,10}?'+num));
  let qty=take(new RegExp('\\b(?:quantity|qty|stock|received)\\b\\D{0,10}?'+num));
  let size='';
  const sm=s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litres?|liters?|lb)\b/);
  if(sm){size=sm[1]+sm[2].replace(/^lit.*/,'l');s=s.replace(sm[0],' ')}
  const nm=s.match(/\b\d+(?:\.\d+)?\b/);
  if(nm){if(qty===null)qty=parseFloat(nm[0]);s=s.replace(nm[0],' ')}
  s=s.replace(/\b(loaf|loaves|pack|packs|packet|packets|bottle|bottles|bag|bags|piece|pieces|pcs|tin|tins|can|cans|unit|units|of|the|a|an)\b/g,' ');
  let name=s.replace(/[^a-z\s'-]/g,' ').replace(/\s+/g,' ').trim();
  if(!name)return null;
  name=name.replace(/\b[a-z]/g,c=>c.toUpperCase())+(size?' '+size:'');
  return {name,qty,cost,sell,mark};
}
const parseAll=text=>splitItems(norm(text)).map(parseSeg).filter(Boolean);
function findProduct(name,strict){
  const k=key(name);if(k.length<2)return null;
  const sz=sizeOf(name);
  const alts=[k,k.replace(/(es|s)$/,''),k.replace(/loaves/,'loaf')].filter(x=>x.length>=2);
  let best=null,bs=0;
  for(const p of P){
    const pk=key(p.name);if(pk.length<2)continue;
    const ps=sizeOf(p.name);if(sz&&ps&&sz!==ps)continue;
    let sc=0;
    for(const a of alts){
      if(pk===a)sc=Math.max(sc,4);
      else if(pk.startsWith(a)||a.startsWith(pk))sc=Math.max(sc,3);
      else if(a.length>=3&&(pk.includes(a)||a.includes(pk)))sc=Math.max(sc,2);
    }
    if(sc>bs){bs=sc;best=p}
  }
  return bs>=(strict?3:2)?best:null;
}
//PARSE_END

/* ===== command bar & microphone ===== */
const HINTS={
 stock:'Say each item with its quantity and prices, e.g. <i>“bread 20 cost 12 selling 15, sugar 1 kg 10 cost 30 selling 38”</i>. New items are created. Items you already have get more stock and keep their saved price. If the popup cuts you off after the name, just tap 🎤 again and say the prices.',
 sell:'Say what was sold, e.g. <i>“sold 2 bread and 1 sugar”</i>. You will see the total, type what the customer gave, and get the change. Stock goes down automatically.'
};
const PH={stock:'bread 20 cost 12 selling 15',sell:'sold 2 bread and 1 sugar'};
function setMode(m){
  mode=m;$('tStock').classList.toggle('on',m==='stock');$('tSell').classList.toggle('on',m==='sell');
  $('hint').innerHTML=HINTS[m];$('qa').placeholder=PH[m];
}
function toggleHint(){const h=$('hint');h.style.display=h.style.display==='none'?'block':'none'}
function runCmd(){
  const txt=$('qa').value.trim();
  if(!txt)return alert(mode==='sell'?'Say or type what was sold, e.g. sold 2 bread and 1 sugar':'Say or type what came in, e.g. bread 20 cost 12 selling 15');
  const items=parseAll(txt);
  if(!items.length)return alert('I could not understand: "'+txt+'"');
  const asSell=mode==='sell'||/^\s*(i\s+)?(just\s+)?(sold|sell)\b/i.test(txt);
  $('qa').value='';
  if(asSell)startSale(items);else startStock(items);
}
async function listen(prompt){
  const SR=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.SpeechRecognition;
  if(!SR)return {err:'none'};
  try{
    const a=await SR.available();if(!a.available)return {err:'unavailable'};
    let p=await SR.checkPermissions();
    if(p.speechRecognition!=='granted')p=await SR.requestPermissions();
    if(p.speechRecognition!=='granted')return {err:'denied'};
    const r=await SR.start({language:'en-US',maxResults:1,prompt:prompt||'Say it now',partialResults:false,popup:true});
    return {text:(r&&r.matches&&r.matches[0])||''};
  }catch(e){return {text:''}}
}
const addText=t=>{const q=$('qa');q.value=(q.value?q.value+' ':'')+t};
async function mic(){
  const r=await listen(mode==='sell'?'What was sold?':'Item, quantity, cost and selling price');
  if(r.err){
    $('qa').focus();
    return toast(r.err==='denied'?'Microphone is blocked. Allow it in phone Settings > Apps > this app > Permissions.':'Tap the 🎤 on your keyboard, speak, then tap Go');
  }
  if(!r.text)return;
  addText(r.text);
  if(mode==='stock'){
    const need=()=>parseAll($('qa').value).some(it=>!findProduct(it.name,true)&&it.cost===null&&it.sell===null);
    if(need()){
      toast('Now say the cost and selling price');
      const r2=await listen('Now say the cost and selling price');
      if(r2.text)addText(r2.text);
    }
  }
  runCmd();
}

/* ===== STOCK IN (editable confirm; price is remembered) ===== */
function startStock(items){
  sl=items.map(it=>{    const p=findProduct(it.name,true);
    const priced=it.cost!==null||it.sell!==null||it.mark!==null;
    const L={p,name:p?p.name:it.name,manual:it.sell!==null,mark:it.mark};
    if(p){
      const c=it.cost!==null?it.cost:p.cost;
      let s=p.sell;
      if(it.sell!==null)s=it.sell;
      else if(it.mark!==null&&c>0)s=rnd(c*(1+it.mark/100));
      else if(it.cost!==null&&it.cost!==p.cost&&p.cost>0)s=rnd(it.cost*p.sell/p.cost);
      L.cost=c;L.sell=s;L.qty=it.qty!==null?it.qty:(priced?0:1);
    }else{
      const c=it.cost!==null?it.cost:'';
      let s=it.sell!==null?it.sell:'';
      if(s===''&&c!==''&&c>0)s=rnd(c*(1+(it.mark!==null?it.mark:25)/100));
      L.cost=c;L.sell=s;L.qty=it.qty!==null?it.qty:1;
    }
    return L;
  });
  renderStock();$('vsheet').classList.add('on');
}
function slCard(l,i){
  const old=!!l.p;
  return `<div class="sl"><div class="sl-h"><span class="tag ${old?'old':'new'}">${old?'RESTOCK · price remembered':'NEW ITEM'}</span><button class="x" onclick="rmStock(${i})">✕</button></div>
  <label>Name</label><input value="${esc(l.name)}" ${old?'readonly':''} oninput="slSet(${i},'name',this.value)">
  <div class="row3">
   <div><label>Quantity</label><input type="number" inputmode="decimal" value="${l.qty}" oninput="slSet(${i},'qty',this.value)"></div>
   <div><label>Cost (${esc(CFG.cur)})</label><input id="slc${i}" type="number" inputmode="decimal" step="0.01" value="${l.cost}" oninput="slSet(${i},'cost',this.value)"></div>
   <div><label>Sell (${esc(CFG.cur)})</label><input id="sls${i}" type="number" inputmode="decimal" step="0.01" value="${l.sell}" oninput="slSet(${i},'sell',this.value)"></div>
  </div><div class="ln-s" id="sli${i}"></div></div>`;
}
function renderStock(){
  if(!sl.length)return closeV();
  $('vpanel').innerHTML=`<h2>📦 Add to stock</h2><div class="muted">Check the details. You can change anything before you confirm.</div>`+sl.map(slCard).join('')+
  `<div class="acts"><button class="btn s" onclick="closeV()">Cancel</button><button class="btn p" onclick="confirmStock()">Confirm &amp; save</button></div>`;
  sl.forEach((l,i)=>slInfo(i));
}
function slSet(i,f,v){
  const l=sl[i];
  if(f==='name'){l.name=v;return}
  l[f]=v===''?'':+v;
  if(f==='sell')l.manual=true;
  if(f==='cost'&&!l.manual&&+v>0){
    const mk=l.p&&l.p.cost>0?l.p.sell/l.p.cost:1+(l.mark!=null?l.mark:25)/100;
    l.sell=rnd(+v*mk);$('sls'+i).value=l.sell;
  }
  slInfo(i);
}
function slInfo(i){
  const l=sl[i],c=+l.cost||0,s=+l.sell||0,q=+l.qty||0;let t='';
  if(l.p)t+=`Stock ${fmt(l.p.qty)} → <b>${fmt(l.p.qty+q)}</b> · `;
  t+=(c>0&&s>0)?`Profit ${M(s-c)} each (${Math.round((s/c-1)*100)}%) · if all sold ${M(s*q)}`:'<span class="red">Enter the cost and selling price</span>';
  if(l.p&&c>0&&s>0&&(c!==l.p.cost||s!==l.p.sell))t+=`<br>Price will change. Was cost ${M(l.p.cost)}, sell ${M(l.p.sell)}`;
  $('sli'+i).innerHTML=t;
}
function rmStock(i){sl.splice(i,1);renderStock()}
function confirmStock(){
  const bad=sl.filter(l=>!(l.name||'').trim()||!(+l.cost>0)||!(+l.sell>0));
  if(bad.length)return alert('Please enter the cost and selling price for: '+bad.map(l=>l.name||'(no name)').join(', '));
  let made=0,upd=0;
  sl.forEach((l,i)=>{
    const nm=l.name.trim(),q=+l.qty||0,c=+l.cost,s=+l.sell;
    const p=l.p||P.find(x=>key(x.name)===key(nm));
    if(p){p.qty=rnd(p.qty+q);p.cost=c;p.sell=s;upd++}
    else{P.unshift({id:'p'+Date.now()+'_'+i,name:nm,cat:'Other',unit:'pcs',cost:c,sell:s,qty:q,low:5,img:null});made++}
  });
  if(!saveP())return;
  closeV();render();
  toast('Saved ✓  '+(made?made+' new':'')+(made&&upd?', ':'')+(upd?upd+' restocked':'')+' · prices remembered');
}
function closeV(){$('vsheet').classList.remove('on');cart=[];miss=[];sl=[]}

/* ===== SELL ===== */
function addCart(id,q){const c=cart.find(x=>x.id===id);if(c)c.qty+=q;else cart.push({id,qty:q})}
function sellOne(id){miss=[];givenVal='';cart=[];addCart(id,1);openSale()}
function startSale(items){
  cart=[];miss=[];givenVal='';
  for(const it of items){
    const p=findProduct(it.name,false),q=it.qty===null?1:it.qty;
    if(!p){miss.push(it.name);continue}
    addCart(p.id,q);
  }
  if(!cart.length)return alert('Not found in your stock: '+miss.join(', ')+'\nAdd it first using Stock in.');
  openSale();
}
function openSale(){renderSale();$('vsheet').classList.add('on')}
const saleTotal=()=>cart.reduce((a,c)=>{const p=P.find(x=>x.id===c.id);return a+p.sell*c.qty},0);
function renderSale(){
  if(!cart.length)return closeV();
  const rows=cart.map((c,i)=>{
    const p=P.find(x=>x.id===c.id);
    const w=(c.qty>p.qty?` · <span class="red">only ${fmt(p.qty)} in stock</span>`:'')+(p.sell<=0?' · <span class="red">no price set</span>':'');
    return `<div class="ln"><div class="ln-n"><b>${esc(p.name)}</b><div class="ln-s">${M(p.sell)} each${w}</div></div>
    <div class="stp"><button onclick="cq(${i},-1)">−</button><b>${fmt(c.qty)}</b><button onclick="cq(${i},1)">+</button></div>
    <div class="ln-t">${M(p.sell*c.qty)}</div></div>`;
  }).join('');
  const m=miss.length?`<div class="ln-s red" style="margin-top:8px">Not found, skipped: ${esc(miss.join(', '))}</div>`:'';
  $('vpanel').innerHTML=`<h2>🛒 Sale</h2>${rows}${m}
  <div class="tot"><span>Total</span><span>${M(saleTotal())}</span></div>
  <label>Amount given by the customer (${esc(CFG.cur)})</label>
  <input id="given" type="number" inputmode="decimal" step="0.01" value="${esc(givenVal)}" oninput="upd()">
  <div class="chg" id="chg"></div>
  <div class="acts"><button class="btn s" onclick="closeV()">Cancel</button><button class="btn p" onclick="confirmSale()">Confirm sale</button></div>`;  upd();
}
function cq(i,d){cart[i].qty=rnd(cart[i].qty+d);if(cart[i].qty<=0)cart.splice(i,1);renderSale()}
function upd(){
  const e=$('given');if(!e)return;givenVal=e.value;
  const g=+givenVal,t=saleTotal(),c=$('chg');
  if(!givenVal){c.className='chg';c.textContent='Type what the customer gave to see the change';c.style.fontSize='13px';return}
  c.style.fontSize='';
  if(g>=t){c.className='chg';c.textContent='Change: '+M(g-t)}
  else{c.className='chg bad';c.textContent='Short by '+M(t-g)}
}
function confirmSale(){
  if(!cart.length)return;
  const total=saleTotal(),g=+givenVal||0;
  if(g>0&&g<total&&!confirm('The customer gave less than the total. Save the sale anyway?'))return;
  const lines=cart.map(c=>{const p=P.find(x=>x.id===c.id);return {id:p.id,name:p.name,qty:c.qty,price:p.sell,cost:p.cost}});
  cart.forEach(c=>{const p=P.find(x=>x.id===c.id);p.qty=Math.max(0,rnd(p.qty-c.qty))});
  S.push({t:Date.now(),total,given:g,change:g?rnd(g-total):0,lines});
  saveP();saveS();
  const ch=g?' · Change '+M(g-total):'';
  closeV();render();toast('Sale saved · Total '+M(total)+ch);
}

/* ===== today's sales ===== */
function openSales(){
  const T=todaySales().slice().reverse();
  const tot=T.reduce((a,s)=>a+s.total,0),prof=T.reduce((a,s)=>a+s.lines.reduce((b,l)=>b+(l.price-l.cost)*l.qty,0),0);
  const rows=T.length?T.map(s=>{
    const d=new Date(s.t),hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    return `<div class="sale"><div class="sn"><b>${M(s.total)}</b> · ${hh}<br>${s.lines.map(l=>fmt(l.qty)+' × '+esc(l.name)).join(', ')}</div><button class="undo" onclick="undoSale(${s.t})">Undo</button></div>`;
  }).join(''):'<div class="empty">No sales yet today.</div>';
  $('vpanel').innerHTML=`<h2>Today's sales</h2>
  <div class="pill3"><div><b>${M(tot)}</b><span>Total sold</span></div><div><b>${M(prof)}</b><span>Profit made</span></div><div><b>${T.length}</b><span>Sales</span></div></div>
  ${rows}<div class="acts"><button class="btn s" onclick="closeV()">Close</button></div>`;
  $('vsheet').classList.add('on');
}
function undoSale(t){
  const i=S.findIndex(s=>s.t===t);if(i<0)return;
  if(!confirm('Undo this sale? The items go back into stock.'))return;
  S[i].lines.forEach(l=>{const p=P.find(x=>x.id===l.id);if(p)p.qty=rnd(p.qty+l.qty)});
  S.splice(i,1);saveP();saveS();render();openSales();toast('Sale undone');
}

/* ===== settings, backup ===== */
function openSettings(){
  cfLogo=CFG.logo;cfTheme=CFG.theme;
  $('vpanel').innerHTML=`<h2>⚙ Shop settings</h2><div class="muted">Make the app yours. Changes show straight away.</div>
  <label>Shop name</label><input id="cfName" value="${esc(CFG.name)}" maxlength="30">
  <label>Shop logo</label>
  <div class="photo"><div class="logo" id="cfPrev" style="width:64px;height:64px;color:var(--g)">${cfLogo?`<img src="${cfLogo}">`:LOGO}</div>
   <div style="flex:1;display:grid;gap:6px"><button class="btn s" onclick="document.getElementById('cfFile').click()">Choose logo photo</button><button class="btn s" onclick="cfLogo=null;document.getElementById('cfPrev').innerHTML=LOGO">Use default logo</button></div></div>
  <input type="file" id="cfFile" accept="image/*" hidden onchange="cfPick(this)">
  <label>Colour theme</label>
  <div class="themes">${Object.entries(THEMES).map(([k,t])=>`<button class="th ${k===cfTheme?'on':''}" id="th_${k}" onclick="cfTh('${k}')"><i style="background:linear-gradient(135deg,${t.g},${t.d})"></i>${t.n}</button>`).join('')}</div>
  <label>Money symbol (K, $, R …)</label><input id="cfCur" value="${esc(CFG.cur)}" maxlength="4">
  <div class="acts"><button class="btn s" onclick="closeV()">Cancel</button><button class="btn p" onclick="saveSettings()">Save</button></div>
  <div class="hr"></div>
  <h2 style="font-size:16px">Backup &amp; restore</h2>
  <div class="muted">Protects your stock if the phone is lost. Tap <b>Show backup</b>, copy the text and send it to yourself (WhatsApp, email). Product photos are not included. To restore, paste the text here and tap <b>Restore</b>.</div>
  <textarea id="bk" rows="4" placeholder="Backup text appears here, or paste a backup to restore"></textarea>
  <div class="acts"><button class="btn s" onclick="showBackup()">Show backup</button><button class="btn s" onclick="copyBackup()">Copy</button><button class="btn d" onclick="restoreBackup()">Restore</button></div>`;
  $('vsheet').classList.add('on');
}
function cfPick(inp){const f=inp.files[0];if(!f)return;shrink(f,240,d=>{cfLogo=d;$('cfPrev').innerHTML=`<img src="${d}">`});inp.value=''}
function cfTh(k){cfTheme=k;Object.keys(THEMES).forEach(x=>$('th_'+x).classList.toggle('on',x===k))}
function saveSettings(){
  CFG.name=($('cfName').value.trim()||'FreshMart');CFG.theme=cfTheme;CFG.logo=cfLogo;CFG.cur=($('cfCur').value.trim()||'K');
  saveC();applyTheme();render();closeV();toast('Settings saved');
}
function showBackup(){$('bk').value=JSON.stringify({app:'freshmart',v:1,products:P.map(p=>Object.assign({},p,{img:null})),sales:S,settings:Object.assign({},CFG,{logo:null})})}
function copyBackup(){
  if(!$('bk').value)showBackup();
  const t=$('bk');t.select();
  try{navigator.clipboard.writeText(t.value).then(()=>toast('Backup copied'),()=>{document.execCommand('copy');toast('Backup copied')})}catch(e){try{document.execCommand('copy');toast('Backup copied')}catch(e2){toast('Press and hold the text, then tap Copy')}}
}
function restoreBackup(){
  let d;try{d=JSON.parse($('bk').value);if(!d||!Array.isArray(d.products))throw 0}catch(e){return alert('That is not a valid FreshMart backup.')}  if(!confirm('Replace ALL current stock and sales with this backup?'))return;
  const keep=new Map(P.map(p=>[p.id,p.img]));
  P=d.products.map(p=>Object.assign({img:keep.get(p.id)||null},p,{img:keep.get(p.id)||null}));
  S=Array.isArray(d.sales)?d.sales:[];
  if(d.settings)CFG=Object.assign({},CFG,d.settings,{logo:CFG.logo});
  saveP();saveS();saveC();applyTheme();render();closeV();toast('Backup restored');
}

/* ===== manual product form ===== */
function preview(){const n=$('fName').value;$('fThumb').innerHTML=badge(n,img);$('fThumb').style.cssText=img?'':bgc(n)}
function photo(inp){const f=inp.files[0];if(!f)return;shrink(f,320,d=>{img=d;preview()});inp.value=''}
function fromMarkup(){const c=+$('fCost').value,m=+$('fMark').value;if(c>0)$('fSell').value=rnd(c*(1+m/100));calc()}
function fromSell(){const c=+$('fCost').value,s=+$('fSell').value;if(c>0&&s>0)$('fMark').value=Math.round((s/c-1)*1000)/10;calc()}
function calc(){
  const c=+$('fCost').value||0,s=+$('fSell').value||0,q=+$('fQty').value||0;
  $('calc').innerHTML=`<div><span>Money spent on stock</span><b>${M(c*q)}</b></div><div><span>Profit per unit</span><b>${M(s-c)}</b></div>
  <div><span>Potential sales (all sold)</span><b>${M(s*q)}</b></div><div class="big"><span>Projected profit</span><span>${M((s-c)*q)}</span></div>`;
}
function openForm(id){
  editId=id||null;const p=P.find(x=>x.id===id);img=p?p.img:null;
  $('fTitle').textContent=p?'Edit product':'New product';
  $('fName').value=p?p.name:'';$('fCat').value=p?p.cat:'Staples';$('fUnit').value=p?p.unit:'pcs';
  $('fCost').value=p?p.cost:'';$('fSell').value=p?p.sell:'';$('fQty').value=p?p.qty:'';$('fLow').value=p?p.low:5;
  $('fMark').value=p&&p.cost>0?Math.round((p.sell/p.cost-1)*1000)/10:25;
  $('fDel').style.display=p?'block':'none';
  preview();calc();$('sheet').classList.add('on');
}
function closeForm(){$('sheet').classList.remove('on')}
function save(){
  const name=$('fName').value.trim(),cost=+$('fCost').value,sell=+$('fSell').value;
  if(!name)return alert('Enter the product name.');
  if(!(cost>0))return alert('Enter the cost price.');
  if(!(sell>0))return alert('Enter a selling price or markup.');
  const o={name,cat:$('fCat').value,unit:$('fUnit').value||'pcs',cost,sell,qty:+$('fQty').value||0,low:+$('fLow').value||0,img};
  if(editId){Object.assign(P.find(x=>x.id===editId),o)}else{P.unshift(Object.assign({id:'p'+Date.now()},o))}
  if(!saveP())return;closeForm();render();toast('Saved ✓');
}
function del(){if(confirm('Delete this product?')){P=P.filter(x=>x.id!==editId);saveP();closeForm();render()}}
function openRec(id){recId=id;const p=P.find(x=>x.id===id);$('rTitle').textContent='Add stock: '+p.name;$('rQty').value='';$('rCost').value=p.cost;$('rsheet').classList.add('on')}
function closeRec(){$('rsheet').classList.remove('on')}
function receive(){
  const p=P.find(x=>x.id===recId),q=+$('rQty').value,c=+$('rCost').value;
  if(!(q>0))return alert('Enter the quantity.');
  if(c>0&&c!==p.cost){const m=p.cost>0?p.sell/p.cost:1.25;p.cost=c;p.sell=rnd(c*m)}
  p.qty=rnd(p.qty+q);saveP();closeRec();render();toast('Stock added ✓');
}

applyTheme();setMode('stock');render();
