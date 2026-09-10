Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$sourceWebRoot = Join-Path $repositoryRoot "web"
$sourceServerRoot = Join-Path $repositoryRoot "server"
$buildRoot = Join-Path $repositoryRoot ".build"
$webBuildRoot = Join-Path $buildRoot "work\web"
$serverBuildRoot = Join-Path $buildRoot "work\server"
$releaseConfig = Get-Content -LiteralPath (Join-Path $sourceServerRoot "scripts\release-config.json") -Raw | ConvertFrom-Json
$toolingRoot = Join-Path $buildRoot "tooling"
$frontendToolchain = Join-Path $toolingRoot $releaseConfig.frontendNode.directoryName
$frontendNode = Join-Path $frontendToolchain "node.exe"
$frontendNpm = Join-Path $frontendToolchain "npm.cmd"
$serverNode = (Get-Command node.exe -ErrorAction Stop).Source
$serverNpm = (Get-Command npm.cmd -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source

$fullCommitId = (& $git -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $fullCommitId -notmatch "^[0-9a-f]{40,64}$") {
    throw "Could not determine the current Git commit ID."
}
$commitId = $fullCommitId.Substring(0, 6)
$workingTreeChanges = & $git -C $repositoryRoot status --porcelain
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect the Git working tree."
}
if ($workingTreeChanges) {
    Write-Warning "The working tree has uncommitted changes; the ZIP name identifies HEAD ($commitId), not those changes."
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    Push-Location $WorkingDirectory
    try {
        Write-Host "> $FilePath $($Arguments -join ' ')"
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $FilePath"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-Download {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Destination,
        [hashtable]$Headers = @{}
    )
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
    $temporary = "$Destination.download"
    Write-Host "Downloading $Uri"
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -Headers $Headers -OutFile $temporary
    Move-Item -LiteralPath $temporary -Destination $Destination -Force
}

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludedDirectories = @()
    )
    $arguments = @($Source, $Destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($ExcludedDirectories.Count -gt 0) {
        $arguments += "/XD"
        $arguments += $ExcludedDirectories
    }
    & robocopy.exe @arguments
    if ($LASTEXITCODE -gt 7) {
        throw "Could not copy $Source to $Destination; robocopy exit code: $LASTEXITCODE"
    }
}

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null

if (-not (Test-Path -LiteralPath $frontendNode -PathType Leaf) -or
    -not (Test-Path -LiteralPath $frontendNpm -PathType Leaf)) {
    $nodeArchive = Join-Path $toolingRoot "$($releaseConfig.frontendNode.directoryName).zip"
    if (-not (Test-Path -LiteralPath $nodeArchive -PathType Leaf)) {
        Invoke-Download -Uri $releaseConfig.frontendNode.archiveUrl -Destination $nodeArchive
    }
    New-Item -ItemType Directory -Force -Path $toolingRoot | Out-Null
    Expand-Archive -LiteralPath $nodeArchive -DestinationPath $toolingRoot -Force
}

$ffmpegArchive = Join-Path $buildRoot "downloads\$($releaseConfig.ffmpeg.archiveFileName)"
if (-not (Test-Path -LiteralPath $ffmpegArchive -PathType Leaf)) {
    $headers = @{
        Accept = "application/octet-stream"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent" = "Kikoeru-Build"
    }
    if ($env:GITHUB_TOKEN) {
        $headers.Authorization = "Bearer $env:GITHUB_TOKEN"
    }
    Invoke-Download -Uri $releaseConfig.ffmpeg.archiveUrl -Destination $ffmpegArchive -Headers $headers
}
$ffmpegArchive = [System.IO.Path]::GetFullPath($ffmpegArchive)
if (-not (Test-Path -LiteralPath $ffmpegArchive -PathType Leaf)) {
    throw "FFmpeg archive not found: $ffmpegArchive"
}
$ffmpegHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ffmpegArchive).Hash.ToLowerInvariant()
if ($ffmpegHash -ne $releaseConfig.ffmpeg.archiveSha256) {
    throw "FFmpeg archive checksum mismatch. Expected $($releaseConfig.ffmpeg.archiveSha256), got $ffmpegHash"
}

Invoke-Robocopy -Source $sourceWebRoot -Destination $webBuildRoot -ExcludedDirectories @("node_modules", ".quasar", "dist")
Invoke-Robocopy -Source $sourceServerRoot -Destination $serverBuildRoot -ExcludedDirectories @("node_modules", ".runtime", "config", (Join-Path $sourceServerRoot "src\public"))
Copy-Item -LiteralPath (Join-Path $repositoryRoot "LICENSE") -Destination (Join-Path $serverBuildRoot "LICENSE")

Invoke-Step $frontendNpm @("ci", "--no-audit", "--no-fund", "--cache", (Join-Path $buildRoot "cache\frontend-npm")) $webBuildRoot
Invoke-Step $frontendNpm @("run", "build") $webBuildRoot

Invoke-Robocopy -Source (Join-Path $webBuildRoot "dist\pwa") -Destination (Join-Path $serverBuildRoot "src\public")

Invoke-Step $serverNpm @("ci", "--no-audit", "--no-fund", "--cache", (Join-Path $buildRoot "cache\server-npm")) $serverBuildRoot
Invoke-Step $serverNode @("--test", "test/unit/*.test.js") $serverBuildRoot
Invoke-Step $serverNode @("scripts/check-syntax.js") $serverBuildRoot

$previousBuildRoot = $env:KIKOERU_BUILD_ROOT
try {
    $env:KIKOERU_BUILD_ROOT = $buildRoot
    Invoke-Step $serverNpm @("run", "release:win", "--", "--ffmpeg-archive", $ffmpegArchive, "--commit-id", $commitId) $serverBuildRoot
}
finally {
    $env:KIKOERU_BUILD_ROOT = $previousBuildRoot
}

$temporaryZipPath = Join-Path $buildRoot "release\kikoeru-win-x64-$commitId.zip"
if (-not (Test-Path -LiteralPath $temporaryZipPath -PathType Leaf)) {
    throw "The build completed without producing the expected ZIP: $temporaryZipPath"
}
$zipPath = Join-Path $repositoryRoot "kikoeru-win-x64-$commitId.zip"
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Move-Item -LiteralPath $temporaryZipPath -Destination $zipPath -Force

$zip = Get-Item -LiteralPath $zipPath
[PSCustomObject]@{
    ZipPath = $zip.FullName
    ZipBytes = $zip.Length
    ZipSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
} | Format-List
