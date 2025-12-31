import { useState, useEffect } from 'react';
import { Key, RefreshCw, Copy, Check, Eye, EyeOff, Save, Shield, AlertTriangle } from 'lucide-react';
import { GenerateKeyPair, SaveKeyPair, GetKeyPair, GetPublicKeyFromPrivate } from '../../wailsjs/go/main/App';

interface KeyPairData {
  privateKey: string;
  publicKey: string;
  updatedAt: string;
}

export default function KeysPage() {
  const [keyPair, setKeyPair] = useState<KeyPairData | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState<'public' | 'private' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [importKey, setImportKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadKeyPair();
  }, []);

  const loadKeyPair = async () => {
    try {
      const kp = await GetKeyPair();
      setKeyPair(kp);
    } catch (err) {
      console.error('加载密钥失败:', err);
    }
  };

  const handleGenerate = async () => {
    if (keyPair && !confirm('生成新密钥将覆盖现有密钥，确定继续吗？')) {
      return;
    }

    setIsGenerating(true);
    try {
      const newKeyPair = await GenerateKeyPair();
      await SaveKeyPair(newKeyPair.privateKey);
      await loadKeyPair();
    } catch (err) {
      console.error('生成密钥失败:', err);
      alert('生成密钥失败: ' + err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async () => {
    if (!importKey.trim()) {
      alert('请输入私钥');
      return;
    }

    if (keyPair && !confirm('导入新密钥将覆盖现有密钥，确定继续吗？')) {
      return;
    }

    setIsImporting(true);
    try {
      await GetPublicKeyFromPrivate(importKey.trim());
      await SaveKeyPair(importKey.trim());
      setImportKey('');
      await loadKeyPair();
      alert('导入成功');
    } catch (err) {
      alert('无效的私钥格式: ' + err);
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'public' | 'private') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 16) return key;
    return key.slice(0, 8) + '...' + key.slice(-8);
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">密钥管理</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">管理 Ed25519 签名密钥对</p>
      </div>

      {/* 当前密钥 */}
      {keyPair ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-zinc-900 dark:text-white">当前密钥对</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  更新于 {new Date(keyPair.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* 公钥 */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                公钥 <span className="font-normal text-zinc-500">(复制到服务器 config.json)</span>
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-mono text-emerald-600 dark:text-emerald-400 break-all">
                  {keyPair.publicKey}
                </code>
                <button
                  onClick={() => copyToClipboard(keyPair.publicKey, 'public')}
                  className="flex-shrink-0 p-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="复制公钥"
                >
                  {copied === 'public' ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* 私钥 */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                私钥 <span className="font-normal text-zinc-500">(请妥善保管)</span>
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-mono text-red-600 dark:text-red-400 break-all">
                  {showPrivateKey ? keyPair.privateKey : maskKey(keyPair.privateKey)}
                </code>
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="flex-shrink-0 p-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title={showPrivateKey ? '隐藏' : '显示'}
                >
                  {showPrivateKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={() => copyToClipboard(keyPair.privateKey, 'private')}
                  className="flex-shrink-0 p-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="复制私钥"
                >
                  {copied === 'private' ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Key size={32} className="text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">尚未配置密钥对</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">生成或导入密钥对以启用安全上传</p>
        </div>
      )}

      {/* 操作区 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 生成新密钥 */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">生成新密钥对</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            生成新的 Ed25519 密钥对，公钥需复制到服务器配置中。
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? '生成中...' : '生成密钥对'}
          </button>
        </div>

        {/* 导入私钥 */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">导入已有私钥</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            如果您已有私钥，可以直接导入使用。
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={importKey}
              onChange={e => setImportKey(e.target.value)}
              placeholder="输入私钥 (128位十六进制)"
              className="flex-1 h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
            />
            <button
              onClick={handleImport}
              disabled={isImporting || !importKey.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              导入
            </button>
          </div>
        </div>
      </div>

      {/* 安全提示 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">安全提示</h3>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <li>私钥仅保存在本机，请妥善保管</li>
              <li>公钥可以安全地复制到服务器</li>
              <li>如果私钥泄露，请立即生成新密钥对并更新服务器配置</li>
              <li>建议定期更换密钥对</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
