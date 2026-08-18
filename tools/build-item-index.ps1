param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Output
)

$rows = Import-Csv -LiteralPath $Source | Select-Object -Skip 1
$seen = [System.Collections.Generic.HashSet[string]]::new()
$items = [System.Collections.Generic.List[object]]::new()

foreach ($row in $rows) {
  $id = 0
  if (-not [int]::TryParse([string]$row.key, [ref]$id)) { continue }
  # SaintCoinach CSV 的第二行是字段说明，名称字段为第 10 列（属性名 "9"）。
  $name = ([string]$row.'9').Trim()
  if ($id -le 0 -or [string]::IsNullOrWhiteSpace($name)) { continue }
  if ($seen.Add("$id|$name")) { [void]$items.Add(@($id, $name)) }
}

$json = $items | ConvertTo-Json -Compress -Depth 3
[System.IO.File]::WriteAllText($Output, "window.FF14_ITEM_INDEX=$json;`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($items.Count) item name/ID entries to $Output"
