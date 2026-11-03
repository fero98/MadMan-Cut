param([switch]$CheckOnly, [switch]$UseInstalledDependencies)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $root

# Discover per-user installations without changing the machine's environment.
$nodeRoot = Join-Path $env:LOCALAPPDATA 'Programs/NodeJS'
if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $nodeRoot)) {
    $node = Get-ChildItem -LiteralPath $nodeRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($node) { $env:Path = "$($node.FullName);$env:Path" }
}
$cargoBin = Join-Path $env:USERPROFILE '.cargo/bin'
if (Test-Path -LiteralPath $cargoBin) { $env:Path = "$cargoBin;$env:Path" }
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$visualStudio = $null
if (Test-Path -LiteralPath $vswhere) {
    $visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($LASTEXITCODE -ne 0) { throw 'Visual Studio discovery failed.' }
}
if ($visualStudio) {
    $llvm = Join-Path $visualStudio 'VC/Tools/Llvm/x64/bin'
    if (Test-Path -LiteralPath (Join-Path $llvm 'libclang.dll')) { $env:LIBCLANG_PATH = $llvm }
    $cmakeBin = Join-Path $visualStudio 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin'
    if (Test-Path -LiteralPath (Join-Path $cmakeBin 'cmake.exe')) { $env:Path = "$cmakeBin;$env:Path" }
}
if (!$env:LIBCLANG_PATH -and (Test-Path -LiteralPath 'C:/Program Files/LLVM/bin/libclang.dll')) {
    $env:LIBCLANG_PATH = 'C:/Program Files/LLVM/bin'
}
$missing = @()
foreach ($tool in @('node','npm.cmd','cargo','rustc','cmake')) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { $missing += $tool }
}
if (!$visualStudio) { $missing += 'Visual Studio C++ Build Tools and Windows SDK' }
if (!$env:LIBCLANG_PATH -or !(Test-Path -LiteralPath (Join-Path $env:LIBCLANG_PATH 'libclang.dll'))) { $missing += 'LLVM libclang' }
if ($missing.Count) {
    Write-Output 'Native Windows build is not ready. Missing:'
    $missing | ForEach-Object { Write-Output "  - $_" }
    Write-Output 'Run scripts/madman/install-build-tools.ps1, then retry this command.'
    exit 2
}
Write-Output 'Windows toolchain preflight passed.'
if ($CheckOnly) { exit 0 }

$appPath = Join-Path $root 'target/release/nuzky-app.exe'
$runningBuild = Get-Process -Name 'nuzky-app' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $appPath }
if ($runningBuild) { throw 'Close the editor running from target/release before building or packaging it.' }

if (!$UseInstalledDependencies) {
    & npm.cmd ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed.' }
# The bundler runs the typecheck and production frontend build through Tauri's beforeBuildCommand.
# The upstream setup verifies the FFmpeg, Vulkan and ONNX Runtime downloads.
. (Join-Path $root 'scripts/setup-windows-deps.ps1')
& node (Join-Path $root 'scripts/build-bundles.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Native Windows build failed.' }
Write-Output 'Installer: target/release/bundle/nsis/'
