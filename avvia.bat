@echo off
title EduDrive - Avvio in Modalita Locale Offline
echo ==============================================================================
echo EduDrive - Avvio Applicazione Locale
echo ==============================================================================

echo Controllo stato di Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker non risulta avviato. Tentativo di avvio di Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
    ) else (
        echo ATTENZIONE: Docker Desktop non trovato nei percorsi standard. Assicurati che Docker sia installato e avviato.
    )

    echo Attesa avvio di Docker in corso...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_docker
    echo Docker avviato con successo.
) else (
    echo Docker e gia attivo e pronto.
)

echo.
echo Avvio dei contenitori Docker (Database e Storage locale)...
docker compose up -d

echo.
echo Avvio di EduDrive in modalita Locale Offline...
set LOCAL_MODE=true
npm run start:local
