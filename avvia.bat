@echo off
title EduDrive - Avvio Rapido
echo ===================================================
echo   Avvio di EduDrive (Database + Backend + Frontend)
echo ===================================================
echo.

echo [1/2] Verifica stato del motore Docker...
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_ready

echo [Attenzione] Docker non e' in esecuzione!
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    echo [Avvio Automatico] Avvio di Docker Desktop in corso...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo [Errore] Docker Desktop non trovato in C:\Program Files\Docker\Docker\.
    echo Per favore avvia Docker Desktop manualmente.
)

echo Attesa dell'avvio completo del motore Docker...
set /a retries=0

:wait_docker
timeout /t 3 /nobreak >nul
set /a retries+=1
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_ready

if %retries% geq 30 (
    echo.
    echo [Errore] Tempo scaduto per l'avvio di Docker Desktop (90 secondi).
    echo Assicurati che Docker Desktop funzioni correttamente e riprova.
    pause
    exit /b 1
)

echo [%retries%/30] Motore Docker in fase di avvio, attendere prego...
goto wait_docker

:docker_ready
echo [OK] Motore Docker operativo!
echo.
echo Avvio dei container (PostgreSQL + MinIO)...
docker compose up -d
if %errorlevel% neq 0 (
    echo [Errore] Impossibile avviare i container Docker. Verifica Docker Desktop.
    pause
    exit /b 1
)
echo.

echo [2/2] Avvio simultaneo del Backend (porta 3001) e Frontend (porta 5173)...
echo Apertura automatica di EduDrive in modalita' Standalone...
echo.
echo Premi CTRL+C in questa finestra per arrestare tutti i server quando hai finito.
echo ===================================================
echo.

npx concurrently --names "BACKEND,FRONTEND,APP" --prefix-colors "blue,green,yellow" "npm run dev --prefix backend" "npm run dev --prefix frontend" "node scripts/open-app.js"
