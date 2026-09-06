import { Navigate, Outlet } from 'react-router-dom'
import { AppRail } from './AppRail'
import { TopBar } from './TopBar'
import { useAppData } from './AppData'

/**
 * 应用外壳：左侧导航 rail + 右侧列（顶栏 + 内容面）
 * 认证守卫：未登录重定向到 /login
 */
export function AppLayout() {
  const { me, loading } = useAppData()

  if (loading) {
    return (
      <div className="shell boot-splash">
        <img src="/icon.svg" width={40} height={40} alt="" />
        <span>加载中…</span>
      </div>
    )
  }

  if (!me) return <Navigate to="/login" replace />

  return (
    <div className="shell">
      <AppRail />
      <div className="shell-east">
        <TopBar />
        <div className="shell-east-body">
          <div className="shell-right">
            <div className="shell-body">
              <main className="shell-surface">
                <Outlet />
                <div className="composer-spacer" />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
