# Zentro Backend - Railway deploy helper
# Run in PowerShell: .\scripts\railway-deploy.ps1

Write-Host "Zentro Backend - Railway Deploy" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Host "Railway CLI not found. Install: npm i -g @railway/cli" -ForegroundColor Red
  exit 1
}

Write-Host "Step 1: Login to Railway (browser will open)..." -ForegroundColor Yellow
railway login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Step 2: Link this folder to your Railway project..." -ForegroundColor Yellow
railway link

Write-Host ""
Write-Host "Step 3: Deploy..." -ForegroundColor Yellow
railway up --detach

Write-Host ""
Write-Host "Step 4: Open service URL..." -ForegroundColor Yellow
railway open

Write-Host ""
Write-Host "Required Railway services + variables:" -ForegroundColor Green
Write-Host "  Postgres: DATABASE_URL=`${{Postgres.DATABASE_URL}}  DB_DIALECT=postgres"
Write-Host "  Redis:    REDIS_URL=`${{Redis.REDIS_URL}}  REDIS_ENABLED=true"
Write-Host "  MongoDB:  MONGODB_URI=`${{MongoDB.MONGO_URL}}  MONGODB_ENABLED=true  MONGODB_DB=shynvo"
Write-Host "  Uploads:  volume at /app/uploads  UPLOADS_DIR=/app/uploads"
Write-Host "  Secrets:  SH_API_KEY, JWT_SECRET, OPENAI_API_KEY, FRONTEND_ORIGIN"
Write-Host ""
Write-Host "GitHub auto-deploy: add repo secret RAILWAY_TOKEN (Railway account token), then pushes to main deploy via .github/workflows/railway-deploy.yml"
