import { exec, execFile } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const url = 'http://localhost:5173';
const maxRetries = 30;
let retries = 0;

console.log('⏳ Attesa dell\'avvio del server frontend per aprire l\'interfaccia...');

function checkServer() {
  http.get(url, (res) => {
    if (res.statusCode === 200 || res.statusCode === 304 || res.statusCode === 404) {
      console.log('🚀 Server frontend pronto! Apertura di EduDrive come applicazione standalone...');
      openStandaloneApp();
    } else {
      retry();
    }
  }).on('error', () => {
    retry();
  });
}

function retry() {
  retries++;
  if (retries <= maxRetries) {
    setTimeout(checkServer, 500);
  } else {
    console.log('⚠️ Tempo scaduto per l\'attesa del frontend. Tentativo di apertura comunque...');
    openStandaloneApp();
  }
}

function openStandaloneApp() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  // Elenco dei percorsi più comuni per i browser basati su Chromium su Windows, macOS e Linux
  const possiblePaths = [
    // Microsoft Edge (Windows)
    path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'),
    // Google Chrome (Windows)
    path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    // Brave Browser (Windows)
    path.join(programFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(programFilesX86, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Linux / generici
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/brave-browser'
  ];

  const browserPath = possiblePaths.find(p => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  if (browserPath) {
    console.log(`Avvio applicazione standalone tramite: ${browserPath}`);
    execFile(browserPath, [`--app=${url}`, '--window-size=1280,800'], (err) => {
      if (err) {
        console.error('Errore durante l\'avvio con execFile, tentativo con comando di fallback...', err.message);
        fallbackLaunch();
      }
    });
  } else {
    fallbackLaunch();
  }
}

function fallbackLaunch() {
  const command = process.platform === 'win32'
    ? `start "" msedge --app="${url}" || start "" chrome --app="${url}" || start "" "${url}"`
    : `open -n -a "Google Chrome" --args --app="${url}" || open "${url}"`;
    
  exec(command, (err) => {
    if (err) {
      console.error('Nota: Impossibile avviare in modalità standalone, apertura del browser predefinito...', err.message);
    }
  });
}

checkServer();
