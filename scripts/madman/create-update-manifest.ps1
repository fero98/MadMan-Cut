param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [string]$OutputDirectory = 'target/madman-release'
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $root
$config = Get-Content 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
$version = [string]$config.version
if ($version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') { throw 'Invalid application version.' }
$artifact = Get-Item -LiteralPath $Installer
if ($artifact.Extension -ine '.exe') { throw 'Expected a Windows NSIS installer.' }
$signature = (Get-Content -LiteralPath ($artifact.FullName + '.sig') -Raw).Trim()
$decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($signature))
if ($decoded -notmatch ("(?m)^trusted comment:.*(?:\t| )version:" + [regex]::Escape($version) + '(?:\s|$)')) {
    throw 'The signature is not bound to the current application version.'
}
$tag = 'v' + $version
$name = [uri]::EscapeDataString($artifact.Name)
$url = "https://github.com/fero98/MadMan-Cut/releases/download/$tag/$name"
$entry = @{ url = $url; signature = $signature }
$manifest = @{ version = $version; notes = "MadMan Cut $version"; pub_date = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'); platforms = @{ 'windows-x86_64-nsis' = $entry; 'windows-x86_64' = $entry } }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$destination = Join-Path $OutputDirectory 'latest.json'
$json = $manifest | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText([IO.Path]::GetFullPath($destination), $json + "`n", [Text.UTF8Encoding]::new($false))
Write-Output "Prepared $destination for $($artifact.Name)."
