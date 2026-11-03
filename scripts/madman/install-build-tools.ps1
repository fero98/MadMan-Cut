param([switch]$VisualStudioOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this setup script in an administrator PowerShell. Build the editor later as your normal user.'
}
$downloadDir = Join-Path $env:TEMP 'madman-build-tools'
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
$vsInstaller = Join-Path $downloadDir 'vs_BuildTools.exe'
Invoke-WebRequest 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $vsInstaller
$signature = Get-AuthenticodeSignature -LiteralPath $vsInstaller
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'The Visual Studio installer does not have a valid Microsoft signature.'
}
$arguments = @('--quiet','--wait','--norestart','--nocache',
    '--add','Microsoft.VisualStudio.Workload.VCTools','--includeRecommended',
    '--add','Microsoft.VisualStudio.Component.VC.Llvm.Clang',
    '--add','Microsoft.VisualStudio.Component.VC.CMake.Project')
$process = Start-Process -FilePath $vsInstaller -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -notin @(0,3010)) { throw "Visual Studio setup failed: $($process.ExitCode). See the Visual Studio setup logs in TEMP." }
if ($process.ExitCode -eq 3010) { Write-Output 'Windows requests a restart before compiling.' }

if (!$VisualStudioOnly) {
    if (!(Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.cargo/bin/rustc.exe'))) {
        # rustup requires its installer to retain the exact rustup-init.exe filename.
        $rustInstaller = Join-Path $downloadDir 'rustup-init.exe'
        $rustUrl = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
        Invoke-WebRequest $rustUrl -OutFile $rustInstaller
        $sum = (Invoke-WebRequest "$rustUrl.sha256").Content
        if ($sum -is [byte[]]) { $sum = [Text.Encoding]::UTF8.GetString($sum) }
        $expected = ($sum.Trim() -split '\s+')[0]
        if ((Get-FileHash -LiteralPath $rustInstaller -Algorithm SHA256).Hash -ne $expected) { throw 'Rust checksum mismatch.' }
        & $rustInstaller -y --profile minimal --default-toolchain stable --default-host x86_64-pc-windows-msvc
        if ($LASTEXITCODE -ne 0) { throw 'Rust installation failed.' }
    }
}
Write-Output 'Build tools installed. Run scripts/madman/build-windows.ps1 from your normal user account.'
