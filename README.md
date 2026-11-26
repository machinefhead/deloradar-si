# DeloRadar 🇸🇮

Osebni pregled slovenskih zaposlitvenih oglasov: [odpri DeloRadar na GitHub Pages](https://machinefhead.github.io/deloradar-si/). Podatki se posodobijo po uspešnem zajemu in objavi v GitHub Actions; sam obisk strani ne sproži novih poizvedb na zaposlitvene portale.

## Zadnje preverjeno stanje (26. november 2026)

- Prejšnja preverjena različica s Celtro (26. november 2026): **11.020 oglasov iz 29 dosegljivih virov**; Celtra je prispevala šest izvirnih slovenskih objav s polnimi opisi.
- **Novi paket osmih dodatnih virov, strogi lokalni zajem 26. novembra 2026 ob 20:20 UTC:** **11.051 oglasov iz 37/37 dosegljivih virov**. Speechify (1), Outfit7 (6), Plume (5), Teads (4), Povio (4), D-ploy (9), Laundryheap (1) in SOFMEDICA (2) so dodali **32** razpisov s celotnim opisom. Celoten posnetek ima 0 podvojenih ID-jev, 0 izrecno tujih lokacij in 20 reverzibilno označenih skupin dvojnikov; pri novih osmih virih ni bil označen noben dvojnik. Ta podatek opisuje lokalni zajem, ne samodejno že objavljene spletne različice.
- **Naslednji paket sedmih povezanih virov, strogi lokalni zajem 26. novembra 2026 ob 20:58 UTC:** **11.087 oglasov iz 44/44 dosegljivih virov**. Bosch Group (11), Sportradar (10), JYSK Slovenija (9), Primark (3), Anton Paar (1), Moneyhub (1) in XDS (1) so dodali **36** slovenskih razpisov, vsak s celotnim opisom in neposredno HTTPS povezavo. Revizija: 0 podvojenih ID-jev, 0 izrecno tujih lokacij, 20 obstoječih reverzibilnih skupin dvojnikov, 0 novih skupin. Novartisov Workday je lokalno dodatno vrnil 75 slovenskih oglasov, vendar GitHub Actions zavrne že njegovo prvo HTTP-zahtevo s **429**, tudi po uvedbi časovnega razmika. Zato ga izločimo iz povezanih virov in jasno zabeležimo pod nepovezanimi, namesto da bi onemogočili redno osveževanje strani.
- **Tretji paket sedmih novih virov, strogi lokalni zajem 26. novembra 2026 ob 21:28 UTC:** **11.108 oglasov iz 51/51 dosegljivih virov**. Sunrise Robotics (10), Paradox (6), Axelera AI (1), AbbVie (1), Coface (1), Konecranes (1) in RWS TrainAI (1) so dodali **21** dejanskih razpisov. Vseh 21 ima celoten opis, datum, preverjeno slovensko lokacijo in neposredno HTTPS povezavo; ni osebnih e-poštnih stikov, podvojenih ID-jev ali dodatnih označenih dvojnikov. Celoten posnetek ima 20 obstoječih reverzibilnih skupin in 0 izrecno tujih lokacij. Izločili smo splošne prijave in številne strani brez slovenskih oglasov; neuspešne kandidate smo z razlogi dodali med nepovezane. Pred objavo velja še preverjanje na GitHub Actions.
- **ZRSZ (izboljšana preslikava, lokalni zajem 26. 11. 2026): 3.947 aktualnih oglasov**, z besedilom del in nalog iz uradnega dnevnega JSON-a. Javni iskalnik ZRSZ je istočasno vrnil **3.796** zapisov, ker uporablja drugačen nabor. Pri **3.715 od 3.947** je številčni `idp` potrjen neposredno iz uradnega odgovora s registrsko številko; zadnji pregled je avtomatsko dodal še **58** preverjenih povezav iz strogo ujemajočih in večpomenskih kandidatov. Vseh **232** preostalih brez `idp` imajo registrsko predpono `IE`. Pri 12 kontrolnih zahtevah za poskusna ujemanja `IE` se registrske številke niso ujemale; povezav ne ugibamo. Pri njih ostane celoten opis v DeloRadarju in deljiva povezava `?oglas=zrsz%3AIE...`, izvorno iskanje pa je jasno označeno kot nepreverjeno. Za dodatne dvoumne kandidate uporabljamo omejene HTTP-zahtevke in predpomnilnik negativnih rezultatov.
- **Adecco: 146 aktualnih oglasov** v zadnjem lokalnem zajemu. Še 15 povezav v sitemapu je vračalo odstranjene/neveljavne zapise (npr. HTTP 410), kar ni več obravnavano kot napaka portala. Dopolnilne podrobnosti se osvežujejo postopno.
- **EURES: 25 dodatnih oglasov**, od tega 2 z navedenim krajem in 23 z državo Slovenijo, vendar brez potrjenega kraja. Vseh 25 vsebuje opis, pri 13 je objavljen tudi rok prijave. EURES je vključen v urnik; Careerjet kot agregator za zdaj ni prednostna naloga.
- **Manpower Slovenija:** neposreden HTTP-uvoz z več strani izvirnega seznama, postopnimi polnimi opisi podrobnosti in omejitvijo **20 novih HTTP-opisov na zagon** ter 14-dnevnim predpomnilnikom. Zadnji preverjeni seznam: **102 razpisa**.
- **WHC Slovenija (nekdanji Workforce):** povezani sta obe izvirni kategoriji **Workforce** in **Heads**. Izvirni aplikacijski HTTP vrne straničeni HTML (97 + 31 kartic na dan preverjanja); splošne prijave v bazo kandidatov in izrecno tuje lokacije izločimo. Posamezne oglase programsko dopolnimo z uradnim `JobPosting` in podatki o nalogah, ponudbi in pričakovanjih. Največ **24 podrobnih HTTP zahtevkov na gradnjo**, do trije sočasno, s 14-dnevnim predpomnilnikom. Brez brskalniškega odpiranja kartic.
- **e-Študentski Servis:** **2.141 objav** iz 43 straničenih HTTP odgovorov; opis, kraj, delovnik in plačilo preberemo neposredno iz seznama, brez dodatnih zahtevkov za podrobnosti. Vneseno je kot posebno označeno študentsko delo, brez ugibanja datuma objave.
- **Greenhouse/Lever:** pet izvirnih kariernih sistemov (Planet Labs, Wolt, Robinhood, Aleph, TSMG) je ob zajemu vrnilo skupaj **22 slovenskih razpisov**. Lever prenaša tudi ločena poglavja nalog in zahtev.
- **Competo (nova nadgradnja):** uradni portal `portal.digi.competo.si` uporablja neposreden JSON `portal/jobs`. Ob pregledu 26. 11. je vrnil 9 objav; osem naslovov ni imelo enakega naslova v obstoječem DeloRadarju. Po eno HTTP-zahtevo za seznam in največ tri vzporedne za manjkajoče opise, z 14-dnevnim predpomnilnikom. Celoten opis vsebuje naloge, pričakovanja in ponudbo; osebnih stikov ne objavljamo.
- **Celtra (nov vir):** uradni Trakstar RSS `/jobfeeds/celtra` vrne 9 izvirnih oglasov, od tega **6 za Slovenijo**. Vseh šest že vsebuje poln opis v istem RSS-odgovoru, stabilni ID, neposredni HTTPS URL in kraj Ljubljana. Samo **en HTTP-zahtevek na zajem**, brez obiskov posameznih oglasov. Pri preverjanju noben od šestih ni imel povsem enakega naziva pri delodajalcu Celtra v prejšnjem DeloRadarjevem posnetku.
- **Dvojniki:** trenutni najstrožji kriteriji so označili **20 parov**, med njimi en oglas IščiDelo, ki ustreza oglasu MojeDelo po nazivu, delodajalcu in kraju. IščiDelo za zdaj ohranimo zaradi možnosti novih unikatnih objav; sami oglasi v celotnem JSON-izvozu ostanejo nedotaknjeni.
- `dist/` vsebuje le `index.html` in `jobs.json`; zgodovinskih predogledov ZRSZ ne pakiramo več za objavo.

**JSON in podatki uporabnika:** objavljeni `jobs.json` shrani normalizirana dejansko pridobljena polja oglasov, status in število zapisov posameznega povezanega vira, katalog nepovezanih portalov ter datum zajema. Ne shranjuje celotnih surovih odgovorov portalov, zasebnih prijavnih podatkov ali uporabnikovih osebnih oznak. Gumb »Izvozi vse (JSON)« prenese vse trenutne oglase z razpoložljivimi polji, seznam virov in nepovezanih portalov, datum zajema/izvoza ter uporabnikova zaznamka `saved` in `status` za posamezen oglas. Izvoz filtriranih vsebuje še uporabljene filtre in alternativne zapise označenih dvojnikov. Zaznamki, statusi in nastavitve filtrov so sicer shranjeni samo v `localStorage` uporabnikovega brskalnika, ne na GitHubu in ne na drugih napravah.

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

Ob neposrednem ponovnem preverjanju 26. 11. 2026 je bilo med 3.947 oglasi dnevnega JSON-a 233 referenc `IE`. Za **81** od njih v 3.796 rezultatih uradnega iskalnika ni bilo niti enakega normaliziranega naziva; samo **ena** je imela hkrati enak naziv, delodajalca in rok. Javni aplikacijski JavaScript vsebuje pot za pridobitev podrobnosti po numeričnem ID-ju, ne pa povratne poizvedbe po registrski številki. Zato pri 232 `IE` ne ustvarimo ugibanih URL-jev.

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
| e-Študentski Servis (študentsko delo) | Javno straničen HTML, do 50 oglasov na zahtevek; ID, opis, kraj, plačilo, trajanje in delovnik brez obiska podstrani |
| Competo | Javni aplikacijski JSON: `/portal/jobs` in `/portal/jobs/{uid}`; postopni polni opisi in predpomnilnik |
| Celtra | Uradni Trakstar RSS z že objavljenimi polnimi opisi, državo, krajem in stabilnimi povezavami; en HTTP-zahtevek |
| Planet Labs, Wolt, Robinhood, Speechify, Outfit7, Plume, Teads | Dokumentiran javni Greenhouse Job Board JSON; opisi in objavljeni datumi v enem zahtevku za delodajalca; pri Outfit7 še strukturirana polja `metadata` za primere s praznim HTML opisom |
| Aleph, TSMG, RWS TrainAI | Dokumentiran javni Lever Postings JSON s filtriranjem slovenske lokacije že na strani strežnika |
| Povio, D-ploy, Laundryheap, SOFMEDICA, Moneyhub | Javni Workable JSON z `details=true`, po en HTTP-zahtevek na delodajalca; izločitev tujih lokacij in združitev več krajev istega razpisa po `shortcode` |
| Sportradar, JYSK Slovenija, Bosch Group, Primark, Anton Paar, AbbVie, Coface, Konecranes | Uradni javni SmartRecruiters Posting API s filtrom `country=si`, straničenjem in neposrednimi JSON opisi; največ trije zahtevki sočasno prek vseh podjetij in 14-dnevni predpomnilnik |
| XDS, Sunrise Robotics, Paradox, Axelera AI | Uradni Ashby Job Board JSON, en zahtevek vsebuje tudi celotno besedilo in neposredni URL; državo preverimo tudi v strukturiranem `addressCountry`, vključno s slovenskimi sekundarnimi lokacijami |

Vsi viri so preverjani ločeno. Če vir trenutno odpove, je označen z napako; en neuspešen vir ne izbriše oglasov drugih portalov. EURES je dodatni HTTP-uvoz z ločevanjem oglasov ZRSZ, preverjanjem lokacij in roka prijave. `EURES_HTTP_ENABLED=1` ga vključi v zbiralnik. Ker polni EURES-ov seznam zahteva več zahtevkov, si dva zaporedna 12-urna zagona lahko delita največ 20 ur star uspešen rezultat; potekle oglase izločimo.

Spodnji katalog nepovezanih virov zdaj vsebuje vse do zdaj raziskane portale, razvrščene po prednosti, s povezavo, statusom in naslednjim raziskovalnim korakom. Neuspešen prvi HTTP poskus vira trajno ne izloči. V seznamu povezanih virov so imena klikljiva, posebej je prikazano število verjetno podvojenih oglasov. Za reproducibilno revizijo lokalnega `jobs.json` je na voljo `npm run audit:snapshot`.

**Paket osmih kariernih virov (26. 11. 2026):** Speechify, Outfit7, Plume in Teads uporabljajo Greenhouse, Povio, D-ploy, Laundryheap in SOFMEDICA pa Workable. Načrtovani strošek zajema je **osem dodatnih HTTP-zahtevkov na gradnjo** skupaj, brez odpiranja posameznih oglasov v brskalniku. Pri Outfit7 izločamo splošne baze kandidatov in tudi iz javnih `metadata` pridobimo opis, naloge, veščine, izkušnje, ugodnosti ter morebitni slovenski naziv oglasa. Pri Workable več lokacij istega razpisa ne ustvari dodatnih oglasov; vsi dejansko navedeni slovenski kraji sodelujejo v filtrih.

**Paket sedmih novih povezanih virov:** Sportradar, JYSK Slovenija, Bosch Group, Primark in Anton Paar uporabljajo SmartRecruiters; Moneyhub uporablja Workable; XDS Ashby. Pri SmartRecruiters pridobimo vse slovenske objave neposredno z `country=si`, za vsako novo objavo preberemo uradne podrobnosti in jih predpomnimo za 14 dni. CI uporablja zmanjšano omejitev `DETAIL_SMARTRECRUITERS_LIMIT`, produkcijski zajem pa privzeto lahko dopolni do 100 novih opisov na posamezen vir. Eksperimentalni modul `source/novartis-workday.js` zna iz javnega Workday CXS pridobiti slovenske oglase, vendar ni priključen na produkcijo zaradi ponovljenega HTTP 429 na GitHubovem izvajalniku. Spletnih kartic ne odpiramo v brskalniku.

**Naslednji paket sedmih programskih virov:** Sunrise Robotics, Paradox in Axelera AI uporabljajo Ashby, AbbVie, Coface in Konecranes SmartRecruiters ter RWS TrainAI Lever. Posebej preverimo `address.postalAddress.addressCountry` in slovenske sekundarne lokacije, ker Ashby pri kandidatih za Slovenijo v kratkem polju `location` pogosto pokaže samo »CET +/- 3« ali primarno tujo pisarno. Za Slovenijo ne kopiramo vseh tujih lokacij. SmartRecruiters izloči splošne prijave, kot je »Send us your CV«, še pred zahtevki za opis. Sedem delodajalcev potrebuje sedem osnovnih seznamov in zgolj SmartRecruiters še omejene dodatne opise; popolne podatke predpomnimo po obstoječem postopku. LILT ostaja nepovezan zaradi več kot 4 MB velikega svetovnega izvoza za eno slovensko pozicijo.

Careerjet: ker pretežno povezuje oglase izvornih portalov, ga po dogovoru **ne prednostno vključujemo**. Javni seznam pri programskem HTTP-zahtevku vrne preverjanje prometa, običajna pot `/rss` ne obstaja, uradni `robots.txt` pa izključuje iskalni RSS-vmesnik. V rezervi ostaja preizkušena integracija `source/careerjet-data-api.js` z uradnim podatkovnim API-jem, če bi se pokazali res novi, unikatni oglasi; ključa trenutno nimamo in porabe ne sprožamo.

## Naslednji možni viri (še ne uvažamo)

- **LinkedIn Jobs:** uradni Job Posting API omogoča pooblaščenim partnerjem predvsem *objavljanje* razpisov, ne odprtega branja vseh slovenskih oglasov. Javni `/jobs-guest/` je izrecno izključen v robots.txt; brez primernega podatkovnega dostopa ne gradimo uvoza na tem naslovu.
- **HOFER Slovenija:** uradni `/rest/jobs/search` omogoča JSON poizvedbe brez brskalnika, a je 26. 11. 2026 vrnil `jobs: []`; ob praznem seznamu vira ne prikazujemo kot aktivnega.
- **Pošta Slovenije:** uradna stran zaposlitve usmerja v SAP SuccessFactors, kjer je treba še prepoznati zanesljiv strojno berljiv seznam slovenskih razpisov.
- **Bolha Zaposlitve:** prek HTTP smo pregledali 72 strani oziroma 1.728 različnih oglasov. Med 198 kandidati po nazivu ni bilo nobene potrjene registrske številke `IE`, ki bi rešila manjkajoče povezave ZRSZ. Pred priklopom je treba dokazati dodatne, res unikatne oglase in preveriti podvajanje z ZRSZ.
- **Delaj.si:** `/oglasi/feed/` vsebuje tudi tuje oglasne vire, običajni `/feed/` pa je RSS blogovskih objav, ne razpisov. Brez ustreznega slovenskega filtriranega izvornega podatkovnega kanala ne dodajamo nepreverjenih oglasov.
- **Zaposlitev.net:** naveden med portali v EURES-ovem pregledu slovenskega trga dela, toda ob preverjanju je HTTP vrnil 503. Za zdaj ga ne prištevamo med delujoče vire.
- **Careerjet:** brez podatkovnega ključa ali posredovanega izvoznega vira ni potrjenega samodejnega zajema. Izvorne oglase, ki jih že vračajo drugi povezani portali, DeloRadar prikazuje pri njihovem dejanskem izdajatelju.

## Podatki in prikaz

- Filtri: vir, regija, kraj, področje, delodajalec, čas, status in zaznamki; deluje združevanje verjetnih dvojnikov brez izgube izvornih zapisov.
- Varnostna presoja dvojnikov: enak normaliziran naziv, delodajalec in kraj; pri dveh objavah datum lahko manjka največ enemu, nikoli obema. Različni roki, dvoumne skupine treh oglasov in nepotrjeni ZRSZ ostanejo ločeni. Virov ne odstranjujemo na podlagi enega samega posnetka.
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
