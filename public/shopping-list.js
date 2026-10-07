const host=document.querySelector('#shopping-body');
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
import {calculate} from './shopping-calc.js';
export {calculate} from './shopping-calc.js';

if(host){
 fetch('./data/flat-shopping-list.json').then(r=>{if(!r.ok)throw Error('Materials data unavailable');return r.json()}).then(data=>{
 host.innerHTML=`<p><strong>Home Depot · E Bradenton #6319</strong><br>5475 University Pkwy · base prices Oct 5, 2026; jack screw pack rechecked Oct 7</p><div class="shopping-options"><label>Panels <input id="shop-count" type="number" min="1" max="100" value="1"></label><label><input id="shop-supports" type="checkbox" checked> Include two jacks and shelf per panel</label><label><input id="shop-ballast" type="checkbox" checked> Include provisional 8′ ballast supplies</label></div><p id="shop-status" role="status"></p><div class="shopping-table-wrap"><table><thead><tr><th>Buy</th><th>Material / unit price</th><th>Cost</th></tr></thead><tbody id="shop-rows"></tbody></table></div><p id="shop-total" class="price"></p><p class="hint">Before tax and delivery. Excludes paint, primer, tools, flooring and connections between panels. Some items require delivery or nearby pickup.</p><details><summary>Panel &amp; support cuts <span>+</span></summary><ul id="shop-cuts"></ul></details><p class="hint">Whole packs are combined before rounding. Glue allowance: one 16 oz bottle per four panels. Lumber must be straight, sound and measured before cutting. Jack attachments: six #8 × 1¼″ wood screws each (12 per panel), included with diagonal screws in the shared 100-pack. Verify the prototype before use.</p><p class="hint">8′ ballast: provisional 75 lb per panel, split into three 25 lb bags. The model's bag shapes are schematic. Match thickness of all floor pads; test grip and stability.</p><a href="data/home-depot-shopping-list.txt" download>Download printable shopping list</a><br><a href="data/flat-shopping-list.json" download>Download quantities, prices &amp; sources (JSON)</a>`;
 const q=s=>host.querySelector(s);
 function render(){
  const height=document.querySelector('[data-height].active')?.dataset.height||'96',key=height==='120'?'10x4':'8x4';
  const n=Math.max(1,Math.min(100,Math.floor(Number(q('#shop-count').value)||1)));
  const support=q('#shop-supports').checked,ballast=q('#shop-ballast').checked;
  q('#shop-ballast').disabled=!support||key==='10x4';
  const rows=calculate(data,key,n,support,ballast),total=rows.reduce((s,p)=>s+p.subtotalCents,0);
  q('#shop-status').textContent=`${n} × ${key==='8x4'?'8×4':'10×4'} panels${support?' with jacks and shelves':''}.${key==='10x4'&&support?' 10′ ballast and retention quantities still need design; this subtotal excludes them.':' Prototype materials; verify construction and stability before use.'}`;
  q('#shop-rows').replaceChildren(...rows.map(p=>{
   const tr=document.createElement('tr'),qty=document.createElement('td'),name=document.createElement('td'),cost=document.createElement('td'),a=document.createElement('a'),meta=document.createElement('small');
   qty.textContent=p.purchaseQuantity;a.textContent=p.name;a.href=p.productUrl;a.target='_blank';a.rel='noopener';
   meta.textContent=`${money(p.unitPriceCents)} each / pack · ${p.availability}${p.observedStock!==null&&p.purchaseQuantity>p.observedStock?` · Need ${p.purchaseQuantity-p.observedStock} more than observed store stock`:""}`;name.append(a,meta);cost.textContent=money(p.subtotalCents);tr.append(qty,name,cost);return tr;
  }));
  q('#shop-total').textContent=`${key==='10x4'&&support?'Subtotal (ballast pending)':'Materials subtotal'}: ${money(total)}`;
  q('#shop-cuts').replaceChildren(...data.variants[key].cuts.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
 }
 host.addEventListener('input',render);host.addEventListener('change',render);window.addEventListener('set-configured',render);
 document.querySelectorAll('[data-height]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(render)));
 render();
 }).catch(()=>{host.textContent='Shopping list could not load. Reload to try again.'});
}
