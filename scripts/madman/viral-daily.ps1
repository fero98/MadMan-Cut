param(
    [ValidateSet('Check','Run','Install','Remove')][string]$Action = 'Check',
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$At = '09:00',
    [string]$Executable = (Join-Path $PSScriptRoot '../../target/debug/madman-discovery.exe')
)
$ErrorActionPreference = 'Stop'
$taskName = 'MADMAN Studio Viral Lab'
if ($Action -eq 'Remove') {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Output 'Daily task removed. Local data and API credentials were retained.'
    exit 0
}
$worker = [IO.Path]::GetFullPath($Executable)
if (!(Test-Path -LiteralPath $worker -PathType Leaf)) { throw "Build the worker first: cargo build --locked -p madman-discovery. Missing: $worker" }
if ($env:NUZKY_DATA_DIR) { throw 'Clear NUZKY_DATA_DIR before configuring the real daily task; it currently selects override storage.' }
if ($Action -eq 'Run') {
    & $worker daily
    if ($LASTEXITCODE -ne 0) { throw "Discovery failed ($LASTEXITCODE). Open Viral Lab for setup and run history." }
    exit 0
}
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($Action -eq 'Check') {
    Write-Output "Worker: $worker"
    Write-Output "Windows timezone: $((Get-TimeZone).Id)"
    if ($existing) { $existing | Select-Object TaskName,State; Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime,LastTaskResult,NextRunTime }
    else { Write-Output 'Daily scheduling is not installed. Configure and test the key in Viral Lab first.' }
    exit 0
}
if ($existing) { throw 'The task already exists. Remove it explicitly before replacing it.' }
if ((Get-TimeZone).Id -ne 'Central Europe Standard Time') { throw 'This schedule expects Prague Windows time (Central Europe Standard Time). Configure the intended Windows timezone first.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskAction = New-ScheduledTaskAction -Execute $worker -Argument 'daily' -WorkingDirectory ([IO.Path]::GetDirectoryName($worker))
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# Access this user's keychain without collecting a Windows password or requesting elevation.
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Description 'Metadata-only discovery. No media downloads, paid AI generation or publishing.' | Select-Object TaskName,State
Write-Output "Installed at $At Prague time while this user is signed in. Missed starts run when available."
