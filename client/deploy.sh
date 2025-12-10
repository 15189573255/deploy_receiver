#!/bin/bash
# Deploy Receiver 客户端上传脚本 (Bash/Linux/Jenkins)
# 使用 Ed25519 非对称签名 - 私钥只在本机
#
# 用法: ./deploy.sh <file> <path_key> [--extract]
# 示例: ./deploy.sh dist.zip web --extract
# 依赖: python3, cryptography (pip install cryptography)

# ============================================
# 配置区域 - 请修改以下配置或使用环境变量
# ============================================
SERVER="${DEPLOY_SERVER:-http://your-server:8022}"
PRIVATE_KEY="${DEPLOY_PRIVATE_KEY:-your-private-key-here}"
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 参数检查
if [ $# -lt 2 ]; then
    echo -e "${RED}用法: $0 <file> <path_key> [--extract]${NC}"
    echo "示例: $0 dist.zip web --extract"
    echo ""
    echo "环境变量:"
    echo "  DEPLOY_SERVER      - 服务器地址"
    echo "  DEPLOY_PRIVATE_KEY - Ed25519 私钥"
    exit 1
fi

FILE="$1"
PATH_KEY="$2"
EXTRACT=""

if [ "$3" == "--extract" ] || [ "$3" == "-e" ]; then
    EXTRACT="?extract=true"
fi

# 检查文件
if [ ! -f "$FILE" ]; then
    echo -e "${RED}错误: 文件不存在 - $FILE${NC}"
    exit 1
fi

# 检查私钥
if [ "$PRIVATE_KEY" == "your-private-key-here" ]; then
    echo -e "${RED}错误: 请配置私钥!${NC}"
    echo "运行 deploy_receiver.exe -genkey 生成密钥对"
    echo "然后设置环境变量: export DEPLOY_PRIVATE_KEY=你的私钥"
    exit 1
fi

FILENAME=$(basename "$FILE")
TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)
URL_PATH="/upload/${PATH_KEY}/${FILENAME}"

# 使用Python计算Ed25519签名
MESSAGE="${TIMESTAMP}${NONCE}${URL_PATH}"
SIGNATURE=$(python3 -c "
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
key_bytes = bytes.fromhex('${PRIVATE_KEY}')
private_key = Ed25519PrivateKey.from_private_bytes(key_bytes[:32])
signature = private_key.sign('${MESSAGE}'.encode('utf-8'))
print(signature.hex())
" 2>/dev/null)

if [ -z "$SIGNATURE" ]; then
    echo -e "${RED}签名失败! 请确保已安装 cryptography:${NC}"
    echo "pip install cryptography"
    exit 1
fi

URL="${SERVER}${URL_PATH}${EXTRACT}"

# 文件大小
FILE_SIZE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE" 2>/dev/null)
FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024" | bc)

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Deploy Receiver 上传 (Ed25519 签名)${NC}"
echo -e "${CYAN}============================================================${NC}"
echo "文件: $FILE"
echo "目标: $PATH_KEY"
echo "服务器: $SERVER"
echo "自动解压: $([ -n "$EXTRACT" ] && echo '是' || echo '否')"
echo "文件大小: ${FILE_SIZE_MB} MB"
echo "------------------------------------------------------------"

echo -e "${YELLOW}正在上传...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "X-Timestamp: $TIMESTAMP" \
    -H "X-Signature: $SIGNATURE" \
    -H "X-Nonce: $NONCE" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$FILE" \
    "$URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "------------------------------------------------------------"

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}上传成功!${NC}"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo -e "${CYAN}============================================================${NC}"
    exit 0
else
    echo -e "${RED}上传失败! HTTP $HTTP_CODE${NC}"
    echo "$BODY"
    exit 1
fi
