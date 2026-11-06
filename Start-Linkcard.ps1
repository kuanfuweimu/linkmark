$ErrorActionPreference='Stop'
try {
 $health=Invoke-RestMethod -Uri 'http://127.0.0.1:43187/health' -TimeoutSec 2
 if($health.service -eq 'linkmark'){Write-Output 'Linkcard helper is already running. Reopen the Figma plugin.';exit 0}
 throw 'Port 43187 is occupied by another service.'
} catch {
 if($_.Exception.Message -eq 'Port 43187 is occupied by another service.'){throw}
}
$python=Get-Command python -ErrorAction SilentlyContinue
if(-not $python){throw 'Python 3 is required for the optional local helper. The plugin can still use cloud previews.'}
$entry=Join-Path $PSScriptRoot 'helper\server.py'
if(-not (Test-Path -LiteralPath $entry)){throw 'helper/server.py is missing. Keep the complete plugin folder together.'}
$runtime=Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$process=Start-Process -FilePath $python.Source -ArgumentList @('-X','utf8',('"'+$entry+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'helper.log') -RedirectStandardError (Join-Path $runtime 'helper-errors.log')
$process.Id | Set-Content -LiteralPath (Join-Path $runtime 'helper.pid')
for($attempt=0;$attempt -lt 20;$attempt++){
 Start-Sleep -Milliseconds 250
 try {$health=Invoke-RestMethod -Uri 'http://127.0.0.1:43187/health' -TimeoutSec 1;if($health.service -eq 'linkmark'){Write-Output 'Linkcard local preview is ready. Reopen Linkcard in Figma, then paste a URL.';exit 0}} catch {}
}
throw 'The helper did not start. See .runtime/helper-errors.log.'
