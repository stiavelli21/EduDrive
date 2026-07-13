@echo off
title EduDrive - Costruzione App Desktop (.exe) 100% Cloud
echo ===================================================================
echo   Compilazione dell'App Desktop EduDrive (.exe) connessa al Cloud
echo   (Render.com API + Database Neon.tech + Cloudflare R2 Storage)
echo ===================================================================
echo.
echo [1/2] Verifica e installazione delle dipendenze di compilazione...
call npm install --silent
echo.
echo [2/2] Creazione del pacchetto di installazione standalone (.exe)...
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
call npm run build:desktop

if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo [SUCCESSO] Compilazione terminata con successo! 🎉
    echo ===================================================================
    echo.
    echo Il tuo file di installazione (.exe) si trova nella cartella:
    echo 👉 frontend\src-tauri\target\release\bundle\nsis\
    echo    (oppure sotto \msi\)
    echo.
    echo Fai doppio clic sul file .exe creato per installare o avviare la
    echo tua applicazione EduDrive 100%% Cloud dal tuo Windows!
    echo.
) else (
    echo.
    echo ===================================================================
    echo [ERRORE] Si e' verificato un problema durante la compilazione.
    echo Assicurati di avere Rust e i build tools di C++ installati sul PC.
    echo ===================================================================
    echo.
)
pause
