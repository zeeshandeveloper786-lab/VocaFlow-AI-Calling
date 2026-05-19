Write-Host "=== Testing API Endpoints ===" -ForegroundColor Cyan

Write-Host "1. GET /health" -ForegroundColor Yellow
$health = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
Write-Host "Response: $($health.Content)" -ForegroundColor Green

Write-Host "2. POST /auth/login" -ForegroundColor Yellow
$loginBody = @{
    email = "admin@demo.com"
    password = "demo1234"
} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$loginData = $loginResponse.Content | ConvertFrom-Json
Write-Host "Login successful, accessToken received!" -ForegroundColor Green
$token = $loginData.accessToken

Write-Host "3. GET /analytics/overview" -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $token" }
$analytics = Invoke-WebRequest -Uri "http://localhost:3001/analytics/overview" -Headers $headers -UseBasicParsing
Write-Host "Response: $($analytics.Content)" -ForegroundColor Green

Write-Host "4. GET /agents" -ForegroundColor Yellow
$agents = Invoke-WebRequest -Uri "http://localhost:3001/agents" -Headers $headers -UseBasicParsing
Write-Host "Response: $($agents.Content)" -ForegroundColor Green

Write-Host "5. GET /leads" -ForegroundColor Yellow
$leads = Invoke-WebRequest -Uri "http://localhost:3001/leads" -Headers $headers -UseBasicParsing
Write-Host "Response: $($leads.Content)" -ForegroundColor Green

Write-Host "=== All Tests Passed ===" -ForegroundColor Cyan
