# DeloRadar 🇸🇮

Pregled prostih delovnih mest iz slovenskih zaposlitvenih portalov: **[odpri aplikacijo](https://machinefhead.github.io/deloradar-si/)**.

## Prva različica

- Viri: **Optius** (12 regionalnih RSS-virov), **Kariera.si**, **GOV.SI** (aktualni javni razpisi), **Atama**, **Trenkwalder** (prva javna stran s približno 30 oglasi), **Agado**, **Adecco** (uradni slovenski sitemap in javni metapodatki JobPosting), **Rekruter** (uradni RSS z nazivi, kraji in datumi), **Nove zaposlitve** (javni sitemap in podstrani dejanskih delovnih mest) ter **Lidl Slovenija** (javni sitemap delovnih mest in strukturirani metapodatki JobPosting). Pri Agadu in Rekruterju izločimo tuje zaposlitve. Pri Adeccu pregledamo do približno 164 povezav in preberemo le manjši začetni del HTML, ne celotnega besedila. Pri Novih zaposlitvah ločimo ponudbe dela od objav kandidatov; pri Lidlu izključimo potekle razpise in uporabimo dejanski kraj. Trenkwalder javno prikazuje še več oglasov, vendar za celoten seznam ne uporabljamo internega API-ja, ki je v njihovem robots.txt izključen. Pri vsakem oglasu je povezava do izvirnega portala.
- Večizbirni filtri: zaposlitveni portal, regija, kraj, poklicno področje, delodajalec. Izbire se medsebojno prilagajajo: npr. po izbiri Podravske so v seznamu krajev samo kraji, ki ustrezajo ostalim filtrom. Pri vsaki možnosti je število ujemajočih se oglasov, v spustnih seznamih pa deluje besedno iskanje; iskalno polje se po izbiri oziroma zaprtju samodejno izprazni. Gumb »Počisti izbor« zapre meni. Glavni iskalnik ima X za izbris celotnega vnosa. Dodatno: datum objave, rok prijave, status, zaznamki. Nejasni dodatni iskalnik kraja in onemogočeni filter vrste zaposlitve sta odstranjena.
- Izvoz filtriranega seznama v CSV; ročno označevanje zanimivih in kontaktiranih oglasov.
- Filtri in osebne oznake so shranjeni **v trenutnem brskalniku** (`localStorage`); telefon in računalnik za zdaj **nista sinhronizirana**.
- GitHub Actions predvidoma **vsakih 30 minut** pridobi oglase in objavi statično stran; urnik je lahko ob obremenitvah GitHuba zamaknjen. Stran se ob obisku poveže z zadnjim objavljenim `jobs.json`. Gumb **»Osveži«** odpre GitHub Actions, kjer prijavljen lastnik izbere **Run workflow**. Sam klik na gumb na javni strani torej **ne zažene novega zajema**. Po uspešnem zajemu/objavi osveži spletno stran. Pod gumbom je datum zadnjega zajema. Sprotno osveževanje neposredno ob kliku bi potrebovalo dodatni strežniški API.
- Nevtralna temna tema in mobilna zložljiva razdelka »Filtri« ter »Stanje povezav in viri«.
- Dodatni povezani viri: **Kolektor** (uradni seznam delovnih mest z lokacijami in roki), **MojeDelo.com** (straničeni javni podatkovni vmesnik, slovenska prosta mesta) in **Zaposlitev.info** (vse strani javnega seznama). Skupno je podprtih **13 virov**. MojeDelo povezave odprejo iskanje, omejeno na ID konkretnega oglasa. **SPAR Slovenija** in **Slovenske železnice** sta iz GitHubovega strežnika vrnila **HTTP 403**, zato ju ne zajemamo samodejno.
- Pod stanjem povezav je kratko pojasnilo »Oglasi se posodabljajo približno vsakih 30 minut.« in en sam gumb za razširitev **še nepovezanih virov** (dosegljiv tudi na telefonu). Odstranjen je zastareli okvir »Več oglasov na velikih portalih«, ki je napačno uvrščal že povezana MojeDelo in Zaposlitev.info med nepovezane. ZRSZ in Careerjet sta še vedno dosegljiva v dodatnem seznamu. Pod straničenjem ostaja usklajen razmik do zaključka strani.
- Optius omogoča oznake regij iz regionalnih RSS-virov, tudi ko ni navedenega natančnega kraja; posamezen oglas se lahko pojavi v več regijah, vendar je v skupni tabeli samo enkrat. Pri drugih virih se regije in področja ocenjujejo iz navedenega kraja/naziva; nepopolnih podatkov ne ugibamo.
- Tabela je razdeljena na strani, privzeto po **50** oglasov (izbira **10, 25, 50 ali 100** se shrani v brskalnik). Na voljo so na sredini poravnane številke strani ter gumba **prejšnja/naslednja** brez dodatnih skokov na začetek/konec; izbira števila oglasov je na desni, na telefonu pa pod številkami. Ob spremembi filtrov se prikaz vrne na prvo stran. Pri pomiku navzdol se desno spodaj prikaže gumb za vrnitev na vrh. CSV-izvoz zajame **vse** filtrirane zadetke, ne samo trenutne strani. Oglasi lahko že potečejo med dvema zajemoma, zato preveri izvirnik.

## Zagon in preverjanje

Potrebujete **Node.js 22+**. Dodatnih paketov ni.

```bash
npm test
npm run build
```

Generirana statična stran je v `dist/` (`index.html`, `jobs.json`). Za lokalni test brez internetnega zajema je na voljo `node scripts/build-site.mjs --fixture POT/DO/PODATKOV.json`.

## Objavljanje

GitHub Pages uporablja **GitHub Actions** (`.github/workflows/pages.yml`): ob spremembi `main`, ročno in po urniku. Če vsi viri odpovedo oziroma vrnejo nič oglasov, sestavljanje odpove in prejšnja uspešna objava ostane na spletu.

### ZRSZ – pripravljeno za dogovorjen JSON izvoz

V `source/zrsz.js` je preizkušen osnovni pretvornik JSON oglasov v DeloRadarjevo tabelo (ID, naziv, delodajalec, kraj, objava, rok in izvirni URL). **ZRSZ še ni samodejno povezan**, ker neposredni spletni API brez dogovorjene avtentikacije vrne 403 in javnega stabilnega URL-ja za izvoz še nismo potrdili. Ne uporabljamo osebnega gesla za PoiščiDelo niti ključev, najdenih v tujih skriptah.

Ko ZRSZ zagotovi primeren URL izvoza, v repozitoriju odpri **Settings → Secrets and variables → Actions → New repository secret** in dodaj `ZRSZ_JSON_URL` (celoten HTTPS naslov). Workflow ga posreduje samo koraku zbiranja. Virov ne aktiviramo pred preizkusom dejanskega izvoza in preverjanjem ujemanja njegovih polj. Če je zahtevan poseben API žeton ali glava HTTP, najprej pridobimo dokumentacijo in dodamo ustrezno podporo; žeton nikoli ne sodi v kodo ali javni `jobs.json`.

Od ZRSZ potrebujemo: stabilen URL ali dokumentacijo API-ja, način dostopa za GitHub Actions, vzorec JSON s strukturo straničenja, omejitve osveževanja in potrditev dovoljenega prikaza osnovnih metapodatkov z izvirnimi povezavami.

Razširitve z novimi viri, bolj zanesljivimi regijami in morebitnim zasebnim računom za uporabnika in partnerko bomo razvijali postopoma. **GitHub Pages je za zdaj javen**; prijava še ni vgrajena. V prvi različici **ni** oblačne podatkovne baze in **ni** avtomatskega pošiljanja prijav.

Lastnik projekta je potrdil ustno soglasje ZRSZ, MojeDelo.com, Careerjet in Zaposlitev.info za nekomercialno zbiranje metapodatkov oglasov; soglasja nismo neodvisno preverjali. Zajem poteka samo z javno dostopnih strani oziroma neavtenticiranega vmesnika. **Careerjet** pri avtomatiziranem dostopu zahteva preverjanje obiskovalca, česar ne obhajamo; **ZRSZ** ima v uporabniškem vmesniku izvoz JSON, produkcijska povezava do njega pa še ni bila potrjena. Pri teh dveh ostaja neposredna povezava. EURES in Manpower brez ustreznega partnerstva/dovoljenja ostajata nepovezana.
