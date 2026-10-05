(() => {
  'use strict';

  const CONFIG_KEY = 'klipperPrintDashboard.printers.v1';
  const PIN_KEY = 'klipperPrintDashboard.adminPin.v1';
  const SESSION_KEY = 'klipperPrintDashboard.adminUnlocked';
  const definitions = [
    { id: 'black', name: 'Zwart', port: 7125, color: '#252a29' },
    { id: 'white', name: 'Wit', port: 7126, color: '#b9c2bd' },
    { id: 'purple', name: 'Paars', port: 7127, color: '#7d4bb3' },
    { id: 'printer4', name: 'Printer 4', port: 7128, color: '#5ab3b1' }
  ];
  const authCard = document.getElementById('authCard');
  const settingsPanel = document.getElementById('settingsPanel');
  const authForm = document.getElementById('authForm');
  const pinInput = document.getElementById('pinInput');
  const confirmPinInput = document.getElementById('confirmPinInput');
  const authNotice = document.getElementById('authNotice');
  const settingsForm = document.getElementById('settingsForm');
  const saveNotice = document.getElementById('saveNotice');
  let isFirstRun = !localStorage.getItem(PIN_KEY);

  function applyAuthMode() {
    isFirstRun = !localStorage.getItem(PIN_KEY);
    document.getElementById('authTitle').textContent = isFirstRun ? 'Beheercode instellen' : 'Beheer openen';
    document.getElementById('authDescription').textContent = isFirstRun
      ? 'Stel een code van 4 tot 8 cijfers in voordat je de printeradressen wijzigt.'
      : 'Voer de beheercode in om de printerinstellingen te wijzigen.';
    document.getElementById('pinLabel').textContent = isFirstRun ? 'Nieuwe beheercode' : 'Beheercode';
    document.getElementById('authSubmit').textContent = isFirstRun ? 'Code opslaan' : 'Open beheer';
    document.getElementById('confirmPinField').hidden = !isFirstRun;
    confirmPinInput.required = isFirstRun;
  }

  function getSettings() {
    const defaults = definitions.map(printer => ({ ...printer, host: window.location.hostname || 'localhost' }));
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (!Array.isArray(saved)) return defaults;
      return defaults.map(printer => ({ ...printer, ...(saved.find(item => item.id === printer.id) || {}) }));
    } catch { return defaults; }
  }

  function renderSettings() {
    const container = document.getElementById('printerSettings');
    container.replaceChildren();
    for (const printer of getSettings()) {
      const section = document.createElement('section');
      section.className = 'admin-printer';
      section.style.setProperty('--printer-color', printer.color);
      section.innerHTML = `<h2></h2><div class="field-grid"><div class="field"><label for="host-${printer.id}">IP-adres of netwerknaam</label><input id="host-${printer.id}" class="host-input" type="text" inputmode="url" autocomplete="off" placeholder="bijvoorbeeld 192.168.1.20" required></div><div class="field"><label for="port-${printer.id}">Moonraker-poort</label><input id="port-${printer.id}" class="port-input" type="number" inputmode="numeric" min="1" max="65535" required></div></div>`;
      section.querySelector('h2').textContent = printer.name;
      const host = section.querySelector('.host-input');
      host.value = printer.host || window.location.hostname;
      host.dataset.printerId = printer.id;
      const port = section.querySelector('.port-input');
      port.value = printer.port;
      port.dataset.printerId = printer.id;
      container.append(section);
    }
  }

  function unlock() {
    authCard.hidden = true;
    settingsPanel.hidden = false;
    sessionStorage.setItem(SESSION_KEY, 'yes');
    renderSettings();
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

  settingsForm.addEventListener('submit', event => {
    event.preventDefault();
    saveNotice.textContent = '';
    const values = [];
    for (const definition of definitions) {
      const hostInput = document.querySelector(`.host-input[data-printer-id="${definition.id}"]`);
      const portInput = document.querySelector(`.port-input[data-printer-id="${definition.id}"]`);
      const host = hostInput.value.trim();
      const port = Number(portInput.value);
      if (!/^[a-zA-Z0-9.-]{1,253}$/.test(host) || host.startsWith('.') || host.endsWith('.')) {
        hostInput.setCustomValidity('Vul een IPv4-adres of netwerknaam in, zonder http:// of pad.');
        hostInput.reportValidity();
        hostInput.setCustomValidity('');
        return;
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        portInput.reportValidity();
        return;
      }
      values.push({ id: definition.id, host, port });
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(values));
    saveNotice.textContent = 'Adressen opgeslagen. Het dashboard wordt geopend.';
    const demoQuery = new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : '';
    setTimeout(() => { window.location.href = `index.html${demoQuery}`; }, 450);
  });

  document.getElementById('resetEndpoints').addEventListener('click', () => {
    localStorage.removeItem(CONFIG_KEY);
    saveNotice.textContent = 'Standaardadressen hersteld. Sla op om terug te gaan naar het dashboard.';
    renderSettings();
  });

  if (sessionStorage.getItem(SESSION_KEY) === 'yes') unlock();
  else applyAuthMode();
})();
