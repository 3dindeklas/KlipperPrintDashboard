# Klipper Print Dashboard

Een iPad-vriendelijk dashboard voor workshops met meerdere Klipper/Moonraker-printers. Deelnemers kiezen een vrije printer, tikken op hun letter en zien een voorbeeld van de 3D-geprinte letter voordat de print start.

## Deelnemers gebruiken het dashboard

1. Tik op de printer met het juiste filament en waar **Klaar om te printen** staat.
2. Tik in het lettervenster op de gewenste letter. Het grote voorbeeld laat de fysieke, 3D-geprinte letter zien.
3. Tik op **Print mijn letter**.
4. Haal de letter van het printbed wanneer de printer klaar is.

De letterkeuze is een groot raster met A tot en met Z. De knoppen zijn geschikt voor aanraken op een iPad. De printerstatus wordt elke vijf seconden bijgewerkt. Een print kan alleen worden geselecteerd wanneer Moonraker de Klipper-status `ready` meldt en de printer vrij is. Bij elke printer zie je ook de nozzle- en bedtemperatuur. Tijdens een print toont het dashboard de bestandsnaam, voortgang en geschatte resterende tijd. Met de vernieuwknop kun je de status direct opnieuw ophalen.

## iPad als app gebruiken

Open de dashboard-URL in Safari op de iPad. Tik op **Deel** en kies **Zet op beginscherm**. Start het dashboard daarna via het beginscherm. De instellingen en beheercode blijven bewaard in Safari op die iPad.

Het dashboard volgt de header en layout van [LayerBeacon](https://3dindeklas.github.io/LayerBeacon/): het 3Dindeklas-logo, “LEREN DOOR CREËREN”, Quicksand, pruimkleur en gele accentlijn. Het logo en de lettertypebestanden staan lokaal in de repository, zodat de vormgeving ook zonder externe fontdienst werkt.

## Zonder printers testen

Voeg `?demo=1` toe aan het dashboardadres, bijvoorbeeld:

```text
http://192.168.1.20:8080/?demo=1
```

De demo toont een printer die klaar is, een printer die print, een gepauzeerde printer en een printer met een melding. Op de vrije printer kun je een gesimuleerde print starten en de voortgang zien. In demomodus doet de pagina geen verzoeken naar Moonraker.

Op GitHub Pages staat de demomodus altijd aan. Daardoor kan de publieke demo nooit een echte printer aansturen.

## Printeradressen beheren

Open `admin.html` of tik op **Printerbeheer** onder aan het dashboard. Stel bij het eerste gebruik een beheercode van 4 tot 8 cijfers in. In Printerbeheer kun je lokale Moonrakers zoeken, printers toevoegen en verwijderen, printernamen aanpassen en per printer het IP-adres of de netwerknaam, de Moonraker-poort en de filamentkleur instellen. De standaardpoorten zijn `8401`, `8301`, `8201` en `8101`. Sla de wijzigingen op om de nieuwe printerlijst op het dashboard te tonen.

De instellingen worden lokaal in de browser opgeslagen. Ze gelden dus alleen voor die iPad/browser en worden niet naar de printerhost of andere apparaten gekopieerd. Stel de printeradressen in voordat deelnemers de iPad gebruiken.

In hetzelfde beheerscherm staat de Klipper-status per printer, naast de printstatus en temperaturen. Daar staan ook onderhoudsacties: assen homen, nozzle en bed voorverwarmen, koelen, een bed mesh meten en Klipper of de firmware herstarten. Voor iedere actie vraagt het dashboard om bevestiging. Bed mesh meten voert alleen de meting uit; sla een gewenste mesh daarna volgens de werkwijze van jouw printer op.

Onder **Printteller** zie je het aantal prints van vandaag, het totaal en de laatste registraties. Elke geslaagde print slaat de datum, letter en printer op. Zonder backend gebruikt de app browseropslag als terugval voor demo’s.

De beheercode voorkomt dat deelnemers de beheerpagina per ongeluk openen. De code is geen serverbeveiliging: iemand met technische toegang tot de iPad kan lokale browserinstellingen aanpassen.

## Installeren naast Klipper in Docker

Voer dit uit op de Raspberry Pi of andere Docker-host waar Klipper en Moonraker draaien:

```bash
git clone https://github.com/3dindeklas/KlipperPrintDashboard.git
cd KlipperPrintDashboard
mkdir -p data
docker compose up -d
```

Open op de iPad `http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080`. Test zonder printers met `http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080/?demo=1`.

De container serveert de statische bestanden en een kleine JSON-opslag voor de printteller op poort `8080`. De map `data/` blijft op de Docker-host staan, zodat de printregistratie behouden blijft wanneer de container opnieuw wordt aangemaakt. De browser van de iPad verbindt rechtstreeks met het IP-adres en de poort van elke printer. Je kunt die adressen later via de beheerpagina instellen.

### Moonraker voor live gebruik

Omdat de dashboard-URL en Moonraker verschillende poorten gebruiken, moet de exacte dashboard-origin in `cors_domains` staan in `moonraker.conf` van iedere printer. Neem de waarden op in de bestaande `[authorization]`-sectie; maak geen dubbele sectie:

```ini
[authorization]
cors_domains:
  http://192.168.1.20:8080
trusted_clients:
  192.168.1.42
```

Vervang `192.168.1.20` door het IP-adres van de Docker-host en `192.168.1.42` door het vaste IP-adres van de iPad. Herstart Moonraker na een configuratiewijziging. Voeg de exacte dashboard-URL toe en gebruik geen wildcard. Houd Moonraker en de printers op een vertrouwd lokaal netwerk; stel de printerpoorten niet open naar het internet.

## GitHub Pages-demo

De workflow `.github/workflows/deploy-pages.yml` kan de demo als statische website publiceren. Na het mergen van de workflow:

1. Open in GitHub **Settings → Pages**.
2. Kies bij **Build and deployment** als bron **GitHub Actions**.
3. De volgende push naar `main` publiceert de demo. Je kunt de workflow ook handmatig starten via **Actions → Deploy demo to GitHub Pages → Run workflow**.

Gebruik GitHub Pages alleen om de nepdata te bekijken. Voor echte printers gebruik je de Docker-installatie op het lokale netwerk.

## Bestanden

| Bestand | Doel |
| --- | --- |
| `index.html`, `app.js` | Deelnemersscherm, printerstatus en letterkeuze |
| `styles.css` | Huisstijl en mobiele/iPad-weergave |
| `admin.html`, `admin.js` | Printers zoeken/toevoegen/verwijderen en namen, IP’s, poorten en filamentkleuren beheren |
| `assets/` | 3Dindeklas-logo, Quicksand-lettertypen en fontlicentie |
| `icons/` | PWA-appicoon en printer-, bed- en vernieuwiconen |
| `manifest.json` | Instellingen voor gebruik als webapp |
| `compose.yaml` | Dashboardserver en printteller naast Klipper in Docker |
| `server.mjs` | Statische webserver en persistente printteller voor Docker |
| `.github/workflows/deploy-pages.yml` | Publiceren van de GitHub Pages-demo |

## Problemen oplossen

- **Printer niet bereikbaar:** controleer of de iPad en printer op hetzelfde lokale netwerk zitten en of het ingestelde IP-adres en de poort kloppen.
- **CORS-fout:** controleer of `cors_domains` exact de dashboard-origin bevat, inclusief `http://` en `:8080`; herstart Moonraker daarna.
- **Startknop blijft uit:** alleen `idle`, `standby`, `complete` en `cancelled` gelden als vrije printerstatus.
- **Printbestand niet gevonden:** controleer of de hoofdletterbestanden in `3dindeklas/fluidd_dashboard/letters/` in de G-code-map van de printer staan, bijvoorbeeld `A.gcode`.
- **Verkeerde beheerinstellingen:** open **Beheer**, voer de code in en pas de adressen aan. **Herstel standaardadressen** zet de poorten en standaardhost terug.
- **Lokale Moonraker-scan vindt niets:** de scan werkt vanuit de browser. Voeg de dashboard-origin toe aan `cors_domains` in Moonraker en controleer of de browser de Docker-host kan bereiken.

## Moonraker API

Het dashboard leest `/printer/objects/query` uit voor status, voortgang, bestandsnaam en temperaturen. Vóór het printen probeert het `BED_MESH_PROFILE LOAD=default` te laden; als dat niet lukt, gaat de print door. Het gekozen bestand wordt gestart met `POST /printer/print/start`, vanuit `3dindeklas/fluidd_dashboard/letters/`.
