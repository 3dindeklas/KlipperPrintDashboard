# Klipper Print Dashboard

Een eenvoudig printdashboard voor een iPad of ander apparaat op hetzelfde lokale netwerk als de printers. Bezoekers zien welke printer vrij is, kiezen een letter en starten daarmee het bijbehorende G-codebestand via Moonraker.

## Wat kan het dashboard?

- Toont vier printers met de namen en kleuren Zwart, Wit, Paars en Printer 4.
- Leest de status en printvoortgang via Moonraker.
- Laat alleen bij een vrije printer de knop **Start print** zien als actieve knop.
- Vraagt daarna om een letter en start het bestand met die letter, bijvoorbeeld `A.gcode`.
- Controleert de printerstatus opnieuw vlak voor het starten.
- Vangt verbindingsfouten en een trage Moonraker-verbinding op.
- Heeft een ingebouwde demomodus die zonder printers werkt en geen requests naar Moonraker verstuurt.

## De demo testen

Open het dashboard met `?demo=1` achter de URL. Bijvoorbeeld lokaal:

```text
http://localhost:8080/?demo=1
```

In de demo zie je verschillende voorbeeldsituaties: een vrije printer, een printer die print, een gepauzeerde printer en een foutmelding. Kies **Zwart** om een testprint te starten. De voortgang loopt vanzelf op. De demo verstuurt geen netwerkverzoeken en stuurt dus nooit een echte printer aan.

Op GitHub Pages start het dashboard altijd in demomodus. Zo kan de publieke demo nooit per ongeluk printers proberen te benaderen.

## Installeren naast Klipper in Docker

### Eenmalig installeren met Docker Compose

Voer dit uit op de Raspberry Pi of andere Docker-host waar Klipper en Moonraker draaien. De repo bevat al een `compose.yaml` voor de webserver.

```bash
git clone https://github.com/3dindeklas/KlipperPrintDashboard.git
cd KlipperPrintDashboard
docker compose up -d
```

Open daarna op de iPad:

```text
http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080
```

Voor testen zonder printers open je:

```text
http://<IP-ADRES-VAN-DE-DOCKER-HOST>:8080/?demo=1
```

De container serveert alleen de statische dashboardbestanden op poort `8080`. Moonraker-verzoeken gaan vanuit de browser rechtstreeks naar poorten `7125` tot en met `7128` op hetzelfde IP-adres. Zorg dat die Moonraker-poorten vanaf de iPad bereikbaar zijn.

### Installeren met één Docker-commando

Als je de repo al hebt gedownload, ga dan eerst in de map `KlipperPrintDashboard` staan en voer uit:

```bash
docker run -d \
  --name klipper-print-dashboard \
  --restart unless-stopped \
  -p 8080:80 \
  -v "$PWD:/usr/share/nginx/html:ro" \
  nginx:alpine
```

Controleer de container met:

```bash
docker ps --filter name=klipper-print-dashboard
docker logs klipper-print-dashboard
```

Werk de bestanden later bij met `git pull` in de repo-map; de nginx-container serveert de bijgewerkte bestanden direct. Om de container te verwijderen: `docker rm -f klipper-print-dashboard`.

### Moonraker instellen voor live gebruik

De browser laadt het dashboard vanaf bijvoorbeeld `http://192.168.1.20:8080` en vraagt daarna de printers op via `http://192.168.1.20:7125` tot en met `:7128`. Omdat dit verschillende origins zijn, moet Moonraker deze dashboard-origin toestaan. Voeg de exacte URL van het dashboard toe aan `cors_domains` in de `moonraker.conf` van **elke printer**. Neem de juiste sectie op of voeg de waarden toe aan een bestaande `[authorization]`-sectie:

```ini
[authorization]
cors_domains:
  http://192.168.1.20:8080
trusted_clients:
  192.168.1.42
```

Vervang `192.168.1.20` door het IP-adres van de Docker-host en `192.168.1.42` door het vaste IP-adres van de iPad. Voeg geen tweede `[authorization]`-sectie toe als die al bestaat. Herstart Moonraker na het aanpassen van de configuratie. Herhaal dit voor alle vier printers.

`trusted_clients` geeft het opgegeven apparaat brede toegang tot de Moonraker-API. Beperk dit daarom tot de iPad die het dashboard gebruikt en houd de printers op een vertrouwd lokaal netwerk. Gebruik geen `*` als CORS-domein. Stel de Moonraker-poorten niet open naar het internet.

De vier standaard Moonraker-poorten staan in `index.html`: `7125`, `7126`, `7127` en `7128`. Pas die daar aan als jouw installatie andere poorten gebruikt.

## GitHub Pages-demo

De workflow in `.github/workflows/deploy-pages.yml` kan de demo als statische website publiceren. De website draait standaard in demomodus en praat dan niet met printers.

1. Merge de workflow naar `main`.
2. Open in GitHub **Settings → Pages**.
3. Kies bij **Build and deployment** als source **GitHub Actions**.
4. De workflow publiceert de demo bij de volgende push naar `main` (of via **Actions → Deploy demo to GitHub Pages → Run workflow**).

GitHub Pages is bedoeld om de nepdata te bekijken. Gebruik de Docker-installatie op het lokale netwerk voor echte printers.

## Bestanden in de repo

| Bestand | Doel |
| --- | --- |
| `index.html` | Dashboard, live printerstatus en demomodus |
| `manifest.json` | Basisinstellingen voor toevoegen aan beginscherm |
| `compose.yaml` | Statische webserver voor de Docker-installatie |
| `.github/workflows/deploy-pages.yml` | Publiceert de demo via GitHub Pages |

## Veelvoorkomende problemen

- **Alle printers zijn niet bereikbaar:** controleer of de iPad en de printerhost op hetzelfde netwerk zitten en of poorten `7125`–`7128` vanaf de iPad bereikbaar zijn.
- **Moonraker geeft een CORS-fout:** controleer of `cors_domains` exact overeenkomt met de dashboard-URL, inclusief `http://` en `:8080`, en herstart Moonraker.
- **De knop blijft uitgeschakeld:** de printer moet `standby`, `complete` of `cancelled` melden. Bij `printing`, `paused`, een fout of een verbindingsprobleem kan er niet gestart worden.
- **Printstart mislukt:** controleer of het bestand met de hoofdletter op de printer staat, bijvoorbeeld `A.gcode` in de door Moonraker ingestelde G-code-map.

## Technische werking

Het dashboard vraagt elke vijf seconden `print_stats` en `virtual_sdcard` op via `/printer/objects/query`. Voor het starten controleert het de status opnieuw en stuurt daarna `POST /printer/print/start` met een vaste bestandsnaam zoals `A.gcode`.
