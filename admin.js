(() => {
  'use strict';

  const CONFIG_KEY = 'klipperPrintDashboard.printers.v1';
  const PIN_KEY = 'klipperPrintDashboard.adminPin.v1';
  const SESSION_KEY = 'klipperPrintDashboard.adminUnlocked';
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get('demo') === '1' || window.location.hostname.endsWith('.github.io');
  const maintenanceBusy = new Set();
  let maintenancePolling = false;
  const definitions = [
    { id: 'black', name: 'Zwart', host: window.location.hostname || 'localhost', port: 8401, color: '#252a29' },
    { id: 'white', name: 'Wit', host: window.location.hostname || 'localhost', port: 8301, color: '#b9c2bd' },
    { id: 'purple', name: 'Paars', host: window.location.hostname || 'localhost', port: 8201, color: '#7d4bb3' },
    { id: 'printer4', name: 'Printer 4', host: window.location.hostname || 'localhost', port: 8101, color: '#5ab3b1' }
  ];
  const standardPorts = [8401, 8301, 8201, 8101];
  const legacyPorts = [7125, 7126, 7127, 7128];
  const authCard = document.getElementById('authCard');
  const settingsPanel = document.getElementById('settingsPanel');
  const authForm = document.getElementById('authForm');
  const pinInput = document.getElementById('pinInput');
  const confirmPinInput = document.getElementById('confirmPinInput');
  const authNotice = document.getElementById('authNotice');
  const settingsForm = document.getElementById('settingsForm');
  const saveNotice = document.getElementById('saveNotice');
  let isFirstRun = !localStorage.getItem(PIN_KEY);

  function newId() {
    return `printer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (!Array.isArray(saved)) return definitions.map(item => ({ ...item }));
      return saved.filter(item => item && typeof item === 'object').map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : newId(),
        name: typeof item.name === 'string' && item.name.trim() ? item.name : (definitions.find(definition => definition.id === item.id)?.name || `Printer ${index + 1}`),
        host: typeof item.host === 'string' && item.host ? item.host : (window.location.hostname || 'localhost'),
        port: legacyPorts.includes(Number(item.port)) && Number(item.port) === legacyPorts[index] ? standardPorts[index] : (Number(item.port) || definitions.find(definition => definition.id === item.id)?.port || standardPorts[index] || 8401),
        color: /^#[\da-f]{6}$/i.test(item.color || '') ? item.color : (definitions.find(definition => definition.id === item.id)?.color || '#4c325b')
      }));
    } catch { return definitions.map(item => ({ ...item })); }
  }

  function applyAuthMode() {
    isFirstRun = !localStorage.getItem(PIN_KEY);
    document.getElementById('authTitle').textContent = isFirstRun ? 'Beheercode instellen' : 'Beheer openen';
    document.getElementById('authDescription').textContent = isFirstRun
      ? 'Stel een code van 4 tot 8 cijfers in voordat je de printerinstellingen wijzigt.'
      : 'Voer de beheercode in om de printerinstellingen te wijzigen.';
    document.getElementById('pinLabel').textContent = isFirstRun ? 'Nieuwe beheercode' : 'Beheercode';
    document.getElementById('authSubmit').textContent = isFirstRun ? 'Code opslaan' : 'Open beheer';
    document.getElementById('confirmPinField').hidden = !isFirstRun;
    confirmPinInput.required = isFirstRun;
  }

  function createField(labelText, inputType, className, value, attributes = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    const label = document.createElement('label');
    const input = document.createElement('input');
    const fieldId = `${className}-${newId()}`;
    label.htmlFor = fieldId;
    label.textContent = labelText;
    input.id = fieldId;
    input.type = inputType;
    input.className = className;
    input.value = value;
    for (const [name, attrValue] of Object.entries(attributes)) input.setAttribute(name, attrValue);
    wrapper.append(label, input);
    return { wrapper, input };
  }

  function renderSettings() {
    const container = document.getElementById('printerSettings');
    container.replaceChildren();
    getSettings().forEach((printer, index) => {
      const section = document.createElement('section');
      section.className = 'admin-printer';
      section.style.setProperty('--printer-color', printer.color);
      section.dataset.printerId = printer.id;
      const heading = document.createElement('div');
      heading.className = 'admin-printer-heading';
      const title = document.createElement('h3');
      title.textContent = printer.name || `Printer ${index + 1}`;
      const remove = document.createElement('button');
      remove.className = 'button button-delete';
      remove.type = 'button';
      remove.textContent = 'Verwijderen';
      remove.setAttribute('aria-label', `Verwijder ${printer.name || `printer ${index + 1}`}`);
      remove.addEventListener('click', () => {
        const nameInput = section.querySelector('.name-input');
        const name = nameInput.value.trim() || `Printer ${index + 1}`;
        if (!window.confirm(`Printer “${name}” verwijderen?`)) return;
        section.remove();
        saveNotice.textContent = `${name} verwijderd. Sla de wijzigingen op om dit definitief te bewaren.`;
      });
      heading.append(title, remove);

      const name = createField('Printernaam', 'text', 'name-input', printer.name, { maxlength: '48', required: '' });
      const host = createField('IP-adres of netwerknaam', 'text', 'host-input', printer.host, { inputmode: 'url', autocomplete: 'off', placeholder: 'bijvoorbeeld 192.168.1.20', required: '' });
      const port = createField('Moonraker-poort', 'number', 'port-input', printer.port, { inputmode: 'numeric', min: '1', max: '65535', required: '' });
      const color = createField('Filamentkleur', 'color', 'color-input', printer.color, { 'aria-label': `Filamentkleur voor ${printer.name}` });
      const fields = document.createElement('div');
      fields.className = 'field-grid';
      fields.append(name.wrapper, host.wrapper, port.wrapper, color.wrapper);
      const maintenance = document.createElement('section');
      maintenance.className = 'maintenance-panel';
      maintenance.innerHTML = '<h3>Onderhoud en bediening</h3><div class="maintenance-telemetry"><div class="telemetry-row"><img src="icons/extruder.svg" alt=""><span>Nozzle</span><strong class="admin-extruder-temp">— / — °C</strong></div><div class="telemetry-row"><img src="icons/heated-bed.svg" alt=""><span>Printbed</span><strong class="admin-bed-temp">— / — °C</strong></div></div><p class="maintenance-status" role="status" aria-live="polite">Printerstatus ophalen…</p><div class="maintenance-actions"></div>';
      const actionList = [
        ['home', 'Home alle assen', 'button-light'],
        ['preheat', 'Voorverwarmen', 'button-light'],
        ['cool', 'Koelen', 'button-light'],
        ['bed-mesh', 'Bed mesh meten', 'button-light'],
        ['restart-klipper', 'Herstart Klipper', 'button-warning'],
        ['restart-firmware', 'Herstart firmware', 'button-danger']
      ];
      const actions = maintenance.querySelector('.maintenance-actions');
      for (const [action, label, style] of actionList) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `button ${style}`;
        button.dataset.maintenanceAction = action;
        button.textContent = label;
        button.disabled = true;
        button.addEventListener('click', () => runMaintenanceCommand(printer, action, section));
        actions.append(button);
      }
      section.append(heading, fields, maintenance);
      container.append(section);
    });
    document.getElementById('emptyPrinters').hidden = container.childElementCount > 0;
  }

  function unlock() {
    authCard.hidden = true;
    settingsPanel.hidden = false;
    sessionStorage.setItem(SESSION_KEY, 'yes');
    renderSettings();
    refreshMaintenanceStatuses();
    if (!demoMode) setInterval(refreshMaintenanceStatuses, 10000);
  }

  function discoveryName(version, port) {
    return version ? `Moonraker ${version}` : `Moonraker localhost:${port}`;
  }

  async function discoverMoonrakers() {
    const button = document.getElementById('discoverPrinters');
    const results = document.getElementById('discoveryResults');
    const hosts = [...new Set([window.location.hostname, 'localhost', '127.0.0.1'].filter(host => host && !host.endsWith('.github.io')))];
    const ports = standardPorts;
    results.replaceChildren();
    button.disabled = true;
    button.textContent = 'Zoeken…';
    if (demoMode) {
      const message = document.createElement('p');
      message.textContent = 'Demomodus: lokale netwerkdetectie is uitgeschakeld.';
      results.append(message);
      button.disabled = false;
      button.textContent = 'Zoek printers';
      return;
    }
    const found = [];
    const probe = async (host, port) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900);
      try {
        const response = await fetch(`http://${host}:${port}/server/info`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.result) found.push({ host, port, version: data.result.moonraker_version || '' });
      } catch { /* A closed port or CORS response is simply not a discovery result. */ }
      finally { clearTimeout(timer); }
    };
    await Promise.all(hosts.flatMap(host => ports.map(port => probe(host, port))));
    const unique = [...new Map(found.map(item => [`${item.host}:${item.port}`, item])).values()];
    if (!unique.length) {
      const empty = document.createElement('p');
      empty.textContent = demoMode ? 'Demomodus: lokale netwerkdetectie is uitgeschakeld.' : 'Geen bereikbare Moonraker gevonden. Controleer CORS en probeer het opnieuw.';
      results.append(empty);
    } else {
      unique.forEach(item => {
        const row = document.createElement('div');
        row.className = 'discovery-result';
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = discoveryName(item.version, item.port);
        const endpoint = document.createElement('span');
        endpoint.textContent = `http://${item.host}:${item.port}`;
        text.append(title, endpoint);
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'button button-primary';
        add.textContent = 'Toevoegen';
        add.addEventListener('click', () => addDiscoveredPrinter(item));
        row.append(text, add);
        results.append(row);
      });
    }
    button.disabled = false;
    button.textContent = 'Opnieuw zoeken';
  }

  function addDiscoveredPrinter(item) {
    const current = settingsFromForm();
    const exists = current.some(printer => printer.host === item.host && Number(printer.port) === item.port);
    if (exists) {
      saveNotice.textContent = `http://${item.host}:${item.port} staat al in de printerlijst.`;
      return;
    }
    const printer = { id: newId(), name: discoveryName(item.version, item.port), host: item.host, port: item.port, color: '#4c325b' };
    localStorage.setItem(CONFIG_KEY, JSON.stringify([...current, printer]));
    renderSettings();
    refreshMaintenanceStatuses();
    saveNotice.textContent = `${printer.name} toegevoegd. Pas eventueel de naam en filamentkleur aan en sla op.`;
  }

  const maintenanceCommands = {
    home: {
      prompt: 'De printer beweegt de assen naar de homingpositie. Controleer of er niets op het bed of in de bewegingsruimte ligt. Doorgaan?',
      script: 'G28'
    },
    preheat: {
      prompt: 'De nozzle wordt verwarmd tot 200 °C en het bed tot 60 °C. Doorgaan?',
      script: 'SET_HEATER_TEMPERATURE heater=extruder target=200\nSET_HEATER_TEMPERATURE heater=heater_bed target=60'
    },
    'bed-mesh': {
      prompt: 'De printer beweegt tijdens de bedmeting. Maak het printbed vrij en controleer de bewegingsruimte. Doorgaan?',
      script: 'BED_MESH_CALIBRATE'
    },
    cool: { prompt: 'De nozzle en het printbed uitschakelen en laten afkoelen?', script: 'TURN_OFF_HEATERS' },
    'restart-klipper': { prompt: 'Klipper op deze printer herstarten?', script: 'RESTART' },
    'restart-firmware': { prompt: 'De printerfirmware op deze printer herstarten?', script: 'FIRMWARE_RESTART' }
  };

  function formatTemperature(value) {
    if (value === null || value === undefined || value === '') return '— °C';
    const temperature = Number(value);
    return Number.isFinite(temperature) ? `${Math.round(temperature)} °C` : '— °C';
  }

  async function requestPrinterJson(url, options = {}) {
    const { timeout = 10000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      const responseText = await response.text();
      let data = {};
      if (responseText) {
        try { data = JSON.parse(responseText); }
        catch { throw new Error(`Ongeldig printerantwoord (HTTP ${response.status})`); }
      }
      if (!response.ok || data?.error) throw new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function currentPrinterEndpoint(printer, section) {
    const host = section.querySelector('.host-input').value.trim();
    const port = Number(section.querySelector('.port-input').value);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Vul eerst een geldig IP-adres en poort in.');
    return `http://${host}:${port}`;
  }

  async function refreshMaintenanceStatuses() {
    if (maintenancePolling || demoMode) {
      if (demoMode) document.querySelectorAll('.maintenance-status').forEach(status => { status.textContent = 'Demomodus: onderhoudsacties zijn uitgeschakeld.'; });
      return;
    }
    maintenancePolling = true;
    try {
      await Promise.all([...document.querySelectorAll('.admin-printer')].map(async section => {
        const printer = { id: section.dataset.printerId, name: section.querySelector('.name-input').value.trim() || 'Printer' };
        const status = section.querySelector('.maintenance-status');
        const buttons = [...section.querySelectorAll('[data-maintenance-action]')];
        try {
          const endpoint = currentPrinterEndpoint(printer, section);
          const data = await requestPrinterJson(`${endpoint}/printer/objects/query?print_stats=state&webhooks&extruder=temperature,target&heater_bed=temperature,target`);
          const machine = data?.result?.status || {};
          const state = machine.print_stats?.state;
          if (!state) throw new Error('Geen printerstatus ontvangen.');
          section.querySelector('.admin-extruder-temp').textContent = `${formatTemperature(machine.extruder?.temperature)} / ${formatTemperature(machine.extruder?.target)}`;
          section.querySelector('.admin-bed-temp').textContent = `${formatTemperature(machine.heater_bed?.temperature)} / ${formatTemperature(machine.heater_bed?.target)}`;
          status.textContent = state === 'printing' ? 'De printer is bezig. Onderhoudsacties zijn tijdelijk uitgeschakeld.' : `Status: ${state}`;
          const hot = Number(machine.extruder?.temperature) > 35 || Number(machine.extruder?.target) > 0 || Number(machine.heater_bed?.temperature) > 35 || Number(machine.heater_bed?.target) > 0;
          buttons.forEach(button => { button.disabled = state === 'printing' || maintenanceBusy.has(printer.id) || (button.dataset.maintenanceAction === 'cool' && !hot); });
        } catch (error) {
          status.textContent = `${printer.name} is niet bereikbaar: ${error.message}`;
          buttons.forEach(button => { button.disabled = true; });
        }
      }));
    } finally { maintenancePolling = false; }
  }

  async function runMaintenanceCommand(printer, action, section) {
    const command = maintenanceCommands[action];
    if (!command || demoMode || maintenanceBusy.has(printer.id)) return;
    if (!window.confirm(command.prompt)) return;
    const status = section.querySelector('.maintenance-status');
    const buttons = [...section.querySelectorAll('[data-maintenance-action]')];
    try {
      const endpoint = currentPrinterEndpoint(printer, section);
      maintenanceBusy.add(printer.id);
      buttons.forEach(button => { button.disabled = true; });
      status.textContent = 'Opdracht wordt verstuurd…';
      await requestPrinterJson(`${endpoint}/printer/gcode/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: command.script }),
        timeout: action === 'bed-mesh' ? 120000 : 20000
      });
      status.textContent = action.startsWith('restart-') ? 'Herstartopdracht verstuurd.' : 'Opdracht uitgevoerd.';
    } catch (error) {
      status.textContent = `Opdracht niet uitgevoerd: ${error.message}`;
    } finally {
      maintenanceBusy.delete(printer.id);
      setTimeout(refreshMaintenanceStatuses, 1000);
    }
  }

  function settingsFromForm() {
    return [...document.querySelectorAll('.admin-printer')].map(section => ({
      id: section.dataset.printerId,
      name: section.querySelector('.name-input').value.trim(),
      host: section.querySelector('.host-input').value.trim(),
      port: Number(section.querySelector('.port-input').value),
      color: section.querySelector('.color-input').value
    }));
  }

  authForm.addEventListener('submit', event => {
    event.preventDefault();
    authNotice.textContent = '';
    const code = pinInput.value;
    if (!/^\d{4,8}$/.test(code)) {
      authNotice.textContent = 'Gebruik een code van 4 tot 8 cijfers.';
      return;
    }
    if (isFirstRun) {
      if (code !== confirmPinInput.value) {
        authNotice.textContent = 'De codes zijn niet hetzelfde.';
        return;
      }
      localStorage.setItem(PIN_KEY, code);
      unlock();
      return;
    }
    if (code !== localStorage.getItem(PIN_KEY)) {
      authNotice.textContent = 'Deze code klopt niet. Probeer het opnieuw.';
      pinInput.select();
      return;
    }
    unlock();
  });

  document.getElementById('addPrinter').addEventListener('click', () => {
    const container = document.getElementById('printerSettings');
    const count = container.childElementCount + 1;
    const printer = { id: newId(), name: `Printer ${count}`, host: window.location.hostname || 'localhost', port: 7124 + count, color: '#4c325b' };
    const current = settingsFromForm();
    localStorage.setItem(CONFIG_KEY, JSON.stringify([...current, printer]));
    renderSettings();
    refreshMaintenanceStatuses();
    const inputs = [...container.querySelectorAll('.name-input')];
    inputs.at(-1)?.focus();
    inputs.at(-1)?.select();
    saveNotice.textContent = 'Printer toegevoegd. Pas de gegevens aan en sla de wijzigingen op.';
  });

  document.getElementById('discoverPrinters').addEventListener('click', discoverMoonrakers);

  document.getElementById('printerSettings').addEventListener('input', event => {
    const section = event.target.closest('.admin-printer');
    if (!section) return;
    if (event.target.matches('.name-input')) {
      const name = event.target.value.trim() || 'Nieuwe printer';
      section.querySelector('.admin-printer-heading h3').textContent = name;
      section.querySelector('.button-delete').setAttribute('aria-label', `Verwijder ${name}`);
      section.querySelector('.color-input').setAttribute('aria-label', `Filamentkleur voor ${name}`);
    }
    if (event.target.matches('.color-input')) section.style.setProperty('--printer-color', event.target.value);
  });

  settingsForm.addEventListener('submit', event => {
    event.preventDefault();
    saveNotice.textContent = '';
    const values = [];
    for (const section of document.querySelectorAll('.admin-printer')) {
      const id = section.dataset.printerId;
      const nameInput = section.querySelector('.name-input');
      const hostInput = section.querySelector('.host-input');
      const portInput = section.querySelector('.port-input');
      const colorInput = section.querySelector('.color-input');
      const name = nameInput.value.trim();
      const host = hostInput.value.trim();
      const port = Number(portInput.value);
      if (!name) { nameInput.setCustomValidity('Vul een printernaam in.'); nameInput.reportValidity(); nameInput.setCustomValidity(''); return; }
      if (!/^[a-zA-Z0-9.-]{1,253}$/.test(host) || host.startsWith('.') || host.endsWith('.')) {
        hostInput.setCustomValidity('Vul een IPv4-adres of netwerknaam in, zonder http:// of pad.');
        hostInput.reportValidity();
        hostInput.setCustomValidity('');
        return;
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) { portInput.reportValidity(); return; }
      values.push({ id, name, host, port, color: colorInput.value });
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(values));
    saveNotice.textContent = 'Printers opgeslagen. Het dashboard wordt geopend.';
    const demoQuery = new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : '';
    setTimeout(() => { window.location.href = `index.html${demoQuery}`; }, 450);
  });

  document.getElementById('resetEndpoints').addEventListener('click', () => {
    if (!window.confirm('De standaardprinters en instellingen herstellen?')) return;
    localStorage.removeItem(CONFIG_KEY);
    saveNotice.textContent = 'Standaardprinters hersteld. Sla op om terug te gaan naar het dashboard.';
    renderSettings();
  });

  const demoQuery = new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : '';
  const dashboardLink = document.querySelector('.header-link');
  if (dashboardLink) dashboardLink.href = `index.html${demoQuery}`;

  if (sessionStorage.getItem(SESSION_KEY) === 'yes') unlock();
  else applyAuthMode();
})();
