import { exec } from 'child_process';
import http from 'http';

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
  // Su Windows, apre il browser in modalità "--app", che nasconde la barra degli indirizzi,
  // le schede e i preferiti, facendolo sembrare un programma desktop nativo a tutti gli effetti!
  const command = `start "" msedge --app="${url}" || start "" chrome --app="${url}" || start "" "${url}"`;
  
  exec(command, (err) => {
    if (err) {
      console.error('Nota: Impossibile avviare in modalità --app, apertura del browser predefinito in corso...', err.message);
    }
  });
}

checkServer();
