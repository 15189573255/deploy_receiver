#!/usr/bin/env python3
"""
Deploy Receiver 客户端上传脚本 (Python跨平台版)
使用 Ed25519 非对称签名 - 私钥只在本机

用法: python deploy.py <file> <path_key> [--extract] [--server URL] [--key PRIVATE_KEY]
示例: python deploy.py dist.zip web --extract
"""

import argparse
import os
import secrets
import sys
import time
import urllib.request
import urllib.error
import json

# ============================================
# 配置区域 - 请修改以下配置
# ============================================
DEFAULT_SERVER = os.environ.get('DEPLOY_SERVER', 'http://your-server:8022')
# 【私钥】- 只保存在本机! 128位十六进制字符串
DEFAULT_PRIVATE_KEY = os.environ.get('DEPLOY_PRIVATE_KEY', 'your-private-key-here')
# ============================================

# 尝试导入 ed25519 签名库
try:
    # Python 3.6+ 标准库
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    CRYPTO_LIB = 'cryptography'
except ImportError:
    try:
        # 备选: nacl 库
        import nacl.signing
        CRYPTO_LIB = 'nacl'
    except ImportError:
        CRYPTO_LIB = None


def sign_message(message: str, private_key_hex: str) -> str:
    """使用 Ed25519 私钥签名消息"""
    if CRYPTO_LIB == 'cryptography':
        key_bytes = bytes.fromhex(private_key_hex)
        # Ed25519 私钥是 64 字节 (32 私钥 + 32 公钥)
        private_key = Ed25519PrivateKey.from_private_bytes(key_bytes[:32])
        signature = private_key.sign(message.encode('utf-8'))
        return signature.hex()
    elif CRYPTO_LIB == 'nacl':
        key_bytes = bytes.fromhex(private_key_hex)
        signing_key = nacl.signing.SigningKey(key_bytes[:32])
        signed = signing_key.sign(message.encode('utf-8'))
        return signed.signature.hex()
    else:
        print("\033[91m错误: 需要安装加密库\033[0m")
        print("请运行: pip install cryptography")
        print("或者:   pip install pynacl")
        sys.exit(1)


def generate_nonce() -> str:
    """生成随机数"""
    return secrets.token_hex(16)


def format_size(size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def upload_file(file_path: str, path_key: str, server: str, private_key: str, extract: bool = False):
    """上传文件到服务器"""

    if not os.path.exists(file_path):
        print(f"\033[91m错误: 文件不存在 - {file_path}\033[0m")
        sys.exit(1)

    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    # 生成认证信息
    timestamp = str(int(time.time()))
    nonce = generate_nonce()
    url_path = f"/upload/{path_key}/{filename}"

    # 使用私钥签名
    message = f"{timestamp}{nonce}{url_path}"
    signature = sign_message(message, private_key)

    # 构建URL
    url = f"{server}{url_path}"
    if extract:
        url += "?extract=true"

    print("\033[96m============================================================\033[0m")
    print("\033[96m  Deploy Receiver 上传 (Ed25519 签名)\033[0m")
    print("\033[96m============================================================\033[0m")
    print(f"文件: {file_path}")
    print(f"目标: {path_key}")
    print(f"服务器: {server}")
    print(f"自动解压: {'是' if extract else '否'}")
    print(f"文件大小: {format_size(file_size)}")
    print("------------------------------------------------------------")

    # 读取文件
    with open(file_path, 'rb') as f:
        data = f.read()

    # 构建请求
    headers = {
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Nonce': nonce,
        'Content-Type': 'application/octet-stream',
    }

    print("\033[93m正在上传...\033[0m")

    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=300) as response:
            result = json.loads(response.read().decode('utf-8'))

            print("------------------------------------------------------------")
            print("\033[92m上传成功!\033[0m")
            print(f"保存路径: {result.get('path')}")
            print(f"文件大小: {result.get('size')} bytes")
            if result.get('extracted'):
                print(f"\033[92m已解压到: {result.get('extract_dir')}\033[0m")
            print("\033[96m============================================================\033[0m")

    except urllib.error.HTTPError as e:
        print("------------------------------------------------------------")
        print(f"\033[91m上传失败! HTTP {e.code}\033[0m")
        print(e.read().decode('utf-8'))
        sys.exit(1)
    except urllib.error.URLError as e:
        print("------------------------------------------------------------")
        print(f"\033[91m连接失败!\033[0m")
        print(str(e.reason))
        sys.exit(1)
    except Exception as e:
        print("------------------------------------------------------------")
        print(f"\033[91m错误: {str(e)}\033[0m")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Deploy Receiver 客户端 (Ed25519 非对称签名)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python deploy.py dist.zip web
  python deploy.py dist.zip web --extract
  python deploy.py app.jar api --server http://192.168.1.100:8022

环境变量:
  DEPLOY_SERVER      - 服务器地址
  DEPLOY_PRIVATE_KEY - Ed25519 私钥 (128位十六进制)

安全说明:
  私钥只保存在本机，服务器只有公钥，无法伪造请求
'''
    )

    parser.add_argument('file', help='要上传的文件路径')
    parser.add_argument('path_key', help='目标路径标识 (如 web, api)')
    parser.add_argument('--extract', '-e', action='store_true', help='上传后自动解压ZIP')
    parser.add_argument('--server', '-s', default=DEFAULT_SERVER, help='服务器地址')
    parser.add_argument('--key', '-k', default=DEFAULT_PRIVATE_KEY, help='Ed25519 私钥')

    args = parser.parse_args()

    if args.key == 'your-private-key-here':
        print("\033[91m错误: 请配置私钥!\033[0m")
        print("方式1: 设置环境变量 DEPLOY_PRIVATE_KEY")
        print("方式2: 使用 --key 参数")
        print("方式3: 修改脚本中的 DEFAULT_PRIVATE_KEY")
        sys.exit(1)

    upload_file(
        file_path=args.file,
        path_key=args.path_key,
        server=args.server,
        private_key=args.key,
        extract=args.extract
    )


if __name__ == '__main__':
    main()
