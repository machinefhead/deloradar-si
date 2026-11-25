export const zrszPreviewPage = `<!doctype html>
<html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZRSZ – testni pregled | DeloRadar</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#10141d;color:#eef2f8}
*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:28px 18px 75px}
a{color:#8bcbff}header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{font-weight:800;font-size:19px;color:#fff;text-decoration:none}.hero{padding:34px 0 22px}
h1{font-size:clamp(28px,4vw,45px);margin:8px 0 11px;letter-spacing:-.04em}p{color:#acb8ca;line-height:1.6}
.warn{background:#292214;border:1px solid #5a4830;padding:15px 17px;border-radius:13px;color:#f8dfaa}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
.tile,.controls,.item,.detail{background:#1a202b;border:1px solid #303a48;border-radius:15px;padding:18px}
.tile small{color:#adb9ca;display:block}.tile strong{font-size:27px;display:block;margin-top:5px}
.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:16px}
label{display:grid;gap:7px;color:#adb9ca;font-size:13px;flex:1 1 240px}input,select,button{font:inherit}
input,select{width:100%;border:1px solid #465164;background:#101722;color:#fff;border-radius:9px;padding:11px}
button{cursor:pointer;border-radius:9px;padding:9px 14px;border:1px solid #465164;background:#28364b;color:#fff}
button:disabled{opacity:.5;cursor:default}.results{display:grid;gap:10px}.item{padding:16px 18px}
.item h2{font-size:17px;margin:0 0 8px}.meta{display:flex;flex-wrap:wrap;gap:8px;color:#b8c4d4;font-size:13px}
.tag{padding:3px 8px;background:#243a42;border-radius:25px;color:#bde9e6;font-size:12px}
.linkrow{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px;align-items:center}
.pagination{display:flex;justify-content:center;align-items:center;gap:13px;margin-top:20px}
dialog{border:1px solid #465164;background:#17202d;color:#fff;border-radius:16px;max-width:690px;width:calc(100% - 32px);max-height:85vh;padding:24px}
dialog::backdrop{background:#000b}.detail p{white-space:pre-wrap;overflow-wrap:anywhere}.detail h3{margin-bottom:6px}
.close{float:right}footer{color:#8795a8;margin-top:35px;font-size:13px}
@media(max-width:600px){.summary{grid-template-columns:1fr}.tile{padding:12px}.tile strong{font-size:22px}.controls{padding:14px}}
</style></head><body><main>
<header><a class="brand" href="./">◉ DeloRadar</a><a href="./">← Glavni pregled</a></header>
<section class="hero"><div class="tag" style="display:inline-block">ZRSZ • razvojni preizkus</div><h1>Pregled ZRSZ oglasov</h1>
<p>Ločen prikaz arhivskih, dejansko zajetih oglasov. Namenjen je preverjanju podatkov, povezav in novega zbiralnika.</p></section>
<div class="warn" id="warning">⚠ To je zgodovinski posnetek, ne posodobljen seznam aktualnih delovnih mest. Podatki se na tej strani ne osvežujejo samodejno.</div>
<section class="summary"><div class="tile"><small>Oglasi v posnetku</small><strong id="total">—</strong></div>
<div class="tile"><small>Preverjene neposredne povezave</small><strong id="direct">—</strong></div>
<div class="tile"><small>Datum posnetka</small><strong id="stamp" style="font-size:17px">—</strong></div></section>
<section class="controls"><label>Iskanje po nazivu, delodajalcu ali kraju<input type="search" id="query" placeholder="Npr. elektrotehnik, Maribor…"></label>
<label>Vrsta povezave<select id="links"><option value="all">Vsi oglasi</option><option value="direct">Neposreden oglas</option><option value="search">Iskanje na ZRSZ</option></select></label>
<label>Na stran<select id="pageSize"><option>10</option><option>25</option><option>50</option><option>100</option></select></label></section>
<p id="count" role="status">Nalaganje podatkov…</p><div class="results" id="results"></div>
<nav class="pagination"><button id="prev">← Prejšnja</button><span id="paging"></span><button id="next">Naslednja →</button></nav>
<footer>Podatki so iz arhivskega izvoza GitHub Actions. Ne predstavljajo novih HTTP poizvedb na ZRSZ.</footer>
</main><dialog id="details"><button class="close" id="closeDialog">Zapri ✕</button><h2 id="detailTitle"></h2><div id="detailBody"></div></dialog>
<script>
const $=id=>document.getElementById(id);let jobs=[],filtered=[],page=0;
const direct=j=>/\\?idp=\\d+/.test(j.url||'');
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value||'');return el};
function displayDetails(j){$('detailTitle').textContent=j.title;const body=$('detailBody');body.replaceChildren();
 for(const [title,key] of [['Delodajalec','company'],['Lokacija','location'],['Datum objave','date'],['Rok prijave','deadline'],['Opis','description'],['Naloge','responsibilities'],['Pogoji','requirements'],['Izobrazba','education'],['Izkušnje','experience'],['Vrsta zaposlitve','employmentType'],['Pogodba','contractType'],['Trajanje','contractDuration'],['Delovni čas','workHours'],['Plača','salary'],['Ugodnosti','benefits']]){
  if(!j[key])continue;const panel=document.createElement('section');panel.className='detail';panel.append(text('h3',title),text('p',j[key]));body.append(panel);
 } $('details').showModal();}
function render(){const limit=Number($('pageSize').value),pages=Math.max(1,Math.ceil(filtered.length/limit));page=Math.min(page,pages-1);
 $('results').replaceChildren();$('count').textContent=filtered.length.toLocaleString('sl-SI')+' zadetkov';
 for(const j of filtered.slice(page*limit,(page+1)*limit)){
  const row=document.createElement('article');row.className='item';const heading=text('h2',j.title);row.append(heading);
  const meta=document.createElement('div');meta.className='meta';for(const v of [j.company,j.location,j.deadline?'Rok: '+j.deadline:'',j.reference?'Ref.: '+j.reference:''])if(v)meta.append(text('span',v));row.append(meta);
  const links=document.createElement('div');links.className='linkrow';const more=document.createElement('button');more.textContent='Podrobnosti';more.addEventListener('click',()=>displayDetails(j));links.append(more);
  if(String(j.url||'').startsWith('https://')){const a=text('a',direct(j)?'Neposreden oglas ↗':'Iskanje na ZRSZ ↗');a.href=j.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  row.append(links);$('results').append(row);
 }$('paging').textContent=(page+1)+' / '+pages;$('prev').disabled=page===0;$('next').disabled=page+1>=pages;}
function filter(){const q=$('query').value.toLocaleLowerCase('sl').trim(),mode=$('links').value;
 filtered=jobs.filter(j=>(!q||[j.title,j.company,j.location,j.reference].some(x=>String(x||'').toLocaleLowerCase('sl').includes(q)))&&(mode==='all'||(mode==='direct')===direct(j)));page=0;render();}
for(const id of ['query','links','pageSize'])$(id).addEventListener(id==='query'?'input':'change',filter);
$('prev').addEventListener('click',()=>{page--;render()});$('next').addEventListener('click',()=>{page++;render()});
$('closeDialog').addEventListener('click',()=>$('details').close());
fetch('./zrsz-preview.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(async d=>{
 if(d.kind!=='historical-zrsz-preview'||!Array.isArray(d.shards))throw Error('Neveljaven testni posnetek');
 const pages=await Promise.all(d.shards.map(file=>fetch('./'+file).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})));
 jobs=pages.flat();if(jobs.length!==d.total)throw Error('Nepopoln posnetek');
 $('total').textContent=jobs.length.toLocaleString('sl-SI');$('direct').textContent=jobs.filter(direct).length.toLocaleString('sl-SI');
 $('stamp').textContent=new Date(d.capturedAt).toLocaleString('sl-SI',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Ljubljana'});filter();
}).catch(e=>{$('count').textContent='Podatkov ni bilo mogoče naložiti: '+e.message});
</script></body></html>`;
