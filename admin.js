(() => {
  'use strict';

  const CONFIG_KEY = 'klipperPrintDashboard.printers.v1';
  const PIN_KEY = 'klipperPrintDashboard.adminPin.v1';
  const SESSION_KEY = 'klipperPrintDashboard.adminUnlocked';
  const definitions = [
    { id: 'black', name: 'Zwart', host: window.location.hostname || 'localhost', port: 7125, color: '#252a29' },
    { id: 'white', name: 'Wit', host: window.location.hostname || 'localhost', port: 7126, color: '#b9c2bd' },
    { id: 'purple', name: 'Paars', host: window.location.hostname || 'localhost', port: 7127, color: '#7d4bb3' },
    { id: 'printer4', name: 'Printer 4', host: window.location.hostname || 'localhost', port: 7128, color: '#5ab3b1' }
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
        port: Number(item.port) || definitions.find(definition => definition.id === item.id)?.port || 7125 + index,
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
      const color = createField('Randkleur van printerblok', 'color', 'color-input', printer.color, { 'aria-label': `Randkleur voor ${printer.name}` });
      const fields = document.createElement('div');
      fields.className = 'field-grid';
      fields.append(name.wrapper, host.wrapper, port.wrapper, color.wrapper);
      section.append(heading, fields);
      container.append(section);
    });
    document.getElementById('emptyPrinters').hidden = container.childElementCount > 0;
  }

  function unlock() {
    authCard.hidden = true;
    settingsPanel.hidden = false;
    sessionStorage.setItem(SESSION_KEY, 'yes');
    renderSettings();
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
    const inputs = [...container.querySelectorAll('.name-input')];
    inputs.at(-1)?.focus();
    inputs.at(-1)?.select();
    saveNotice.textContent = 'Printer toegevoegd. Pas de gegevens aan en sla de wijzigingen op.';
  });

  document.getElementById('printerSettings').addEventListener('input', event => {
    const section = event.target.closest('.admin-printer');
    if (!section) return;
    if (event.target.matches('.name-input')) {
      const name = event.target.value.trim() || 'Nieuwe printer';
      section.querySelector('.admin-printer-heading h3').textContent = name;
      section.querySelector('.button-delete').setAttribute('aria-label', `Verwijder ${name}`);
      section.querySelector('.color-input').setAttribute('aria-label', `Randkleur voor ${name}`);
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
