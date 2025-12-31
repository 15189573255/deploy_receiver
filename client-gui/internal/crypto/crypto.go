package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// GenerateKeyPair 生成 Ed25519 密钥对
func GenerateKeyPair() (privateKeyHex, publicKeyHex string, err error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}

	privateKeyHex = hex.EncodeToString(privateKey)
	publicKeyHex = hex.EncodeToString(publicKey)
	return privateKeyHex, publicKeyHex, nil
}

// Sign 使用私钥签名消息
func Sign(privateKeyHex, message string) (string, error) {
	keyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return "", fmt.Errorf("无效的私钥格式: %v", err)
	}

	var privateKey ed25519.PrivateKey
	switch len(keyBytes) {
	case 64:
		// 完整私钥 (32字节私钥 + 32字节公钥)
		privateKey = ed25519.PrivateKey(keyBytes)
	case 32:
		// 种子格式
		privateKey = ed25519.NewKeyFromSeed(keyBytes)
	default:
		return "", errors.New("私钥长度错误，应为64或128个十六进制字符")
	}

	signature := ed25519.Sign(privateKey, []byte(message))
	return hex.EncodeToString(signature), nil
}

// Verify 验证签名
func Verify(publicKeyHex, message, signatureHex string) bool {
	publicKey, err := hex.DecodeString(publicKeyHex)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return false
	}

	signature, err := hex.DecodeString(signatureHex)
	if err != nil || len(signature) != ed25519.SignatureSize {
		return false
	}

	return ed25519.Verify(publicKey, []byte(message), signature)
}

// GenerateNonce 生成随机 Nonce
func GenerateNonce() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GetTimestamp 获取当前时间戳
func GetTimestamp() string {
	return fmt.Sprintf("%d", time.Now().Unix())
}

// CreateSignedHeaders 创建签名请求头
func CreateSignedHeaders(privateKeyHex, urlPath string) (timestamp, nonce, signature string, err error) {
	timestamp = GetTimestamp()
	nonce = GenerateNonce()
	message := timestamp + nonce + urlPath

	signature, err = Sign(privateKeyHex, message)
	if err != nil {
		return "", "", "", err
	}

	return timestamp, nonce, signature, nil
}

// GetPublicKeyFromPrivate 从私钥获取公钥
func GetPublicKeyFromPrivate(privateKeyHex string) (string, error) {
	keyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return "", fmt.Errorf("无效的私钥格式: %v", err)
	}

	var privateKey ed25519.PrivateKey
	switch len(keyBytes) {
	case 64:
		privateKey = ed25519.PrivateKey(keyBytes)
	case 32:
		privateKey = ed25519.NewKeyFromSeed(keyBytes)
	default:
		return "", errors.New("私钥长度错误")
	}

	publicKey := privateKey.Public().(ed25519.PublicKey)
	return hex.EncodeToString(publicKey), nil
}
