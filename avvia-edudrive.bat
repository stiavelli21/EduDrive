@echo off
title EduDrive - Avvio Rapido
echo ===================================================
echo   Avvio di EduDrive (Database + Backend + Frontend)
echo ===================================================
echo.

echo [1/3] Verifica e avvio di Docker (PostgreSQL + MinIO)...
docker compose up -d
if %errorlevel% neq 0 (
    echo [Attenzione] Docker potrebbe non essere in esecuzione o non installato. Verificare Docker Desktop.
)
echo.

echo [2/3] Avvio simultaneo del Backend (porta 3001) e Frontend (porta 5173)...
echo [3/3] Apertura dell'interfaccia come Programma Autonomo (senza schede o barra del browser)...
echo.
echo Premi CTRL+C in questa finestra per arrestare tutti i server quando hai finito.
echo ===================================================
echo.

npx concurrently --names "BACKEND,FRONTEND,APP" --prefix-colors "blue,green,yellow" "npm run dev --prefix backend" "npm run dev --prefix frontend" "node scripts/open-app.js"
