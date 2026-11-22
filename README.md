# DeloRadar 🇸🇮

Pregled prostih delovnih mest iz slovenskih zaposlitvenih portalov: **[odpri aplikacijo](https://machinefhead.github.io/deloradar-si/)**.

## Prva različica

- Viri: **Optius** (12 regionalnih RSS-virov), **Kariera.si**, **GOV.SI** (aktualni javni razpisi), **Atama** (javni seznam ponudbe dela), **Trenkwalder** (prva javna stran s približno 30 oglasi), **Agado** (javni seznam zaposlitvenih oglasov) in **Adecco** (uradni slovenski sitemap in javni strukturirani metapodatki JobPosting). Pri Agadu izločimo tuje zaposlitve in splošne vpise v bazo kandidatov. Pri Adeccu pregledamo do približno 164 povezav in iz majhnega začetnega dela strani pridobimo naziv, kraj, datum in rok, ne celotnega besedila oglasa. Trenkwalder javno prikazuje še več oglasov, vendar za celoten seznam ne uporabljamo internega API-ja, ki je v njihovem robots.txt izključen. Pri vsakem oglasu je povezava do izvirnega portala.
- Večizbirni filtri: zaposlitveni portal, regija, kraj, poklicno področje, delodajalec. Izbire se medsebojno prilagajajo: npr. po izbiri Podravske so v seznamu krajev samo kraji, ki ustrezajo ostalim filtrom. Pri vsaki možnosti je število ujemajočih se oglasov, v spustnih seznamih pa deluje besedno iskanje; iskalno polje se po izbiri oziroma zaprtju samodejno izprazni. Gumb »Počisti izbor« zapre meni. Glavni iskalnik ima X za izbris celotnega vnosa. Dodatno: datum objave, rok prijave, status, zaznamki. Nejasni dodatni iskalnik kraja in onemogočeni filter vrste zaposlitve sta odstranjena.
- Izvoz filtriranega seznama v CSV; ročno označevanje zanimivih in kontaktiranih oglasov.
- Filtri in osebne oznake so shranjeni **v trenutnem brskalniku** (`localStorage`); telefon in računalnik za zdaj **nista sinhronizirana**.
- GitHub Actions predvidoma **vsakih 30 minut** pridobi oglase in objavi statično stran; urnik je lahko ob obremenitvah GitHuba zamaknjen. Stran se ob obisku poveže z zadnjim objavljenim `jobs.json`. Gumb **»Osveži«** odpre GitHub Actions, kjer prijavljen lastnik izbere **Run workflow**. Sam klik na gumb na javni strani torej **ne zažene novega zajema**. Po uspešnem zajemu/objavi osveži spletno stran. Pod gumbom je datum zadnjega zajema. Sprotno osveževanje neposredno ob kliku bi potrebovalo dodatni strežniški API.
- Nevtralna temna tema in mobilna zložljiva razdelka »Filtri« ter »Stanje povezav in viri«.
- Optius omogoča oznake regij iz regionalnih RSS-virov, tudi ko ni navedenega natančnega kraja; posamezen oglas se lahko pojavi v več regijah, vendar je v skupni tabeli samo enkrat. Pri drugih virih se regije in področja ocenjujejo iz navedenega kraja/naziva; nepopolnih podatkov ne ugibamo.
- Tabela je razdeljena na strani, privzeto po **50** oglasov (izbira **10, 25, 50 ali 100** se shrani v brskalnik). Na voljo so na sredini poravnane številke strani, gumba prejšnja/naslednja ter **prva/zadnja stran**; izbira števila oglasov je na desni, na telefonu pa pod številkami. Ob spremembi filtrov se prikaz vrne na prvo stran. Pri pomiku navzdol se desno spodaj prikaže gumb za vrnitev na vrh. CSV-izvoz zajame **vse** filtrirane zadetke, ne samo trenutne strani. Oglasi lahko že potečejo med dvema zajemoma, zato preveri izvirnik.

## Zagon in preverjanje

Potrebujete **Node.js 22+**. Dodatnih paketov ni.

```bash
npm test
npm run build
```

Generirana statična stran je v `dist/` (`index.html`, `jobs.json`). Za lokalni test brez internetnega zajema je na voljo `node scripts/build-site.mjs --fixture POT/DO/PODATKOV.json`.

## Objavljanje

GitHub Pages uporablja **GitHub Actions** (`.github/workflows/pages.yml`): ob spremembi `main`, ročno in po urniku. Če vsi viri odpovedo oziroma vrnejo nič oglasov, sestavljanje odpove in prejšnja uspešna objava ostane na spletu.

Razširitve z novimi viri, bolj zanesljivimi regijami in morebitnim zasebnim računom za uporabnika in partnerko bomo razvijali postopoma. **GitHub Pages je za zdaj javen**; prijava še ni vgrajena. V prvi različici **ni** oblačne podatkovne baze in **ni** avtomatskega pošiljanja prijav.

ZRSZ v svojem iskalniku izrecno navaja, da ponovno objavljanje njihovih podatkov brez dovoljenja ni dovoljeno; zato tega vira ne vključujemo brez soglasja. Manpower v pravnih obvestilih izrecno prepoveduje avtomatsko zbiranje podatkov s portala; tudi tega vira ne zajemamo.
