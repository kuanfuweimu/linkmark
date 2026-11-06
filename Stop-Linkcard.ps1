$ErrorActionPreference='Stop'
$pidFile=Join-Path $PSScriptRoot '.runtime\helper.pid'
if(-not (Test-Path -LiteralPath $pidFile)){Write-Output 'No helper PID recorded for this folder.';exit 0}
$helperPid=[int](Get-Content -LiteralPath $pidFile)
$process=Get-CimInstance Win32_Process -Filter "ProcessId = $helperPid" -ErrorAction SilentlyContinue
if(-not $process){Write-Output 'Helper already stopped.';exit 0}
$entry=Join-Path $PSScriptRoot 'helper\server.py'
if(-not $process.CommandLine.Contains($entry)){throw 'PID now belongs to another process; refusing to stop it.'}
Stop-Process -Id $helperPid
Write-Output 'Linkcard helper stopped. Figma and project files are unchanged.'
