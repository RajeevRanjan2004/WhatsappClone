Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Bubble {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size,
    [bool]$Monochrome = $false,
    [bool]$FullTile = $false
  )

  [float]$sizeValue = $Size
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.Clear([System.Drawing.Color]::Transparent)

  if ($FullTile) {
    $tilePath = New-RoundedRectPath -X ($sizeValue * 0.1) -Y ($sizeValue * 0.1) -Width ($sizeValue * 0.8) -Height ($sizeValue * 0.8) -Radius ($sizeValue * 0.18)
    $tileBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#06140f"))
    $Graphics.FillPath($tileBrush, $tilePath)
    $tileBrush.Dispose()
    $tilePath.Dispose()
  }

  $bubblePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bubblePath.AddEllipse($sizeValue * 0.2, $sizeValue * 0.2, $sizeValue * 0.6, $sizeValue * 0.52)
  [System.Drawing.PointF[]]$tailPoints = @(
    (New-Object System.Drawing.PointF(($sizeValue * 0.34), ($sizeValue * 0.63))),
    (New-Object System.Drawing.PointF(($sizeValue * 0.28), ($sizeValue * 0.83))),
    (New-Object System.Drawing.PointF(($sizeValue * 0.47), ($sizeValue * 0.72)))
  )
  $bubblePath.AddPolygon($tailPoints)
  $bubblePath.CloseFigure()

  if ($Monochrome) {
    $bubbleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  } else {
    $gradientStart = [System.Drawing.ColorTranslator]::FromHtml("#19c37d")
    $gradientEnd = [System.Drawing.ColorTranslator]::FromHtml("#008069")
    $bubbleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.PointF(($sizeValue * 0.22), ($sizeValue * 0.2))),
      (New-Object System.Drawing.PointF(($sizeValue * 0.8), ($sizeValue * 0.8))),
      $gradientStart,
      $gradientEnd
    )
  }

  $Graphics.FillPath($bubbleBrush, $bubblePath)
  $bubbleBrush.Dispose()
  $bubblePath.Dispose()

  if ($Monochrome) {
    $dotColor = [System.Drawing.ColorTranslator]::FromHtml("#06140f")
  } else {
    $dotColor = [System.Drawing.ColorTranslator]::FromHtml("#f5efe6")
  }

  $dotBrush = New-Object System.Drawing.SolidBrush $dotColor
  $dotSize = $sizeValue * 0.085
  $dotY = $sizeValue * 0.43
  [float[]]$dotXs = @(($sizeValue * 0.38), ($sizeValue * 0.5), ($sizeValue * 0.62))
  foreach ($x in $dotXs) {
    $Graphics.FillEllipse($dotBrush, $x - ($dotSize / 2), $dotY - ($dotSize / 2), $dotSize, $dotSize)
  }
  $dotBrush.Dispose()
}

$assetsDir = Join-Path $PSScriptRoot "..\assets"
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

$renderTargets = @(
  @{ File = "icon.png"; Size = 1024; FullTile = $true; Monochrome = $false },
  @{ File = "adaptive-icon.png"; Size = 1024; FullTile = $false; Monochrome = $false },
  @{ File = "adaptive-monochrome.png"; Size = 1024; FullTile = $false; Monochrome = $true },
  @{ File = "splash-icon.png"; Size = 1024; FullTile = $false; Monochrome = $false }
)

foreach ($target in $renderTargets) {
  $bitmap = New-Object System.Drawing.Bitmap($target.Size, $target.Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-Bubble -Graphics $graphics -Size $target.Size -Monochrome $target.Monochrome -FullTile $target.FullTile
  $graphics.Dispose()
  $bitmap.Save((Join-Path $assetsDir $target.File), [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Write-Output "Generated mobile assets in $assetsDir"
