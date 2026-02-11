@echo off
REM Matrioshka Brain Scheduler Runner (Windows)
REM This script is invoked by Windows Task Scheduler to run heartbeat tasks

setlocal

REM Set workspace directory
if "%MATRIOSHKA_BRAIN_HOME%"=="" (
    set WORKSPACE_DIR=%USERPROFILE%\.matrioshka-brain
) else (
    set WORKSPACE_DIR=%MATRIOSHKA_BRAIN_HOME%
)

cd /d "%WORKSPACE_DIR%" || exit /b 1

REM Ensure logs directory exists
if not exist "%WORKSPACE_DIR%\logs" mkdir "%WORKSPACE_DIR%\logs"

REM Log execution
echo [%date% %time%] Running heartbeat... >> "%WORKSPACE_DIR%\logs\scheduler.log"

REM Detect which CLI to use
where claude >nul 2>&1
if %errorlevel%==0 (
    REM Claude Code CLI available
    claude code --prompt "Run heartbeat tasks from HEARTBEAT.md" >> "%WORKSPACE_DIR%\logs\scheduler.log" 2>&1
    goto :done
)

where codex >nul 2>&1
if %errorlevel%==0 (
    REM Codex CLI available
    codex --prompt "Run heartbeat tasks from HEARTBEAT.md" >> "%WORKSPACE_DIR%\logs\scheduler.log" 2>&1
    goto :done
)

REM Neither CLI found
echo ERROR: Neither 'claude code' nor 'codex' CLI found >> "%WORKSPACE_DIR%\logs\scheduler.log"
exit /b 1

:done
echo [%date% %time%] Heartbeat complete >> "%WORKSPACE_DIR%\logs\scheduler.log"
