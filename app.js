(() => {
  'use strict';

  const CONFIG_KEY = 'klipperPrintDashboard.printers.v1';
  const params = new URLSearchParams(window.location.search);
  const isGitHubPages = window.location.hostname.endsWith('.github.io');
  const demoMode = params.get('demo') === '1' || isGitHubPages;
  const printerDefinitions = [
    { id: 'black', name: 'Zwart', port: 7125, color: '#252a29' },
    { id: 'white', name: 'Wit', port: 7126, color: '#b9c2bd' },
    { id: 'purple', name: 'Paars', port: 7127, color: '#7d4bb3' },
    { id: 'printer4', name: 'Printer 4', port: 7128, color: '#5ab3b1' }
  ];
  const fakePrinters = {
    black: { state: 'standby' },
    white: { state: 'printing', baseProgress: 0.63, startedAt: Date.now(), durationMs: 90000 },
    purple: { state: 'paused', progress: 0.41 },
    printer4: { state: 'error', message: 'Printer heeft aandacht nodig' }
  };
  const modeBadge = document.getElementById('modeBadge');
  const printerGrid = document.getElementById('printers');
  const letterDialog = document.getElementById('letterDialog');
  const letterGrid = document.getElementById('letterGrid');
  const model = document.getElementById('letterModel');
  const previewName = document.getElementById('previewName');
  const dialogNotice = document.getElementById('dialogNotice');
  const confirmPrint = document.getElementById('confirmPrint');
  let selectedPrinter = null;
  let selectedLetter = 'A';
  let polling = false;

  if (demoMode) document.getElementById('adminLink').href = 'admin.html?demo=1';

  function defaultPrinters() {
    const host = window.location.hostname || 'localhost';
    return printerDefinitions.map(item => ({ ...item, host, port: item.port }));
  }

  function loadPrinters() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (!Array.isArray(saved)) return defaultPrinters();
      return saved.filter(item => item && typeof item === 'object').map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `printer-${index + 1}`,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : (printerDefinitions.find(printer => printer.id === item.id)?.name || `Printer ${index + 1}`),
        host: validHost(item.host) ? item.host : (window.location.hostname || 'localhost'),
        port: validPort(item.port) ? Number(item.port) : (printerDefinitions.find(printer => printer.id === item.id)?.port || 7125 + index),
        color: /^#[\da-f]{6}$/i.test(item.color || '') ? item.color : (printerDefinitions.find(printer => printer.id === item.id)?.color || '#4c325b')
      }));
    } catch {
      return defaultPrinters();
    }
  }

  function validHost(host) {
    return typeof host === 'string' && host.length <= 253 && /^[a-zA-Z0-9.-]+$/.test(host) && !host.startsWith('.') && !host.endsWith('.');
  }

  function validPort(port) {
    const value = Number(port);
    return Number.isInteger(value) && value >= 1 && value <= 65535;
  }

  let printers = loadPrinters();
  modeBadge.textContent = demoMode ? 'Demomodus · geen printerverbinding nodig' : 'Live · printerstatus wordt opgehaald';
  if (!demoMode) modeBadge.classList.add('live');

  function printerUrl(printer) {
    return `http://${printer.host}:${printer.port}`;
  }

  function createCard(printer) {
    const card = document.createElement('article');
    card.className = 'printer-card';
    card.style.setProperty('--printer-color', printer.color);
    card.innerHTML = `<div class="printer-top"><h2 class="printer-name"></h2></div><p class="printer-state"><span class="state-dot" aria-hidden="true"></span><span class="state-label">Status ophalen…</span></p><div class="progress-track" hidden><div class="progress-bar"></div></div><p class="printer-detail"></p><button class="button button-primary" type="button" disabled>Start mijn print</button>`;
    card.querySelector('.printer-name').textContent = printer.name;
    card.querySelector('button').addEventListener('click', () => openLetterPicker(printer));
    printer.card = card;
    printerGrid.append(card);
  }

  function renderPrinters() {
    printerGrid.replaceChildren();
    printers.forEach(createCard);
    document.getElementById('noPrinters').hidden = printers.length > 0;
  }

  function stateLabel(state) {
    return ({
      standby: 'Klaar om te printen', complete: 'Klaar om te printen', cancelled: 'Klaar om te printen',
      printing: 'Bezig met printen', paused: 'Print gepauzeerd', error: 'Printerfout',
      disconnected: 'Niet bereikbaar'
    })[state] || 'Status onbekend';
  }

  function renderStatus(printer, state, progress = 0, message = '') {
    const card = printer.card;
    const stateElement = card.querySelector('.printer-state');
    const ready = ['standby', 'complete', 'cancelled'].includes(state);
    stateElement.className = `printer-state state-${ready ? 'ready' : state === 'printing' ? 'printing' : state === 'paused' ? 'paused' : state === 'error' ? 'error' : 'offline'}`;
    card.querySelector('.state-label').textContent = message || stateLabel(state);
    const track = card.querySelector('.progress-track');
    track.hidden = state !== 'printing';
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    card.querySelector('.progress-bar').style.width = `${percent}%`;
    card.querySelector('.printer-detail').textContent = state === 'printing' ? `Voortgang: ${percent}%` : (demoMode && state === 'error' ? 'Voorbeeldsituatie' : '');
    card.querySelector('button').disabled = !ready;
  }

  function fakeStatus(printer) {
    const fake = fakePrinters[printer.id] || (fakePrinters[printer.id] = { state: 'standby' });
    if (fake.state === 'printing') {
      const base = fake.baseProgress || 0;
      fake.progress = Math.min(1, base + (1 - base) * (Date.now() - fake.startedAt) / fake.durationMs);
      if (fake.progress >= 1) fake.state = 'complete';
    }
    renderStatus(printer, fake.state, fake.progress || 0, fake.message || '');
  }

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      let data = {};
      if (text) {
        try { data = JSON.parse(text); }
        catch { throw new Error(`Ongeldig antwoord van printer (HTTP ${response.status})`); }
      }
      if (!response.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
      if (data?.error) throw new Error(data.error.message || data.error);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function updatePrinter(printer) {
    if (demoMode) return fakeStatus(printer);
    try {
      const data = await requestJson(`${printerUrl(printer)}/printer/objects/query?print_stats&virtual_sdcard`);
      const status = data?.result?.status;
      const state = status?.print_stats?.state;
      if (!state) throw new Error('Geen printerstatus ontvangen');
      renderStatus(printer, state, status?.virtual_sdcard?.progress || 0);
    } catch (error) {
      renderStatus(printer, 'disconnected', 0, 'Niet bereikbaar');
      console.warn(`Status van ${printer.name} ophalen mislukt:`, error);
    }
  }

  async function updateStatuses() {
    if (polling) return;
    polling = true;
    try { await Promise.all(printers.map(updatePrinter)); }
    finally { polling = false; }
  }

  function updateLetterPreview(letter) {
    selectedLetter = letter;
    model.textContent = letter;
    model.setAttribute('aria-label', `Voorbeeld van de 3D-letter ${letter}`);
    previewName.textContent = `Jouw letter: ${letter}`;
    letterGrid.querySelectorAll('.letter-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.letter === letter));
    });
  }

  function buildLetterButtons() {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const button = document.createElement('button');
      button.className = 'letter-button';
      button.type = 'button';
      button.dataset.letter = letter;
      button.textContent = letter;
      button.setAttribute('aria-label', `Kies de letter ${letter}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => updateLetterPreview(letter));
      letterGrid.append(button);
    }
  }

  function openLetterPicker(printer) {
    selectedPrinter = printer;
    document.getElementById('chosenPrinterName').textContent = printer.name;
    dialogNotice.textContent = '';
    updateLetterPreview('A');
    letterDialog.showModal();
  }

  async function startPrint() {
    if (!selectedPrinter || confirmPrint.disabled) return;
    const printer = selectedPrinter;
    const filename = `${selectedLetter}.gcode`;
    confirmPrint.disabled = true;
    dialogNotice.textContent = '';
    try {
      if (demoMode) {
        fakePrinters[printer.id] = { state: 'printing', baseProgress: 0, startedAt: Date.now(), durationMs: 30000 };
        letterDialog.close();
        await updateStatuses();
        return;
      }
      const latest = await requestJson(`${printerUrl(printer)}/printer/objects/query?print_stats`);
      const state = latest?.result?.status?.print_stats?.state;
      if (!['standby', 'complete', 'cancelled'].includes(state)) {
        await updatePrinter(printer);
        dialogNotice.textContent = 'Deze printer is niet meer vrij. Kies een andere printer.';
        return;
      }
      await requestJson(`${printerUrl(printer)}/printer/print/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename })
      });
      letterDialog.close();
      setTimeout(updateStatuses, 700);
    } catch (error) {
      console.error(`Print ${filename} starten op ${printer.name} mislukt:`, error);
      dialogNotice.textContent = `Starten is niet gelukt. Controleer of ${filename} op deze printer staat en probeer opnieuw.`;
    } finally {
      confirmPrint.disabled = false;
    }
  }

  document.getElementById('closeDialog').addEventListener('click', () => letterDialog.close());
  document.getElementById('cancelPrint').addEventListener('click', () => letterDialog.close());
  confirmPrint.addEventListener('click', startPrint);
  renderPrinters();
  buildLetterButtons();
  updateStatuses();
  setInterval(updateStatuses, 5000);
})();
