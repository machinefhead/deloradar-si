# DeloRadar – navodila za razvoj

- Namen: pregled prostih delovnih mest v Sloveniji. Uporabnik se na razpise prijavlja sam.
- Javni vmesnik mora biti v slovenščini in dobro delovati na telefonu.
- Statični GitHub Pages prebere `jobs.json`. GitHub Actions izvaja zbiranje oglasov na približno šest ur, tudi ob izklopljenem osebnem računalniku.
- Trenutno podprta vira: Optius (RSS) in Kariera.si (javni seznam). Nov vir dodaj ločeno, po preverbi dostopa, pogojev uporabe in strukture; ne izmišljaj oglasov in ne obhajaj blokad.
- Hrani le osnovne javne metapodatke oglasa in povezavo do izvirne objave. Ne prepisuj celotnih oglasov.
- Pri novih virih dedupliciraj po stabilnem ID/URL; ne zamenjuj obstoječih z nepreverjenimi podatki.
- Filtri portal, regija, kraj, področje in delodajalec so večizbirni: ALI znotraj filtra, IN med različnimi filtri.
- Filtri, zaznamki in statusi se hranijo v localStorage trenutnega brskalnika; za zdaj se ne sinhronizirajo med napravami. Ne zahtevaj uporabniških profilov.
- Ne implementiraj samodejnega pošiljanja prošenj ali klicev.
- Pred spremembo javne objave preveri `npm test` in izdelavo `npm run build`. Ob izpadu vseh virov objave ne zamenjaj s prazno stranjo.
- Skrivnosti nikoli ne shranjuj v repozitorij. Oblačne baze trenutno še ne potrebujemo.
- Za pomembnejše nadgradnje uporabi razvojno vejo in pregled sprememb pred združitvijo v `main`.
