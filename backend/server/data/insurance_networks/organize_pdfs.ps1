# Create directories and move PDFs
$basePath = "E:\v2final\backend\data\insurance_networks\raw_pdfs"

# Create all directories first
$folders = @(
    "bajaj_allianz", "galaxy_health", "new_india", "reliance", "tata_aig",
    "hdfc_ergo", "icici_lombard", "star_health", "niva_bupa", "care_health",
    "kotak_general", "aditya_birla", "magma_hdi", "universal_sompo", "zuno", "manipal_cigna"
)

Write-Host "Creating directories..." -ForegroundColor Cyan
foreach ($folder in $folders) {
    $folderPath = Join-Path $basePath $folder
    if (!(Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath | Out-Null
        Write-Host "  Created: $folder" -ForegroundColor Green
    }
}

# PDF to folder mapping
$mapping = @{
    "Network_Lists_Bajaj_Allianz.pdf"            = "bajaj_allianz"
    "Galaxy_Health_Insurance.pdf"                = "galaxy_health"
    "New_India_Assurance.pdf"                    = "new_india"
    "Reliance.pdf"                               = "reliance"
    "Network_Lists_Tata_AIG.pdf"                 = "tata_aig"
    "HDFC_ERGO.pdf"                              = "hdfc_ergo"
    "ICICI_Lombard.pdf"                          = "icici_lombard"
    "Star_Health_Super_Star_Value.pdf"           = "star_health"
    "Niva_Bupa_(formerly_known_as_Max_Bupa).pdf" = "niva_bupa"
    "Care_Health.pdf"                            = "care_health"
    "Kotak_General_Insurance.pdf"                = "kotak_general"
    "Network_Lists_Aditya_Birla.pdf"             = "aditya_birla"
    "MAGMA_HDI.pdf"                              = "magma_hdi"
    "Universal_Sompo.pdf"                        = "universal_sompo"
    "Zuno.pdf"                                   = "zuno"
    "ManipalCigna.pdf"                           = "manipal_cigna"
}

Write-Host "`nMoving PDFs..." -ForegroundColor Cyan
foreach ($pdf in $mapping.Keys) {
    $source = Join-Path $basePath $pdf
    $destFolder = Join-Path $basePath $mapping[$pdf]
    $dest = Join-Path $destFolder $pdf
    
    if (Test-Path $source) {
        Move-Item -Path $source -Destination $dest -Force
        Write-Host "  Moved: $pdf -> $($mapping[$pdf])" -ForegroundColor Green
    }
    else {
        Write-Host "  Missing: $pdf" -ForegroundColor Red
    }
}

Write-Host "`nVerification:" -ForegroundColor Cyan
foreach ($folder in $folders) {
    $folderPath = Join-Path $basePath $folder
    $count = (Get-ChildItem -Path $folderPath -Filter *.pdf).Count
    Write-Host "  $folder`: $count PDF(s)" -ForegroundColor Gray
}
