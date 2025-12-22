# 上传整个文件夹到 Deploy Receiver
# 用法: .\upload_folder.ps1 -Folder "D:\dist" -PathKey "web" [-Server "http://server:8022"] [-PrivateKey "私钥"]

param(
    [Parameter(Mandatory=$true)]
    [string]$Folder,

    [Parameter(Mandatory=$true)]
    [string]$PathKey,

    [string]$Server = "http://localhost:8022",
    [string]$PrivateKey = ""
)

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SignTool = Join-Path $ScriptDir "sign\sign.exe"

# Ed25519 签名函数 (使用 Go 工具)
function Sign-Ed25519 {
    param([string]$Message, [string]$PrivateKeyHex)

    $result = & $SignTool $PrivateKeyHex $Message 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "签名失败: $result"
    }
    return $result.Trim()
}

function Generate-Nonce {
    $bytes = [byte[]]::new(16)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

# 检查文件夹是否存在
if (-not (Test-Path $Folder -PathType Container)) {
    Write-Host "错误: 文件夹不存在 - $Folder" -ForegroundColor Red
    exit 1
}

# 检查是否需要签名
$UseSign = $PrivateKey -ne ""
if ($UseSign) {
    # 验证签名工具是否存在
    if (-not (Test-Path $SignTool)) {
        Write-Host "错误: 签名工具不存在 - $SignTool" -ForegroundColor Red
        Write-Host "请先编译签名工具: cd client/sign && go build -o sign.exe ." -ForegroundColor Yellow
        exit 1
    }
}

$Folder = (Resolve-Path $Folder).Path
$Files = Get-ChildItem -Path $Folder -Recurse -File

if ($Files.Count -eq 0) {
    Write-Host "警告: 文件夹为空" -ForegroundColor Yellow
    exit 0
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  上传文件夹: $Folder" -ForegroundColor Cyan
Write-Host "  目标路径: $PathKey" -ForegroundColor Cyan
Write-Host "  服务器: $Server" -ForegroundColor Cyan
Write-Host "  文件数量: $($Files.Count)" -ForegroundColor Cyan
Write-Host "  安全签名: $(if ($UseSign) { '已启用' } else { '未启用' })" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$Success = 0
$Failed = 0

foreach ($File in $Files) {
    # 计算相对路径
    $RelativePath = $File.FullName.Substring($Folder.Length).TrimStart('\', '/')
    $RelativePath = $RelativePath -replace '\\', '/'

    $UrlPath = "/upload/$PathKey/$RelativePath"
    $Url = "$Server$UrlPath"

    Write-Host "上传: $RelativePath ... " -NoNewline

    try {
        $FileBytes = [System.IO.File]::ReadAllBytes($File.FullName)

        $Headers = @{
            "Content-Type" = "application/octet-stream"
        }

        # 如果启用签名，添加认证头
        if ($UseSign) {
            $Timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
            $Nonce = Generate-Nonce
            $Message = "$Timestamp$Nonce$UrlPath"
            $Signature = Sign-Ed25519 -Message $Message -PrivateKeyHex $PrivateKey

            $Headers["X-Timestamp"] = $Timestamp.ToString()
            $Headers["X-Nonce"] = $Nonce
            $Headers["X-Signature"] = $Signature
        }

        $Response = Invoke-RestMethod -Uri $Url -Method Post -Body $FileBytes -Headers $Headers -TimeoutSec 120
        Write-Host "OK" -ForegroundColor Green
        $Success++
    }
    catch {
        Write-Host "失败: $($_.Exception.Message)" -ForegroundColor Red
        $Failed++
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  完成! 成功: $Success, 失败: $Failed" -ForegroundColor $(if ($Failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "============================================================" -ForegroundColor Cyan
