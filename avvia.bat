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

echo [2/2] Avvio simultaneo di Backend e dell'Applicazione Desktop EduDrive...
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cargo --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Avvio nativo con Tauri v2 Desktop App...
    echo.
    echo Premi CTRL+C in questa finestra per arrestare tutti i server quando hai finito.
    echo ===================================================
    echo.
    call npm run start:desktop
) else (
    echo Avvio in modalita' Standalone con browser predefinito...
    echo.
    echo Premi CTRL+C in questa finestra per arrestare tutti i server quando hai finito.
    echo ===================================================
    echo.
    call npm run start:app
)

if %errorlevel% neq 0 (
    echo.
    echo [Errore] Si e' verificato un problema durante l'esecuzione dei server.
    pause
)
