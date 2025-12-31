import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Check, X, RefreshCw, Edit2 } from 'lucide-react';
import { GetServers, SaveServer, DeleteServer, SetDefaultServer, TestConnection } from '../../wailsjs/go/main/App';

interface Server {
  id: string;
  name: string;
  url: string;
  paths: string[];
  isDefault: boolean;
  createdAt: string;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', paths: '' });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const list = await GetServers();
      setServers(list || []);
    } catch (err) {
      console.error('加载服务器失败:', err);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.url) {
      alert('请填写服务器名称和地址');
      return;
    }

    try {
      const paths = form.paths.split(',').map(p => p.trim()).filter(Boolean);
      await SaveServer({
        id: editingId || '',
        name: form.name,
        url: form.url.replace(/\/$/, ''),
        paths,
        isDefault: false,
        createdAt: '',
      });
      setIsAdding(false);
      setEditingId(null);
      setForm({ name: '', url: '', paths: '' });
      loadServers();
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败: ' + err);
    }
  };

  const handleEdit = (server: Server) => {
    setEditingId(server.id);
    setForm({
      name: server.name,
      url: server.url,
      paths: server.paths?.join(', ') || '',
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;
    try {
      await DeleteServer(id);
      loadServers();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await SetDefaultServer(id);
      loadServers();
    } catch (err) {
      console.error('设置默认失败:', err);
    }
  };

  const handleTest = async (server: Server) => {
    setTesting(server.id);
    setTestResult(null);
    try {
      await TestConnection(server.url);
      setTestResult({ id: server.id, success: true, message: '连接成功' });
    } catch (err: any) {
      setTestResult({ id: server.id, success: false, message: err.message || '连接失败' });
    } finally {
      setTesting(null);
    }
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ name: '', url: '', paths: '' });
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">服务器管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">管理部署目标服务器配置</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus size={16} />
            添加服务器
          </button>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {isAdding && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">
            {editingId ? '编辑服务器' : '添加服务器'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">名称</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="例如：生产服务器"
                className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">地址</label>
              <input
                type="text"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="例如：http://192.168.1.100:8022"
                className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">路径标识</label>
              <input
                type="text"
                value={form.paths}
                onChange={e => setForm({ ...form, paths: e.target.value })}
                placeholder="例如：web, api, static (逗号分隔)"
                className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">与服务器 config.json 中的 paths 配置对应</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                <Check size={16} />
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 服务器列表 */}
      <div className="space-y-3">
        {servers.map(server => (
          <div
            key={server.id}
            className={`bg-white dark:bg-zinc-900 rounded-xl border p-5 transition-colors ${
              server.isDefault
                ? 'border-amber-300 dark:border-amber-700'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-white">{server.name}</h3>
                  {server.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      <Star size={10} />
                      默认
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{server.url}</p>
                {server.paths?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {server.paths.map(p => (
                      <span key={p} className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {testResult?.id === server.id && (
                  <p className={`text-sm mt-3 ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleTest(server)}
                  disabled={testing === server.id}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                  title="测试连接"
                >
                  <RefreshCw size={16} className={testing === server.id ? 'animate-spin' : ''} />
                </button>
                {!server.isDefault && (
                  <button
                    onClick={() => handleSetDefault(server.id)}
                    className="p-2 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                    title="设为默认"
                  >
                    <Star size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(server)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {servers.length === 0 && !isAdding && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无服务器配置</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">点击上方按钮添加第一个服务器</p>
          </div>
        )}
      </div>
    </div>
  );
}
