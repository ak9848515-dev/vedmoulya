# VedMoulya SPRINT-056 secret scan (report locations only — never values)
$pat = 'AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|GOCSPX-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}'
$roots = @('apps','services','packages','scripts','configs')
$hits = New-Object System.Collections.Generic.List[string]
$matches = 0
foreach ($r in $roots) {
  Get-ChildItem -Recurse -File -Path $r -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Extension -match '^\.(ts|tsx|mjs|js|py|sh|yml|yaml|json)$') {
      foreach ($line in (Get-Content $_.FullName -ErrorAction Ignore)) {
        if ($line -match $pat) { $matches++; $hits.Add($_.FullName) | Out-Null; break }
      }
    }
  }
}
Write-Output ('HIT_COUNT=' + $matches)
Write-Output '---FILES---'
$hits