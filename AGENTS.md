# DeloRadar – navodila za razvoj

- Namen: pregled prostih delovnih mest v Sloveniji. Uporabnik se na razpise prijavlja sam.
- Javni vmesnik mora biti v slovenščini in dobro delovati na telefonu.
- Statični GitHub Pages prebere `jobs.json`. GitHub Actions izvaja zbiranje oglasov predvidoma vsakih 30 minut (možne zamude), tudi ob izklopljenem osebnem računalniku. Lastnik lahko ročno sproži `workflow_dispatch` na GitHubu.
- Trenutno podprti viri: Optius (12 regionalnih RSS-virov), Kariera.si (javni seznam), GOV.SI (odprti javni razpisi) in Atama (javni seznam). Nov vir dodaj ločeno, po preverbi dostopa, pogojev uporabe in strukture; ne izmišljaj oglasov in ne obhajaj blokad. Zahtevke po regionalnih RSS-virov Optius omeji na tri hkrati.
- ZRSZ / PoiščiDelo izrecno prepoveduje ponovno objavo podatkov brez dovoljenja; do soglasja le povezava na njihov iskalnik.
- Manpower izrecno prepoveduje avtomatsko zbiranje podatkov, zato ga ne zajemaj brez njihovega pisnega dovoljenja.
- Hrani le osnovne javne metapodatke oglasa in povezavo do izvirne objave. Ne prepisuj celotnih oglasov.
- Pri novih virih dedupliciraj po stabilnem ID/URL; ne zamenjuj obstoječih z nepreverjenimi podatki.
- Filtri portal, regija, kraj, področje in delodajalec so večizbirni: ALI znotraj filtra, IN med različnimi filtri. Možnosti v posameznem filtru so odvisne od vseh drugih filtrov; prikaži število zadetkov ob posamezni možnosti ter omogoči besedno iskanje v seznamu.
- Oglas z več regijami (polje regions pri Optius) se v seznamu pokaže enkrat; pri filtrih se upoštevajo vse njegove regije. Če je znana samo regija, to tako tudi označi; ne izmišljaj kraja. Seznam prikazuje 500 naenkrat in omogoča prikaz vseh prek gumba, izvoz pa zajame celoten filtriran seznam.
- Filtri, zaznamki in statusi se hranijo v localStorage trenutnega brskalnika; za zdaj se ne sinhronizirajo med napravami. Ne zahtevaj uporabniških profilov.
- Gumb »Preveri zadnji zajem« trenutno le prebira GitHub Pages `jobs.json`. Povezava do GitHub Actions omogoča, da prijavljen lastnik ročno izvede `workflow_dispatch`. Ne prikazuj branja kot svežega strežniškega zajema; za neposreden zajem s klikom na javni strani je potreben ločen strežniški endpoint z varovanjem pred zlorabo.
- Ne implementiraj samodejnega pošiljanja prošenj ali klicev.
- Pred spremembo javne objave preveri `npm test` in izdelavo `npm run build`. Ob izpadu vseh virov objave ne zamenjaj s prazno stranjo.
- Skrivnosti nikoli ne shranjuj v repozitorij. Oblačne baze trenutno še ne potrebujemo.
- Za pomembnejše nadgradnje uporabi razvojno vejo in pregled sprememb pred združitvijo v `main`.
