# DeloRadar 🇸🇮

Osebni pregled slovenskih zaposlitvenih oglasov: [odpri DeloRadar na GitHub Pages](https://machinefhead.github.io/deloradar-si/). Podatki se posodobijo po uspešnem zajemu in objavi v GitHub Actions; sam obisk strani ne sproži novih poizvedb na zaposlitvene portale.

## Zadnje preverjeno stanje (26. november 2026)

- Zadnja preverjena javna objava (25. november 2026, 23:06 UTC): **8.367 oglasov iz 20 dosegljivih virov**. Lokalni popolni zajem z novim WHC (26. november) je vrnil **8.523 oglasov iz 21 dosegljivih virov**; nova različica postane javna šele po preverbi in uspešnem GitHubovem postopku objave.
- **ZRSZ: 3.725 aktualnih oglasov**, z besedilom del in nalog iz uradnega dnevnega JSON-a. Pri **3.539 oglasih** je referenca povezana s preverjenim številčnim `idp` in neposrednim oglasom; pri preostalih **186** natančnega `idp` ni potrjenega. Zato za njih ohranimo celoten opis na DeloRadarju, deljivo povezavo `?oglas=zrsz%3AIE...` pri referencah `IE` in ločeno izvorno iskanje, ne izmišljene neposredne povezave. Delež neposrednih povezav je v »Stanju povezav«.
- **Adecco: 161 oglasov** v zadnjem lokalnem zajemu; dopolnilne podrobnosti se obnovijo postopno, da ponavljajoči zajem ne pošilja vseh zahtevkov znova.
- **EURES: 25 dodatnih oglasov**, od tega 2 z navedenim krajem in 23 z državo Slovenijo, vendar brez potrjenega kraja. Vseh 25 vsebuje opis, pri 13 je objavljen tudi rok prijave. EURES je vključen v urnik; Careerjet kot agregator za zdaj ni prednostna naloga.
- **Manpower Slovenija:** neposreden HTTP-uvoz z več strani izvirnega seznama, postopnimi polnimi opisi podrobnosti in omejitvijo **20 novih HTTP-opisov na zagon** ter 14-dnevnim predpomnilnikom. Zadnji preverjeni seznam: **102 razpisa**.
- **WHC Slovenija (nekdanji Workforce):** povezani sta obe izvirni kategoriji **Workforce** in **Heads**. Izvirni aplikacijski HTTP vrne straničeni HTML (97 + 31 kartic na dan preverjanja); splošne prijave v bazo kandidatov in izrecno tuje lokacije izločimo. Posamezne oglase programsko dopolnimo z uradnim `JobPosting` in podatki o nalogah, ponudbi in pričakovanjih. Največ **24 podrobnih HTTP zahtevkov na gradnjo**, do trije sočasno, s 14-dnevnim predpomnilnikom. Brez brskalniškega odpiranja kartic.
- `dist/` vsebuje le `index.html` in `jobs.json`; zgodovinskih predogledov ZRSZ ne pakiramo več za objavo.

## Načelo pridobivanja podatkov

**Podatke uvažamo programsko, prek HTTP in strukturiranih virov.** Zbiralnik ne uporablja brskalnika za odpiranje posameznih zaposlitvenih oglasov. Uporabljeni so JSON, XML, RSS, javni seznami, strukturirani podatki `JobPosting` ter omejeni neposredni HTTP-odgovori. Za vsebino, ki je vir ne objavi, ne izmišljamo vrednosti.

ZRSZ (`source/zrsz-official-http.js`):

1. Iz javnega aplikacijskega skripta programsko odkrijemo aplikacijski `user_key`. Ta ostane samo v pomnilniku, ne v kodi, dnevnikih ali izvoženem JSON-u.
2. Preberemo uradni dnevni `ProstaDelovnaMesta.json`, ki vsebuje tudi vsebino oglasov.
3. Preberemo straničeni uradni seznam oglasov, iz katerega dobimo kandidate za numerični `idp`.
4. Za dejansko povezavo združimo referenco in `idp` šele po preverjanju registrske številke z neposrednim HTTP-odgovorom za podrobnosti. Preverjeno preslikavo hranimo v `data/zrsz-idp-verified.json`.
5. Pri spremembi identifikatorja ali dvoumnem ujemanju pustimo iskalno povezavo, namesto da bi prikazali napačen oglas.
6. Ob vsakem načrtovanem zajemu uporabimo potrjene povezave iz prejšnjega objavljenega `jobs.json` in **samodejno preverimo največ 60 novih številčnih kandidatov** (do trije sočasni zahtevki s premorom). Registrska številka v odgovoru mora ustrezati današnjemu oglasu. Napačnih ujemanj ne preverjamo znova, začasne napake pa ostanejo ponovljive. Za spremembo dnevne omejitve je na voljo `ZRSZ_VERIFY_NEW_LIMIT`.

Neposredno preverjanje s seznama ni dovolj za zapise `IE`: v predhodnem primerjalnem preizkusu s 3.983 rezultati uradnega iskalnika se je enolično ujemalo le 2 od 255 takšnih referenc. Zato pri manjkajočih ne prikazujemo izmišljene povezave na ZRSZ, ampak omogočamo odpiranje točnega polnega opisa na DeloRadarju in ločeno predizpolnjeno iskanje izvornega portala. Povezava DeloRadar deluje, dokler je oglas v aktualnem JSON-posnetku.

Vključitev uradnega ZRSZ v zbiralnik: `ZRSZ_OFFICIAL_HTTP_ENABLED=1`. Ločeni `ZRSZ_JSON_URL` je podprt kot rezervna možnost. V uporabi ni nobenega zagona Chroma ali Playwrighta za ZRSZ.

## Povezani viri

| Vir | Programski način zajema |
| --- | --- |
| ZRSZ / PoiščiDelo | Uradni dnevni JSON, iskalnik in preverjanje ID-jev prek HTTP |
| Optius | 12 regionalnih RSS-virov; omejen dodatni HTTP opis |
| Kariera.si | Javni seznam in postopno dopolnjevanje opisa |
| GOV.SI | Straničeni javni razpisi |
| Atama, Trenkwalder, Agado | Javno dostopni seznami |
| Adecco | XML sitemap, HTTP Range za strukturirane podrobnosti, inkrementalni zajem |
| Rekruter | Uradni RSS |
| Nove zaposlitve, Lidl | XML sitemap in `JobPosting` |
| Kolektor | Uradni seznam delovnih mest |
| MojeDelo.com | Straničeni JSON in HTTP podrobnosti oglasa |
| Zaposlitev.info | Straničenje in strukturirani `JobPosting` |
| Mercator, IščiDelo | Javni seznami s straničenjem, kjer je na voljo |
| dm Slovenija, Nova Priložnost | Javni HTML oziroma sitemap in `JobPosting` |
| Manpower Slovenija | Straničeni javni HTML in omejene neposredne HTTP podrobnosti s predpomnilnikom |
| WHC Slovenija (Workforce in Heads) | Izvirni aplikacijski HTTP seznam obeh kategorij; omejene podrobnosti `JobPosting` |

Vsi viri so preverjani ločeno. Če vir trenutno odpove, je označen z napako; en neuspešen vir ne izbriše oglasov drugih portalov. EURES je dodatni HTTP-uvoz z ločevanjem oglasov ZRSZ, preverjanjem lokacij in roka prijave. `EURES_HTTP_ENABLED=1` ga vključi v zbiralnik. Ker polni EURES-ov seznam zahteva več zahtevkov, si dva zaporedna 12-urna zagona lahko delita največ 20 ur star uspešen rezultat; potekle oglase izločimo.

Careerjet: ker pretežno povezuje oglase izvornih portalov, ga po dogovoru **ne prednostno vključujemo**. Javni seznam pri programskem HTTP-zahtevku vrne preverjanje prometa, običajna pot `/rss` ne obstaja, uradni `robots.txt` pa izključuje iskalni RSS-vmesnik. V rezervi ostaja preizkušena integracija `source/careerjet-data-api.js` z uradnim podatkovnim API-jem, če bi se pokazali res novi, unikatni oglasi; ključa trenutno nimamo in porabe ne sprožamo.

## Naslednji možni viri (še ne uvažamo)

- **Bolha Zaposlitve:** prek HTTP smo pregledali 72 strani oziroma 1.728 različnih oglasov. Med 198 kandidati po nazivu ni bilo nobene potrjene registrske številke `IE`, ki bi rešila manjkajoče povezave ZRSZ. Pred priklopom je treba dokazati dodatne, res unikatne oglase in preveriti podvajanje z ZRSZ.
- **Delaj.si:** javni `/oglasi/feed/` vrača RSS, vendar več pregledanih objav izrecno uvaža iz tujih virov (npr. Nemčija, Belgija). Trenutno ni primeren za širok samodejni zajem slovenskih originalnih oglasov brez preverjanja lokacije in izvornega izdajatelja.
- **Zaposlitev.net:** naveden med portali v EURES-ovem pregledu slovenskega trga dela, toda ob preverjanju je HTTP vrnil 503. Za zdaj ga ne prištevamo med delujoče vire.
- **Careerjet:** brez podatkovnega ključa ali posredovanega izvoznega vira ni potrjenega samodejnega zajema. Izvorne oglase, ki jih že vračajo drugi povezani portali, DeloRadar prikazuje pri njihovem dejanskem izdajatelju.

## Podatki in prikaz

- Filtri: vir, regija, kraj, področje, delodajalec, čas, status in zaznamki; deluje združevanje verjetnih dvojnikov brez izgube izvornih zapisov.
- Klik na naziv odpre podrobnosti z opisom, nalogami, pogoji, vrsto zaposlitve, roki in drugimi razpoložljivimi podatki. Izvorni HTML pretvorimo v varno besedilo.
- Vsak oglas ima deljivo povezavo `?oglas=<ID>`, ki odpre natanko njegov opis. Pri ZRSZ brez potrjenega `idp` sta v vrstici ločeno označena opis v DeloRadarju (`▣`) in iskanje na ZRSZ (`↗`); iskalna povezava ni predstavljena kot neposredni oglas.
- Dva JSON-izvoza neposredno na strani: filtrirani prikaz in vsi izvorni oglasi. Datoteka se ustvari in prenese **samo ob kliku ustreznega gumba**; neznana polja ostanejo neznana.
- Osebne oznake ter filtri se za zdaj hranijo samo v lokalnem pomnilniku brskalnika (`localStorage`). Ne sinhronizirajo se med napravami.
- ZRSZ-jeva upravna enota ni nujno natančen kraj dela, zato jo označimo kot `UE ...`. Ne ustvarjamo izmišljenih občin ali delovnih naslovov.

Običajni dopolnilni opis se brez nepotrebnih ponovitev prevzame iz prejšnjega veljavnega posnetka. Po 14 dneh ga poskusimo osvežiti, po 30 dneh pa zastarelega opisa ne uporabimo. Število zahtevkov na zajem je omejljivo z `DETAIL_OPTIUS_LIMIT`, `DETAIL_KARIERA_LIMIT`, `DETAIL_MOJEDELO_LIMIT`, `DETAIL_ZAPOSLITEV_LIMIT` (0–500) ter `DETAIL_MANPOWER_LIMIT` (0–80). V GitHubovem urniku uporabljamo nižje dnevne omejitve za predvidljivo porabo izvajalnika.

## Lokalni zagon

Potrebujete Node.js 22 ali novejši.

```bash
npm ci
npm test
ZRSZ_OFFICIAL_HTTP_ENABLED=1 npm run build
```

Rezultat je `dist/index.html` in `dist/jobs.json`. Brez novega internetnega zajema je mogoče iz že ustvarjene datoteke zgraditi stran:

```bash
node scripts/build-site.mjs --fixture dist/jobs.json
```

Ročni pilot, ki ne objavlja ničesar in uporablja izključno HTTP:

```bash
npm run probe:portals -- --sources=zrsz --limit=3
```

Podobno sta na voljo `--sources=eures` in `--sources=careerjet`. Ločeni `.github/workflows/portal-pilot.yml` je ročen preizkus ZRSZ HTTP brez objave; nima urnika.

## GitHub Actions in objava

`.github/workflows/pages.yml` je pripravljen za periodični zajem ob 05:17 in 17:17 UTC ter objavo statične strani. Na vsakem zagonu uporablja neposredni ZRSZ HTTP in omejene dopolnilne zahtevke. Pred objavo z `DELORADAR_REQUIRE_ALL_SOURCES=1` preveri, da so **vsi** povezani viri dosegljivi, nato pa lokalni brskalniški preizkus preveri dialoge, deljive povezave in oba JSON-izvoza. Ob neuspehu preverjanja se predhodna objava ne zamenja. GitHub Actions se **ne izvajajo** zaradi lokalnih sprememb. Dokler sprememb ne preverimo in namerno potisnemo na `main`, se obstoječa spletna različica ne spremeni.

GitHub Pages in objavljeni `jobs.json` sta tehnično javna; pred morebitno nadaljnjo objavo je treba preveriti obseg prikazanih vsebin in želeni način zasebnega dostopa. DeloRadar ne pošilja prijav na delovna mesta in ne zbira osebnih podatkov prijaviteljev.
