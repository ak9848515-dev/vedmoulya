# VedMoulya SPRINT-056 secret scan (report locations only — never values)
$pat = 'AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|GOCSPX-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}'
$roots = @('apps','services','packages','scripts','configs')
$hits = New-Object System.Collections.Generic.List[string]
# NOT `$matches` — PowerShell's automatic `$Matches` hashtable (case-insensitive)
# silently shadows that name, so the previous counter printed
# `HIT_COUNT=System.Collections.Hashtable` instead of a number and the gate
# could not report how many files it flagged. `$matchCount` cannot collide.
$matchCount = 0
foreach ($r in $roots) {
  Get-ChildItem -Recurse -File -Path $r -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Extension -match '^\.(ts|tsx|mjs|js|py|sh|yml|yaml|json)$') {
      foreach ($line in (Get-Content $_.FullName -ErrorAction Ignore)) {
        if ($line -match $pat) { $matchCount++; $hits.Add($_.FullName) | Out-Null; break }
      }
    }
  }
}
Write-Output ('HIT_COUNT=' + $matchCount)
Write-Output '---FILES---'
$hits