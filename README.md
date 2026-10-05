# Klipper Print Dashboard

Een iPad-vriendelijk dashboard voor workshops met meerdere Klipper/Moonraker-printers. Deelnemers kiezen een vrije printer, tikken op hun letter en zien een voorbeeld van de 3D-geprinte letter voordat de print start.

## Deelnemers gebruiken het dashboard

1. Tik op de printerkleur die bij het handvat past en waar **Klaar om te printen** staat.
2. Tik in het lettervenster op de gewenste letter. Het grote voorbeeld laat de fysieke, 3D-geprinte letter zien.
3. Tik op **Print mijn letter**.
4. Haal de letter van het printbed wanneer de printer klaar is.

De letterkeuze is een groot raster met A tot en met Z. De knoppen zijn geschikt voor aanraken op een iPad. De printerstatus wordt elke vijf seconden bijgewerkt; vlak voor een live print controleert het dashboard nogmaals of de printer vrij is.

## iPad als app gebruiken

Open de dashboard-URL in Safari op de iPad. Tik op **Deel** en kies **Zet op beginscherm**. Start het dashboard daarna via het beginscherm. De instellingen en beheercode blijven bewaard in Safari op die iPad.

Het dashboard gebruikt de Quicksand-letterstijl en een warme papierkleur met turquoise accenten, in lijn met de 3Dindeklas-materialen. Als Quicksand niet geladen kan worden, gebruikt de pagina een lokale schreefloze fallback.

## Zonder printers testen

Voeg `?demo=1` toe aan het dashboardadres, bijvoorbeeld:

```text
http://192.168.1.20:8080/?demo=1
```

De demo toont een printer die klaar is, een printer die print, een gepauzeerde printer en een printer met een melding. Op de vrije printer kun je een gesimuleerde print starten en de voortgang zien. In demomodus doet de pagina geen verzoeken naar Moonraker.

Op GitHub Pages staat de demomodus altijd aan. Daardoor kan de publieke demo nooit een echte printer aansturen.

## Printeradressen beheren

Open `admin.html` of tik op **Beheer** onder aan het dashboard. Stel bij het eerste gebruik een beheercode van 4 tot 8 cijfers in. Vul per printer het IP-adres of de netwerknaam en de Moonraker-poort in. De standaardpoorten zijn `7125`, `7126`, `7127` en `7128`.

De instellingen worden lokaal in de browser opgeslagen. Ze gelden dus alleen voor die iPad/browser en worden niet naar de printerhost of andere apparaten gekopieerd. Stel de printeradressen in voordat deelnemers de iPad gebruiken.

De beheercode voorkomt dat deelnemers de beheerpagina per ongeluk openen. De code is geen serverbeveiliging: iemand met technische toegang tot de iPad kan lokale browserinstellingen aanpassen.

## Installeren naast Klipper in Docker

Voer dit uit op de Raspberry Pi of andere Docker-host waar Klipper en Moonraker draaien:

```bash
git clone https://github.com/3dindeklas/KlipperPrintDashboard.git
cd KlipperPrintDashboard
docker compose up -d
```

Open op de iPad `http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080`. Test zonder printers met `http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080/?demo=1`.

De Nginx-container serveert alleen de statische bestanden op poort `8080`. De browser van de iPad verbindt rechtstreeks met het IP-adres en de poort van elke printer. Je kunt die adressen later via de beheerpagina instellen.

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
| `admin.html`, `admin.js` | Beheer van printer-IP’s en poorten |
| `manifest.json` | Instellingen voor gebruik als webapp |
| `compose.yaml` | Nginx-webserver naast Klipper in Docker |
| `.github/workflows/deploy-pages.yml` | Publiceren van de GitHub Pages-demo |

## Problemen oplossen

- **Printer niet bereikbaar:** controleer of de iPad en printer op hetzelfde lokale netwerk zitten en of het ingestelde IP-adres en de poort kloppen.
- **CORS-fout:** controleer of `cors_domains` exact de dashboard-origin bevat, inclusief `http://` en `:8080`; herstart Moonraker daarna.
- **Startknop blijft uit:** alleen `standby`, `complete` en `cancelled` gelden als vrije printerstatus.
- **Printbestand niet gevonden:** controleer of het bestand met hoofdletter in de G-code-map van die printer staat, bijvoorbeeld `A.gcode`.
- **Verkeerde beheerinstellingen:** open **Beheer**, voer de code in en pas de adressen aan. **Herstel standaardadressen** zet de poorten en standaardhost terug.

## Moonraker API

Het dashboard leest `/printer/objects/query?print_stats&virtual_sdcard` uit en start een gekozen bestand met `POST /printer/print/start`, bijvoorbeeld `A.gcode`.
