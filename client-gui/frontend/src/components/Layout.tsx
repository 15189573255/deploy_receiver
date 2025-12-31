import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Upload, Server, Key, History, Eye, Clock, ChevronRight } from 'lucide-react';

const navItems = [
  { path: '/', icon: Upload, label: '文件上传' },
  { path: '/servers', icon: Server, label: '服务器' },
  { path: '/keys', icon: Key, label: '密钥管理' },
  { path: '/history', icon: History, label: '历史记录' },
  { path: '/watch', icon: Eye, label: '文件夹监控' },
  { path: '/schedule', icon: Clock, label: '定时任务' },
];

export default function Layout() {
  const location = useLocation();
  const currentPage = navItems.find(item => item.path === location.pathname);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-900">
      {/* 侧边栏 */}
      <nav className="w-64 flex flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
        {/* Logo 区域 */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Upload className="w-4 h-4 text-white dark:text-zinc-900" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">Deploy Receiver</span>
          </div>
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            Deploy Receiver Client v1.0
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部标题栏 */}
        <header className="h-16 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-white font-medium">
              {currentPage?.label || '首页'}
            </span>
          </div>
        </header>

        {/* 内容区域 */}
        <main className="flex-1 overflow-auto p-8 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
