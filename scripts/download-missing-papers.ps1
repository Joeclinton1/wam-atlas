$ErrorActionPreference = "Stop"

$paperDir = "C:\Users\joecl\OneDrive\Documents\PHD\Lit Reviews\wam papers"
$txtDir = Join-Path $paperDir "txt"
New-Item -ItemType Directory -Force -Path $paperDir, $txtDir | Out-Null

$papers = @(
  @{ Key = "gr1"; Url = "https://arxiv.org/pdf/2312.13139" },
  @{ Key = "gr2"; Url = "https://arxiv.org/pdf/2410.06158" },
  @{ Key = "vpp"; Url = "https://arxiv.org/pdf/2412.14803" },
  @{ Key = "uwm"; Url = "https://arxiv.org/pdf/2504.02792" },
  @{ Key = "uva"; Url = "https://arxiv.org/pdf/2503.00200" },
  @{ Key = "dreamgen"; Url = "https://arxiv.org/pdf/2505.12705" },
  @{ Key = "vidar"; Url = "https://arxiv.org/pdf/2507.12898" },
  @{ Key = "video-generators"; Url = "https://arxiv.org/pdf/2508.00795" },
  @{ Key = "genie"; Url = "https://arxiv.org/pdf/2508.05635" },
  @{ Key = "mowm"; Url = "https://arxiv.org/pdf/2509.21797" },
  @{ Key = "mimic-video"; Url = "https://arxiv.org/pdf/2512.15692" },
  @{ Key = "xr1"; Url = "https://arxiv.org/pdf/2511.02776" },
  @{ Key = "cosmos-policy"; Url = "https://arxiv.org/pdf/2601.16163" },
  @{ Key = "dreamzero"; Url = "https://arxiv.org/pdf/2602.15922" },
  @{ Key = "dit4dit"; Url = "https://arxiv.org/pdf/2603.10448" },
  @{ Key = "lingbot"; Url = "https://arxiv.org/pdf/2601.21998" }
)

foreach ($paper in $papers) {
  $pdfPath = Join-Path $paperDir ($paper.Key + ".pdf")
  $txtPath = Join-Path $txtDir ($paper.Key + ".txt")

  if (-not (Test-Path -LiteralPath $pdfPath)) {
    Write-Host "Downloading $($paper.Key) ..."
    Invoke-WebRequest -Uri $paper.Url -OutFile $pdfPath -Headers @{ "User-Agent" = "vam-atlas-method-extractor/0.1" }
  } else {
    Write-Host "PDF exists $($paper.Key)"
  }

  if (-not (Test-Path -LiteralPath $txtPath)) {
    Write-Host "Extracting text $($paper.Key) ..."
    & pdftotext -layout -enc UTF-8 $pdfPath $txtPath
  } else {
    Write-Host "Text exists $($paper.Key)"
  }
}
