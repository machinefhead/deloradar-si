# DeloRadar 🇸🇮

Pregled prostih delovnih mest iz slovenskih zaposlitvenih portalov: **[odpri aplikacijo](https://machinefhead.github.io/deloradar-si/)**.

## Prva različica

- Viri: **Optius** (12 regionalnih RSS-virov), **Kariera.si**, **GOV.SI** (aktualni javni razpisi) in **Atama** (javni seznam ponudbe dela). Pri vsakem oglasu je povezava do izvirnega portala.
- Večizbirni filtri: zaposlitveni portal, regija, kraj, poklicno področje, delodajalec. Izbire se medsebojno prilagajajo: npr. po izbiri Podravske so v seznamu krajev samo kraji, ki ustrezajo ostalim filtrom. Pri vsaki možnosti je število ujemajočih se oglasov, v spustnih seznamih pa deluje besedno iskanje. Dodatno: iskanje, datum objave, rok prijave, status, zaznamki.
- Izvoz filtriranega seznama v CSV; ročno označevanje zanimivih in kontaktiranih oglasov.
- Filtri in osebne oznake so shranjeni **v trenutnem brskalniku** (`localStorage`); telefon in računalnik za zdaj **nista sinhronizirana**.
- GitHub Actions predvidoma **vsakih 30 minut** pridobi oglase in objavi statično stran; urnik je lahko ob obremenitvah GitHuba zamaknjen. Stran se ob obisku poveže z zadnjim objavljenim `jobs.json`. Gumb »Preveri zadnji zajem« ponovno prebere ta posnetek, **ne sproži novega zajema**. Povezava »Ročni zajem prek GitHuba« odpre Actions, kjer lahko prijavljen lastnik izbere **Run workflow**; ko se zajem in objava končata, lahko znova preveri zadnji zajem. Sprotno osveževanje ob samem kliku bi potrebovalo dodatni strežniški API.
- Nevtralna temna tema in mobilna zložljiva razdelka »Filtri« ter »Stanje povezav in viri«.
- Optius omogoča oznake regij iz regionalnih RSS-virov, tudi ko ni navedenega natančnega kraja; posamezen oglas se lahko pojavi v več regijah, vendar je v skupni tabeli samo enkrat. Pri drugih virih se regije in področja ocenjujejo iz navedenega kraja/naziva; nepopolnih podatkov ne ugibamo.
- V tabeli je najprej 500 oglasov in gumb za prikaz naslednjih 500; CSV-izvoz zajame **vse** filtrirane zadetke. Oglasi lahko že potečejo med dvema zajemoma, zato preveri izvirnik.

## Zagon in preverjanje

Potrebujete **Node.js 22+**. Dodatnih paketov ni.

```bash
npm test
npm run build
```

Generirana statična stran je v `dist/` (`index.html`, `jobs.json`). Za lokalni test brez internetnega zajema je na voljo `node scripts/build-site.mjs --fixture POT/DO/PODATKOV.json`.

## Objavljanje

GitHub Pages uporablja **GitHub Actions** (`.github/workflows/pages.yml`): ob spremembi `main`, ročno in po urniku. Če oba vira odpovesta, sestavljanje odpove in prejšnja uspešna objava ostane na spletu.

Razširitve z novimi viri, bolj zanesljivimi regijami in morebitnim zasebnim računom za uporabnika in partnerko bomo razvijali postopoma. **GitHub Pages je za zdaj javen**; prijava še ni vgrajena. V prvi različici **ni** oblačne podatkovne baze in **ni** avtomatskega pošiljanja prijav.

ZRSZ v svojem iskalniku izrecno navaja, da ponovno objavljanje njihovih podatkov brez dovoljenja ni dovoljeno; zato tega vira ne vključujemo brez soglasja. Manpower v pravnih obvestilih izrecno prepoveduje avtomatsko zbiranje podatkov s portala; tudi tega vira ne zajemamo.
