# DeloRadar 🇸🇮

Osebni pregled slovenskih zaposlitvenih oglasov: [odpri DeloRadar na GitHub Pages](https://machinefhead.github.io/deloradar-si/). Podatki se posodobijo po uspešnem zajemu in objavi v GitHub Actions; sam obisk strani ne sproži novih poizvedb na zaposlitvene portale.

## Zadnje preverjeno stanje (25. november 2026)

- Preverjena objava GitHub Pages (25. november 2026, 21:21 UTC): **8.869 oglasov iz 19 dosegljivih virov** z vključenim EURES. Osnovnih 18 virov je v prejšnjem lokalnem zajemu pripravilo 8.841 oglasov v 41 sekundah; celoten prvi EURES-ov zajem porabi približno dve dodatni minuti. Naslednji 12-urni zagon lahko uporabi svež EURES-ov predpomnilnik.
- **ZRSZ: 4.152 aktualnih oglasov**, vsi z opisom del in nalog iz uradnega dnevnega JSON-a. Pri **3.899 oglasih** je referenca preverjena s številčnim `idp` prek uradnega HTTP-odgovora za posamezen oglas; povezava vodi neposredno na isti oglas. Preostalih **253** (v trenutnem posnetku reference z začetkom `IE`) ohranja iskalno povezavo, saj številčnega `idp` ni mogoče potrditi v uradnem seznamu. Ne ugibamo ga. Razmerje neposrednih povezav se po novem izpiše tudi v razdelku »Stanje povezav«.
- **Adecco: 161 oglasov** v zadnjem zajemu; 143 veljavnih zapisov iz predpomnilnika in 18 novo preverjenih. Del osvežitev poteka postopoma, da ponavljajoči zajem ne pošilja vseh zahtevkov znova.
- **EURES: 25 dodatnih oglasov**, od tega 2 z navedenim krajem in 23 z državo Slovenijo, vendar brez potrjenega kraja. Vseh 25 vsebuje opis, pri 13 je objavljen tudi rok prijave. EURES je vključen v urnik; Careerjet ostaja v načrtu.
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

Vsi viri so preverjani ločeno. Če vir trenutno odpove, je označen z napako; en neuspešen vir ne izbriše oglasov drugih portalov. EURES je dodatni HTTP-uvoz z ločevanjem oglasov ZRSZ, preverjanjem lokacij in roka prijave. `EURES_HTTP_ENABLED=1` ga vključi v zbiralnik. Ker polni EURES-ov seznam zahteva več zahtevkov, si dva zaporedna 12-urna zagona lahko delita največ 20 ur star uspešen rezultat; potekle oglase izločimo.

Careerjet: njihov javni seznam pri programskem HTTP-zahtevku vrne preverjanje prometa, običajna pot `/rss` ne obstaja, uradni `robots.txt` pa izključuje iskalni RSS-vmesnik. Uradni [Jobs Data API](https://www.careerjet.si/recruiter/jobs-data-api/documentation) zahteva ločen ključ in ima obračun glede na porabo. Pripravljen in z nadomestnimi odzivi preizkušen je `source/careerjet-data-api.js`: po dodatku ključa kot GitHub Actions skrivnosti `CAREERJET_DATA_API_KEY` ga zbiralnik samodejno uporabi. Na zagon je omejen na **eno stran (do 100 zadnjih oglasov) in največ 10 dodatnih HTTP-podrobnosti**, že preverjene daljše opise ponovno uporabi iz prejšnjega posnetka. Kadar API ne vrne neposredne povezave, je URL izrecno označen kot iskanje po naslovu; neposrednih povezav ne izmišljamo. Dokler ključ ni nastavljen in pravi odzivi niso preverjeni, Careerjet pravilno ostaja med nepovezanimi viri.

## Naslednji možni viri (še ne uvažamo)

- **Bolha Zaposlitve:** javni seznam trenutno vrne objave s stabilnimi ID-ji in straničenjem. Pred vključitvijo preveriti vse strani, roke in podvajanje z ZRSZ; ni dovolj samo prva stran.
- **Delaj.si:** javni `/oglasi/feed/` vrača RSS z naslovi, datumi in povezavami, vendar meša slovenska in tuja delovna mesta. Potreben je zanesljiv filter lokacije in preverjanje, ali RSS zajema vse aktivne objave.
- **Zaposlitev.net:** naveden med portali v EURES-ovem pregledu slovenskega trga dela, toda ob preverjanju je HTTP vrnil 503. Za zdaj ga ne prištevamo med delujoče vire.
- **Careerjet:** brez podatkovnega ključa ali posredovanega izvoznega vira ni potrjenega samodejnega zajema. Izvorne oglase, ki jih že vračajo drugi povezani portali, DeloRadar prikazuje pri njihovem dejanskem izdajatelju.

## Podatki in prikaz

- Filtri: vir, regija, kraj, področje, delodajalec, čas, status in zaznamki; deluje združevanje verjetnih dvojnikov brez izgube izvornih zapisov.
- Klik na naziv odpre podrobnosti z opisom, nalogami, pogoji, vrsto zaposlitve, roki in drugimi razpoložljivimi podatki. Izvorni HTML pretvorimo v varno besedilo.
- Dva JSON-izvoza neposredno na strani: filtrirani prikaz in vsi izvorni oglasi. Datoteka se ustvari in prenese **samo ob kliku ustreznega gumba**; neznana polja ostanejo neznana.
- Osebne oznake ter filtri se za zdaj hranijo samo v lokalnem pomnilniku brskalnika (`localStorage`). Ne sinhronizirajo se med napravami.
- ZRSZ-jeva upravna enota ni nujno natančen kraj dela, zato jo označimo kot `UE ...`. Ne ustvarjamo izmišljenih občin ali delovnih naslovov.

Običajni dopolnilni opis se brez nepotrebnih ponovitev prevzame iz prejšnjega veljavnega posnetka. Po 14 dneh ga poskusimo osvežiti, po 30 dneh pa zastarelega opisa ne uporabimo. Število zahtevkov na zajem je omejljivo z `DETAIL_OPTIUS_LIMIT`, `DETAIL_KARIERA_LIMIT`, `DETAIL_MOJEDELO_LIMIT` in `DETAIL_ZAPOSLITEV_LIMIT` (0–500). V GitHubovem urniku uporabljamo nižje dnevne omejitve za predvidljivo porabo izvajalnika.

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

`.github/workflows/pages.yml` je pripravljen za periodični zajem ob 05:17 in 17:17 UTC ter objavo statične strani. Na vsakem zagonu uporablja neposredni ZRSZ HTTP in omejene dopolnilne zahtevke. GitHub Actions se **ne izvajajo** zaradi lokalnih sprememb. Dokler sprememb ne preverimo in namerno potisnemo na `main`, se obstoječa spletna različica ne spremeni.

GitHub Pages in objavljeni `jobs.json` sta tehnično javna; pred morebitno nadaljnjo objavo je treba preveriti obseg prikazanih vsebin in želeni način zasebnega dostopa. DeloRadar ne pošilja prijav na delovna mesta in ne zbira osebnih podatkov prijaviteljev.
