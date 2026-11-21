# DeloRadar 🇸🇮

Pregled prostih delovnih mest iz slovenskih zaposlitvenih portalov: **[odpri aplikacijo](https://machinefhead.github.io/deloradar-si/)**.

## Prva različica

- Vira: **Optius** in **Kariera.si**. Pri vsakem oglasu je povezava do izvirnega portala.
- Večizbirni filtri: zaposlitveni portal, regija, kraj, poklicno področje, delodajalec. Dodatno: iskanje, datum objave, rok prijave, status, zaznamki.
- Izvoz filtriranega seznama v CSV; ročno označevanje zanimivih in kontaktiranih oglasov.
- Filtri in osebne oznake so shranjeni **v trenutnem brskalniku** (`localStorage`); telefon in računalnik za zdaj **nista sinhronizirana**.
- GitHub Actions predvidoma na **6 ur** pridobi oglase in objavi statično stran; stran se ob obisku poveže z zadnjim objavljenim `jobs.json`. Osveži gumb ponovno prebere ta posnetek, ne sproži novega zajema.
- Regije in področja so ocenjena iz navedenega kraja/naziva; nepopolnih podatkov ne ugibamo. Oglasi lahko že potečejo med dvema zajemoma, zato preveri izvirnik.

## Zagon in preverjanje

Potrebujete **Node.js 22+**. Dodatnih paketov ni.

```bash
npm test
npm run build
```

Generirana statična stran je v `dist/` (`index.html`, `jobs.json`). Za lokalni test brez internetnega zajema je na voljo `node scripts/build-site.mjs --fixture POT/DO/PODATKOV.json`.

## Objavljanje

GitHub Pages uporablja **GitHub Actions** (`.github/workflows/pages.yml`): ob spremembi `main`, ročno in po urniku. Če oba vira odpovesta, sestavljanje odpove in prejšnja uspešna objava ostane na spletu.

Razširitve z novimi viri, bolj zanesljivimi regijami in morebitnim zasebnim računom bomo razvijali postopoma. V prvi različici **ni** oblačne podatkovne baze in **ni** avtomatskega pošiljanja prijav.
