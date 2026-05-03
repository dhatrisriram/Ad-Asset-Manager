@echo off
REM Ad Asset Manager - Setup Script for Windows
REM This script helps set up the project for local development or deployment

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Ad Asset Manager - Setup Script
echo ========================================
echo.

REM Check if pnpm is installed
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pnpm is not installed
    echo Install it with: npm install -g pnpm
    exit /b 1
)
echo [OK] pnpm is installed

REM Check if wrangler is installed
wrangler --version >nul 2>&1
if errorlevel 1 (
    echo [WARN] wrangler CLI is not installed globally
    echo Installing wrangler locally...
) else (
    echo [OK] wrangler is available
)

REM Check if git is initialized
if not exist .git (
    echo ERROR: Git repository not initialized
    echo Run: git init
    exit /b 1
)
echo [OK] Git repository found

echo.
echo Installing dependencies...
call pnpm install

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo Checking Cloudflare authentication...
wrangler whoami >nul 2>&1
if errorlevel 1 (
    echo [WARN] Not authenticated with Cloudflare
    echo Run: wrangler login
    echo This will open your browser to authorize the CLI.
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Setup Environment Variables:
echo    copy .env.example .env
echo    Edit .env and fill in your Cloudflare credentials
echo.
echo 2. For Local Development:
echo    Terminal 1 (Backend^):
echo    cd artifacts\api-server
echo    wrangler dev
echo.
echo    Terminal 2 (Frontend^):
echo    set PORT=5173
echo    set BASE_PATH=/
echo    set VITE_API_BASE_URL=http://localhost:8787
echo    cd artifacts\ads-platform
echo    pnpm run dev
echo.
echo 3. For Cloudflare Deployment:
echo    Review DEPLOYMENT.md for detailed instructions
echo    Quick start:
echo    - wrangler d1 create ad-asset-manager
echo    - Update wrangler.toml with database_id
echo    - cd artifacts\api-server ^&^& wrangler deploy
echo    - cd artifacts\ads-platform ^&^& npm run deploy
echo.
echo 4. Test the Application:
echo    Login with:
echo    - Email: demo@adshub.app
echo    - Password: demo
echo.
echo For more details, see README.md and DEPLOYMENT.md
echo.

pause
