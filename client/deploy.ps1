# Deploy Receiver 客户端上传脚本 (PowerShell)
# 使用 Ed25519 非对称签名 - 私钥只在本机
#
# 用法: .\deploy.ps1 -File "dist.zip" -PathKey "web" [-Extract]
# 依赖: 需要安装 libsodium (可选,用于Ed25519签名)

param(
    [Parameter(Mandatory=$true)]
    [string]$File,

    [Parameter(Mandatory=$true)]
    [string]$PathKey,

    [string]$Server = "http://your-server:8022",
    [string]$PrivateKey = "your-private-key-here",
    [switch]$Extract
)

# ============================================
# 配置区域 - 请修改以下配置
# ============================================
# $Server = "http://192.168.1.100:8022"
# $PrivateKey = "从 -genkey 生成的128位十六进制私钥"
# ============================================

# Ed25519 签名实现 (纯PowerShell实现有限，推荐用Python脚本)
# 这里提供一个调用Python的桥接方案

function Sign-Ed25519 {
    param([string]$Message, [string]$PrivateKeyHex)

    # 方案1: 调用Python进行签名
    $pythonScript = @"
import sys
try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    key_bytes = bytes.fromhex('$PrivateKeyHex')
    private_key = Ed25519PrivateKey.from_private_bytes(key_bytes[:32])
    signature = private_key.sign('$Message'.encode('utf-8'))
    print(signature.hex())
except Exception as e:
    print(f'ERROR:{e}', file=sys.stderr)
    sys.exit(1)
"@

    $result = python -c $pythonScript 2>&1
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

# 检查文件是否存在
if (-not (Test-Path $File)) {
    Write-Host "错误: 文件不存在 - $File" -ForegroundColor Red
    exit 1
}

# 检查私钥配置
if ($PrivateKey -eq "your-private-key-here") {
    Write-Host "错误: 请配置私钥!" -ForegroundColor Red
    Write-Host "运行 deploy_receiver.exe -genkey 生成密钥对"
    Write-Host "然后将私钥配置到此脚本的 `$PrivateKey 参数"
    exit 1
}

$FileName = Split-Path $File -Leaf
$Timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$Nonce = Generate-Nonce
$UrlPath = "/upload/$PathKey/$FileName"

# 计算Ed25519签名
$Message = "$Timestamp$Nonce$UrlPath"
try {
    $Signature = Sign-Ed25519 -Message $Message -PrivateKeyHex $PrivateKey
} catch {
    Write-Host "签名失败: $_" -ForegroundColor Red
    Write-Host "请确保已安装 Python 和 cryptography 库:"
    Write-Host "  pip install cryptography"
    exit 1
}

# 构建URL
$Url = "$Server$UrlPath"
if ($Extract) {
    $Url += "?extract=true"
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Deploy Receiver 上传 (Ed25519 签名)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "文件: $File"
Write-Host "目标: $PathKey"
Write-Host "服务器: $Server"
Write-Host "自动解压: $Extract"
Write-Host "------------------------------------------------------------"

try {
    $FileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $File))
    $FileSize = $FileBytes.Length
    Write-Host "文件大小: $([math]::Round($FileSize/1024/1024, 2)) MB"

    $Headers = @{
        "X-Timestamp" = $Timestamp.ToString()
        "X-Signature" = $Signature
        "X-Nonce" = $Nonce
        "Content-Type" = "application/octet-stream"
    }

    Write-Host "正在上传..." -ForegroundColor Yellow

    $Response = Invoke-RestMethod -Uri $Url -Method Post -Body $FileBytes -Headers $Headers -TimeoutSec 300

    Write-Host "------------------------------------------------------------"
    Write-Host "上传成功!" -ForegroundColor Green
    Write-Host "保存路径: $($Response.path)"
    Write-Host "文件大小: $($Response.size) bytes"
    if ($Response.extracted) {
        Write-Host "已解压到: $($Response.extract_dir)" -ForegroundColor Green
    }
    Write-Host "============================================================" -ForegroundColor Cyan
}
catch {
    Write-Host "------------------------------------------------------------"
    Write-Host "上传失败!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
