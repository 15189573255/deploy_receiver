package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintf(os.Stderr, "Usage: sign <private_key_hex> <message>\n")
		os.Exit(1)
	}

	privateKeyHex := os.Args[1]
	message := os.Args[2]

	// 解析私钥
	keyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: invalid private key hex: %v\n", err)
		os.Exit(1)
	}

	// Ed25519 私钥是 64 字节（包含公钥），或者 32 字节（种子）
	var privateKey ed25519.PrivateKey
	if len(keyBytes) == 64 {
		privateKey = ed25519.PrivateKey(keyBytes)
	} else if len(keyBytes) == 32 {
		privateKey = ed25519.NewKeyFromSeed(keyBytes)
	} else {
		fmt.Fprintf(os.Stderr, "ERROR: private key must be 32 or 64 bytes, got %d\n", len(keyBytes))
		os.Exit(1)
	}

	// 签名
	signature := ed25519.Sign(privateKey, []byte(message))
	fmt.Print(hex.EncodeToString(signature))
}
