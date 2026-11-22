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
- Novi povezani viri: **Mercator** (uradni javni seznam, pri razpisih za več krajev se upošteva več regij) in **IščiDelo** (javni seznam s straničenjem, brez branja njihovih izključenih poti `/api/`). Skupno je podprtih **15 virov**. Pri obeh shranimo le naslov, delodajalca, navedeno lokacijo, razpoložljive roke in povezavo do izvirnega oglasa; posameznih opisov ne kopiramo. Stanje preverja tudi GitHub Actions pred objavo.
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

### ZRSZ – uradni dnevni JSON (pripravljen, čaka na namenski dostop)

Preverili smo dejanski javni prenos `seznamDelovnihMest.json`, ki ga je 22. 11. 2026 prenesel uporabnik brez prijave. Datoteka je imela časovno oznako 21. 11. 2026, 3.772 objav in 5.357 razpisanih delovnih mest; 3.554 objav je imelo 22. 11. še odprt rok. Priključek v `source/zrsz.js` je preizkušen tudi na dejanski datoteki. Izloči pretečene, podvojene in nepopolne zapise, ohrani samo naslov, naziv delodajalca, upravno enoto, datuma in uradno referenco. Ne objavlja opisov ali kontaktov.

Pomembno: JSON ne vsebuje **neposrednih URL-jev posameznih oglasov** ali točnih krajev dela. Zato povezava za ZRSZ odpre javni iskalnik in pod naslovom prikažemo uradno registrsko oznako, upravno enoto pa izrecno označimo kot `UE ...`.

Javni gumb `.json` datoteko pridobi s ključem same ZRSZ-jeve spletne aplikacije. To ni osebni dostop za našo avtomatizacijo, zato URL-ja ali ključa iz njihove aplikacije **ne kopiramo v repozitorij**. Za načrtovani zajem od ZRSZ potrebujemo lasten dogovorjen HTTPS URL ali uradno odobreno avtentikacijo za GitHub Actions. Ko jo dobimo, nastavimo `Settings → Secrets and variables → Actions → New repository secret` z imenom `ZRSZ_JSON_URL`. Skrivnosti nikoli ne shranimo v kodo ali javni JSON. Če URL potrebuje ločeno glavo/žeton, najprej prilagodimo priključek po prejeti dokumentaciji.

Dokler URL ni nastavljen in preverjen na GitHub Runnerju, ostane ZRSZ med nepovezanimi viri; sama objava priključka **ne poveča števila aktivnih virov**.

Razširitve z novimi viri, bolj zanesljivimi regijami in morebitnim zasebnim računom za uporabnika in partnerko bomo razvijali postopoma. **GitHub Pages je za zdaj javen**; prijava še ni vgrajena. V prvi različici **ni** oblačne podatkovne baze in **ni** avtomatskega pošiljanja prijav.

Lastnik projekta je potrdil ustno soglasje ZRSZ, MojeDelo.com, Careerjet in Zaposlitev.info za nekomercialno zbiranje metapodatkov oglasov; soglasja nismo neodvisno preverjali. Zajem poteka samo z javno dostopnih strani oziroma neavtenticiranega vmesnika. **Careerjet** pri avtomatiziranem dostopu zahteva preverjanje obiskovalca, česar ne obhajamo; **ZRSZ** ima v uporabniškem vmesniku izvoz JSON, produkcijska povezava do njega pa še ni bila potrjena. Pri teh dveh ostaja neposredna povezava. EURES in Manpower brez ustreznega partnerstva/dovoljenja ostajata nepovezana.
