# Antigravity Auto Accept - 1-Click Interactive Installer
# Designed for fresh setups, credential onboarding, shortcut patching, and startup task registration.

param(
    [switch] $NonInteractive,
    [switch] $SkipRun
)

$ErrorActionPreference = "Stop"

function Write-Banner {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "        ANTIGRAVITY AUTO ACCEPT 2.0 - 1-CLICK INSTALLER         " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string] $Msg)
    Write-Host ""
    Write-Host "==> $Msg" -ForegroundColor Green
}

function Write-Info {
    param([string] $Msg)
    Write-Host "    $Msg" -ForegroundColor Gray
}

function Write-Success {
    param([string] $Msg)
    Write-Host "    [OK] $Msg" -ForegroundColor Cyan
}

function Write-Warn {
    param([string] $Msg)
    Write-Host "    [WARN] $Msg" -ForegroundColor Yellow
}

function Write-Err {
    param([string] $Msg)
    Write-Host "    [ERROR] $Msg" -ForegroundColor Red
}

Write-Banner

# 1. Determine Repository Root Directory
$RepoDir = $PSScriptRoot
if (-not $RepoDir -or -not (Test-Path (Join-Path $RepoDir "daemon.js"))) {
    $parent = Split-Path -Parent $PSScriptRoot
    if ($parent -and (Test-Path (Join-Path $parent "daemon.js"))) {
        $RepoDir = $parent
    } else {
        $RepoDir = (Get-Location).Path
    }
}

if (-not (Test-Path (Join-Path $RepoDir "daemon.js"))) {
    Write-Step "Downloading repository to $HOME\.antigravity-auto-accept..."
    $TargetDir = Join-Path $HOME ".antigravity-auto-accept"
    if (Get-Command git -ErrorAction SilentlyContinue) {
        if (-not (Test-Path $TargetDir)) {
            git clone "https://github.com/valzevox/antigravity-auto-accept.git" $TargetDir
        }
    } else {
        Write-Err "Git is required for fresh web installation. Please install Git from https://git-scm.com/"
        exit 1
    }
    $RepoDir = $TargetDir
}

Set-Location $RepoDir
Write-Info "Working directory: $RepoDir"

# 2. Check Prerequisites (Node.js & Git)
Write-Step "Checking prerequisites (Node.js & Git)..."

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js (>= 18.x) is not installed or not in PATH!"
    Write-Info "Download and install Node.js from: https://nodejs.org"
    exit 1
}

$nodeVersion = (& node -v)
Write-Success "Node.js detected: $nodeVersion"

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVersion = (& git --version)
    Write-Success "Git detected: $gitVersion"
} else {
    Write-Warn "Git is not installed. Automatic updates on reboot will be skipped until Git is installed."
}

# 3. Install NPM Dependencies
Write-Step "Installing project dependencies..."
& npm install --omit=dev --silent
if ($LASTEXITCODE -ne 0) {
    Write-Warn "npm install finished with warnings, continuing..."
} else {
    Write-Success "Dependencies installed successfully."
}

# 4. Patch Antigravity Shortcuts with --remote-debugging-port=9000
Write-Step "Patching Antigravity shortcuts with --remote-debugging-port=9000..."

$wscript = New-Object -ComObject WScript.Shell
$searchDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('CommonPrograms'),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
    (Join-Path $env:ALLUSERSPROFILE "Microsoft\Windows\Start Menu\Programs")
) | Select-Object -Unique

$patchedCount = 0
foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
        $shortcuts = Get-ChildItem -Path $dir -Filter "*Antigravity*.lnk" -Recurse -ErrorAction SilentlyContinue
        foreach ($item in $shortcuts) {
            try {
                $lnk = $wscript.CreateShortcut($item.FullName)
                if ($lnk.TargetPath -like "*Antigravity.exe*") {
                    if ($lnk.Arguments -notlike "*--remote-debugging-port=9000*") {
                        if ([string]::IsNullOrWhiteSpace($lnk.Arguments)) {
                            $lnk.Arguments = "--remote-debugging-port=9000"
                        } else {
                            $lnk.Arguments = "$($lnk.Arguments.Trim()) --remote-debugging-port=9000"
                        }
                        $lnk.Save()
                        Write-Success "Patched: $($item.FullName)"
                        $patchedCount++
                    } else {
                        Write-Info "Already patched: $($item.FullName)"
                        $patchedCount++
                    }
                }
            } catch {
                Write-Warn "Could not update shortcut: $($item.FullName)"
            }
        }
    }
}

if ($patchedCount -eq 0) {
    Write-Warn "No Antigravity shortcuts found to patch automatically."
    Write-Info "Make sure to launch Antigravity with: Antigravity.exe --remote-debugging-port=9000"
} else {
    Write-Success "Configured $patchedCount Antigravity shortcut(s) with port 9000."
}

# 5. Interactive Credential Setup Wizard
Write-Step "Setting up credentials (Discord & Telegram & Groq)..."

$configPath = Join-Path $RepoDir "config.json"
$examplePath = Join-Path $RepoDir "config.json.example"

$config = $null
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Info "Existing config.json loaded."
    } catch {
        $config = $null
    }
}

if (-not $config -and (Test-Path $examplePath)) {
    $config = Get-Content $examplePath -Raw | ConvertFrom-Json
}

if (-not $config) {
    $config = [PSCustomObject]@{
        webhooks = [PSCustomObject]@{
            discord = ""
            discordBot = [PSCustomObject]@{
                token = ""
                channelId = ""
                guildId = ""
                ownerUserId = ""
                mentionUserId = ""
            }
            telegram = [PSCustomObject]@{
                botToken = ""
                chatId = ""
            }
            customUrl = ""
        }
        groqApiKey = ""
        voiceEnabled = $true
        events = [PSCustomObject]@{
            onManualIntervention = $true
            onTaskCompleted = $true
            onAutoApproved = $true
            onError = $true
        }
    }
}

function Prompt-Value {
    param(
        [string] $Title,
        [string] $CurrentValue,
        [string] $HelpText
    )

    if ($NonInteractive) {
        return $CurrentValue
    }

    Write-Host ""
    Write-Host "  $Title" -ForegroundColor Yellow
    if ($HelpText) {
        Write-Host "  -> $HelpText" -ForegroundColor DarkGray
    }
    $masked = if ($CurrentValue -and $CurrentValue.Length -gt 10) {
        $CurrentValue.Substring(0, 4) + "..." + $CurrentValue.Substring($CurrentValue.Length - 4)
    } else {
        $CurrentValue
    }
    
    $promptMsg = if ($CurrentValue) { "  Current: [$masked] (Press Enter to keep): " } else { "  Enter value (Press Enter to skip): " }
    $inputVal = Read-Host $promptMsg
    if ([string]::IsNullOrWhiteSpace($inputVal)) {
        return $CurrentValue
    }
    return $inputVal.Trim()
}

if (-not $NonInteractive) {
    Write-Host "  Follow the prompts below to configure your bot credentials." -ForegroundColor Gray
    Write-Host "  (All fields are optional - press Enter to skip or keep existing values)" -ForegroundColor DarkGray

    # Discord Setup
    $botToken = $config.webhooks.discordBot.token
    $config.webhooks.discordBot.token = Prompt-Value "1. Discord Bot Token" $botToken "From Discord Developer Portal -> Bot -> Reset Token"

    $chanId = $config.webhooks.discordBot.channelId
    $config.webhooks.discordBot.channelId = Prompt-Value "2. Discord Channel ID" $chanId "Right-click your Discord channel -> Copy Channel ID"

    $ownerId = $config.webhooks.discordBot.ownerUserId
    $newOwner = Prompt-Value "3. Discord Owner User ID" $ownerId "Right-click your own Discord profile -> Copy User ID"
    $config.webhooks.discordBot.ownerUserId = $newOwner
    $config.webhooks.discordBot.mentionUserId = $newOwner

    $webhookUrl = $config.webhooks.discord
    $config.webhooks.discord = Prompt-Value "4. Discord Webhook URL (Optional for rich embeds)" $webhookUrl "Channel Settings -> Integrations -> Webhooks"

    # Groq Setup (Voice)
    $groqKey = $config.groqApiKey
    $config.groqApiKey = Prompt-Value "5. Groq API Key (Optional for Voice Control)" $groqKey "From https://console.groq.com/keys"

    # Telegram Setup
    $tgToken = $config.webhooks.telegram.botToken
    $config.webhooks.telegram.botToken = Prompt-Value "6. Telegram Bot Token (Optional)" $tgToken "From @BotFather"

    $tgChat = $config.webhooks.telegram.chatId
    $config.webhooks.telegram.chatId = Prompt-Value "7. Telegram Chat ID (Optional)" $tgChat "From @userinfobot"
}

# Save config.json (no BOM - Node's JSON.parse rejects a leading U+FEFF)
$jsonOutput = $config | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($configPath, $jsonOutput, (New-Object Text.UTF8Encoding $false))
Write-Success "Configuration saved to config.json"

# 6. Register Windows Scheduled Task for Startup
Write-Step "Registering Windows Startup Scheduled Task..."

$taskName = "AntigravityAutoAccept"
$bootCommand = "cmd.exe"
$bootArg = "/c `"cd /d `"$RepoDir`" && update.bat --boot && run.bat --background`""

try {
    $action = New-ScheduledTaskAction -Execute $bootCommand -Argument $bootArg -WorkingDirectory $RepoDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force >$null 2>&1
    Write-Success "Windows Scheduled Task registered: '$taskName' (Trigger: At Logon)"
    Write-Info "On system reboot, it will automatically execute: update.bat -> run.bat"
} catch {
    Write-Warn "Could not register Scheduled Task automatically: $($_.Exception.Message)"
    Write-Info "You can still run it anytime using run.bat."
}

# 7. Start the Service Now
if (-not $SkipRun) {
    Write-Step "Launching Antigravity Auto Accept daemon..."
    $runBat = Join-Path $RepoDir "run.bat"
    if (Test-Path $runBat) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$runBat`"" -WorkingDirectory $RepoDir
        Write-Success "Daemon launched via run.bat!"
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "              SETUP COMPLETED SUCCESSFULLY!                      " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Restart Antigravity using your patched Desktop or Start Menu icon." -ForegroundColor Yellow
Write-Host "2. Send '!status' or '!prompt hello' in your configured Discord channel." -ForegroundColor Yellow
Write-Host "3. Everything is automated: system reboot automatically updates & runs!" -ForegroundColor Yellow
Write-Host ""
