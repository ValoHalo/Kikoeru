param(
    [Parameter(Mandatory = $true)][string]$AppDir,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [switch]$Install,
    [switch]$HandlePending,
    [switch]$Rollback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$appRoot = [IO.Path]::GetFullPath($AppDir).TrimEnd([IO.Path]::DirectorySeparatorChar)
$dataRoot = [IO.Path]::GetFullPath($DataDir).TrimEnd([IO.Path]::DirectorySeparatorChar)
$updatesRoot = Join-Path $dataRoot "updates"
$installMarker = Join-Path $updatesRoot "install.json"
$startupPending = Join-Path $updatesRoot "startup-pending.json"
$stateFile = Join-Path $updatesRoot "state.json"
$lastResult = Join-Path $updatesRoot "last-result.json"
$backupApp = Join-Path $updatesRoot "previous-app"
$backupData = Join-Path $updatesRoot "previous-data"
$stagingRoot = Join-Path $updatesRoot "install-stage"
$programFiles = @("kikoeru-express.exe", "ffmpeg.exe", "ffprobe.exe", "update-kikoeru.ps1", "README.txt", "LICENSE")
$dataFiles = @("config\config.json", "sqlite\db.sqlite3", "sqlite\db.sqlite3-wal", "sqlite\db.sqlite3-shm")

function Write-JsonFile {
    param([string]$Path, [object]$Value)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    $temporary = "$Path.tmp"
    $json = $Value | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Test-IsInside {
    param([string]$BasePath, [string]$TargetPath)
    $base = [IO.Path]::GetFullPath($BasePath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $target = [IO.Path]::GetFullPath($TargetPath)
    return $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)
}

function Copy-BackupFile {
    param([string]$RelativePath, [string]$SourceRoot, [string]$DestinationRoot)
    $source = Join-Path $SourceRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
    $destination = Join-Path $DestinationRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

function Restore-PreviousVersion {
    param([object]$Pending)
    if (-not (Test-Path -LiteralPath $backupApp -PathType Container)) {
        throw "Previous application backup is missing: $backupApp"
    }
    foreach ($name in $programFiles) {
        $target = Join-Path $appRoot $name
        Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
        Copy-BackupFile -RelativePath $name -SourceRoot $backupApp -DestinationRoot $appRoot
    }
    foreach ($relativePath in $dataFiles) {
        if (Test-Path -LiteralPath (Join-Path $backupData $relativePath) -PathType Leaf) {
            Copy-BackupFile -RelativePath $relativePath -SourceRoot $backupData -DestinationRoot $dataRoot
        }
    }
    Remove-Item -LiteralPath $startupPending, $installMarker, $stateFile -Force -ErrorAction SilentlyContinue
    Write-JsonFile -Path $lastResult -Value ([ordered]@{
        status = "rolled-back"
        fromVersion = $Pending.fromVersion
        targetVersion = $Pending.targetVersion
        completedAt = [DateTime]::UtcNow.ToString("o")
    })
}

if ($Rollback) {
    $pending = Read-JsonFile $startupPending
    if ($null -eq $pending) { throw "No pending update can be rolled back" }
    Restore-PreviousVersion $pending
    exit 0
}

if ($HandlePending) {
    $pending = Read-JsonFile $startupPending
    if ($null -eq $pending) { exit 0 }
    if ($pending.stage -eq "ready") {
        $pending.stage = "started"
        $pending | Add-Member -NotePropertyName "startedAt" -NotePropertyValue ([DateTime]::UtcNow.ToString("o")) -Force
        Write-JsonFile -Path $startupPending -Value $pending
    }
    else {
        Restore-PreviousVersion $pending
    }
    exit 0
}

if (-not $Install) { throw "Specify -Install, -HandlePending, or -Rollback" }
$marker = Read-JsonFile $installMarker
if ($null -eq $marker) { throw "Update install marker is missing" }
$packagePath = [IO.Path]::GetFullPath([string]$marker.packagePath)
if (-not (Test-IsInside -BasePath $updatesRoot -TargetPath $packagePath)) {
    throw "Update package is outside the data update directory"
}
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw "Update package is missing: $packagePath"
}
$actualDigest = (Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath).Hash.ToLowerInvariant()
if ($actualDigest -ne ([string]$marker.digest).ToLowerInvariant()) {
    throw "Update package SHA-256 mismatch"
}

Remove-Item -LiteralPath $stagingRoot, $backupApp, $backupData -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stagingRoot, $backupApp, $backupData | Out-Null
Expand-Archive -LiteralPath $packagePath -DestinationPath $stagingRoot -Force
$contentRoot = $stagingRoot
$topDirectories = @(Get-ChildItem -LiteralPath $stagingRoot -Directory)
if ($topDirectories.Count -eq 1 -and (Test-Path -LiteralPath (Join-Path $topDirectories[0].FullName "kikoeru-express.exe") -PathType Leaf)) {
    $contentRoot = $topDirectories[0].FullName
}
foreach ($required in @("kikoeru-express.exe", "ffmpeg.exe", "ffprobe.exe", "update-kikoeru.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $contentRoot $required) -PathType Leaf)) {
        throw "Update package is missing $required"
    }
}

foreach ($name in $programFiles) {
    Copy-BackupFile -RelativePath $name -SourceRoot $appRoot -DestinationRoot $backupApp
}
foreach ($relativePath in $dataFiles) {
    Copy-BackupFile -RelativePath $relativePath -SourceRoot $dataRoot -DestinationRoot $backupData
}
$pending = [ordered]@{
    stage = "installing"
    fromVersion = $marker.fromVersion
    targetVersion = $marker.targetVersion
    createdAt = [DateTime]::UtcNow.ToString("o")
}
Write-JsonFile -Path $startupPending -Value $pending

try {
    foreach ($name in $programFiles) {
        $source = Join-Path $contentRoot $name
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $appRoot $name) -Force
        }
    }
    $pending.stage = "ready"
    $pending.installedAt = [DateTime]::UtcNow.ToString("o")
    Write-JsonFile -Path $startupPending -Value $pending
    Remove-Item -LiteralPath $installMarker -Force
}
catch {
    Restore-PreviousVersion $pending
    throw
}
