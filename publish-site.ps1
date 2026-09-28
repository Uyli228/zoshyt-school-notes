$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$ghPath = $null

function Stop-Publish([string]$Message) {
    throw $Message
}

function Invoke-Gh([string[]]$Arguments, [switch]$AllowFailure) {
    $previousPreference = $ErrorActionPreference
    if ($AllowFailure) { $ErrorActionPreference = 'Continue' }
    try {
        $output = & $script:ghPath @Arguments 2>$null
        $code = $LASTEXITCODE
    } catch {
        if ($AllowFailure) { return $null }
        throw
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "Команда GitHub CLI завершила роботу з помилкою: gh $($Arguments -join ' ')"
    }
    if ($code -ne 0) { return $null }
    return $output
}
function Invoke-Git([string[]]$Arguments) {
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Команда Git завершила роботу з помилкою: git $($Arguments -join ' ')"
    }
}

try {
    Set-Location -LiteralPath $root
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-Publish 'Git не знайдено. Встанови Git for Windows і запусти файл ще раз.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) {
        Stop-Publish 'Не знайдено Git-репозиторій. Запусти цей файл із папки проєкту.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $root '.github/workflows/publish-pages.yml'))) {
        Stop-Publish 'Не знайдено файл автоматичної публікації GitHub Pages.'
    }

    $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghCommand) {
        $ghPath = $ghCommand.Source
    } else {
        Write-Host 'Для публікації потрібен GitHub CLI.' -ForegroundColor Yellow
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            Stop-Publish 'Автоматичне встановлення недоступне. Встанови GitHub CLI з https://cli.github.com/ і запусти цей файл знову.'
        }
        $installAnswer = Read-Host 'Встановити офіційний GitHub CLI через winget? (Y/N)'
        if ($installAnswer -notmatch '^(Y|YES|ТАК)$') {
            Stop-Publish 'GitHub CLI не встановлено. Після встановлення відкрий цей файл ще раз.'
        }
        & winget install --id GitHub.cli --exact --accept-source-agreements --accept-package-agreements
        $installExitCode = $LASTEXITCODE
        $candidates = @(
            (Join-Path $env:ProgramFiles 'GitHub CLI/gh.exe'),
            (Join-Path $env:LOCALAPPDATA 'Programs/GitHub CLI/gh.exe')
        )
        $ghPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $ghPath) {
            if ($installExitCode -ne 0) { Stop-Publish 'Не вдалося встановити GitHub CLI.' }
            Stop-Publish 'GitHub CLI встановлено. Закрий це вікно, відкрий файл ще раз і продовж публікацію.'
        }
    }

    & $ghPath auth status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Зараз відкриється GitHub для одноразового входу.' -ForegroundColor Cyan
        & $ghPath auth login --web --git-protocol https
        if ($LASTEXITCODE -ne 0) { Stop-Publish 'Вхід у GitHub не завершився.' }
    }
    Invoke-Gh @('auth', 'setup-git') | Out-Null

    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) { Stop-Publish 'Не вдалося визначити Git-гілку.' }
    if ($branch -ne 'main') {
        Invoke-Git @('branch', '-M', 'main')
    }

    $owner = (Invoke-Gh @('api', 'user', '--jq', '.login')).Trim()
    if (-not $owner) { Stop-Publish 'Не вдалося визначити GitHub-акаунт.' }

    $remotes = @(& git remote)
    if ($LASTEXITCODE -ne 0) { Stop-Publish 'Не вдалося перевірити Git remote.' }
    $hasOrigin = $remotes -contains 'origin'
    $origin = $null
    if ($hasOrigin) { $origin = (& git remote get-url origin).Trim() }
    if ($hasOrigin) {
        if ($origin -notmatch 'github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$') {
            Stop-Publish 'Для origin уже налаштовано інший сервер. Перевір Git remote перед публікацією.'
        }
        $repo = "$($Matches[1])/$($Matches[2])"
        $repoName = $Matches[2]
        Write-Host "Буде оновлено репозиторій $repo." -ForegroundColor Cyan
    } else {
        $repoName = Read-Host 'Назва нового репозиторію (Enter — zoshyt-school-notes)'
        if (-not $repoName) { $repoName = 'zoshyt-school-notes' }
        if ($repoName -notmatch '^[A-Za-z0-9_.-]+$') {
            Stop-Publish 'Назва може містити лише латинські літери, цифри, крапки, дефіси й підкреслення.'
        }
        $repo = "$owner/$repoName"
        # Перевірку наявності виконує команда create, щоб коректно обробити відсутній репозиторій у Windows PowerShell.
        Write-Host ''
        Write-Host "Буде створено відкритий репозиторій https://github.com/$repo" -ForegroundColor Yellow
        Write-Host 'Код сайту буде доступний усім. Особисті матеріали, які ти додаєш у браузері, до GitHub не надсилаються.'
        $publicAnswer = Read-Host 'Створити репозиторій і опублікувати сайт? (Y/N)'
        if ($publicAnswer -notmatch '^(Y|YES|ТАК)$') { Stop-Publish 'Публікацію скасовано.' }
        Invoke-Gh @('repo', 'create', $repo, '--public', '--source', $root, '--remote', 'origin', '--description', 'Моя навчальна бібліотека') | Out-Host
    }

    $siteFiles = @(
        'index.html', 'app.js', 'styles.css', 'favicon.svg', 'README.md', '.nojekyll',
        'publish-site.ps1', 'Опублікувати_сайт.bat', 'supabase-config.js', 'supabase/schema.sql', 'supabase/submissions.sql', '.github/workflows/publish-pages.yml'
    )
    $existingFiles = @($siteFiles | Where-Object { Test-Path -LiteralPath (Join-Path $root $_) })
    Invoke-Git (@('add', '--') + $existingFiles)
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Invoke-Git @('commit', '-m', 'Update study library')
    } elseif ($LASTEXITCODE -gt 1) {
        Stop-Publish 'Не вдалося перевірити зміни перед публікацією.'
    }

    $pagesUrl = Invoke-Gh @('api', "repos/$repo/pages", '--jq', '.html_url') -AllowFailure
    $pagesReady = [bool]$pagesUrl
    if (-not $pagesReady) {
        $pageSetup = Invoke-Gh @('api', '--method', 'POST', "repos/$repo/pages", '--field', 'build_type=workflow') -AllowFailure
        $pagesReady = [bool]$pageSetup
    }
    Invoke-Git @('push', '--set-upstream', 'origin', 'main')
    if (-not $pagesReady) {
        Invoke-Gh @('api', '--method', 'POST', "repos/$repo/pages", '--field', 'build_type=workflow') | Out-Host
        Invoke-Gh @('workflow', 'run', 'publish-pages.yml', '--repo', $repo, '--ref', 'main') | Out-Host
    }
    Write-Host 'Зачекай, GitHub Pages збирає сайт…' -ForegroundColor Cyan
    $runId = $null
    for ($attempt = 0; $attempt -lt 40 -and -not $runId; $attempt++) {
        $runId = Invoke-Gh @('run', 'list', '--repo', $repo, '--workflow', 'publish-pages.yml', '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId') -AllowFailure
        if (-not $runId) { Start-Sleep -Seconds 3 }
    }
    if (-not $runId) { Stop-Publish "Файли надіслано, але GitHub ще не показав запуск публікації. Перевір вкладку Actions: https://github.com/$repo/actions" }
    Invoke-Gh @('run', 'watch', $runId.Trim(), '--repo', $repo, '--exit-status', '--compact') | Out-Host

    $pagesUrl = Invoke-Gh @('api', "repos/$repo/pages", '--jq', '.html_url')
    if (-not $pagesUrl) { $pagesUrl = "https://$owner.github.io/$repoName/" }
    Write-Host ''
    Write-Host 'Сайт опубліковано:' -ForegroundColor Green
    Write-Host $pagesUrl -ForegroundColor Green
    Start-Process $pagesUrl
} catch {
    Write-Host ''
    Write-Host 'Не вдалося завершити публікацію.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Код сайту залишився на компʼютері; можна виправити причину й відкрити файл ще раз.'
} finally {
    Write-Host ''
    Read-Host 'Натисни Enter, щоб закрити це вікно' | Out-Null
}
