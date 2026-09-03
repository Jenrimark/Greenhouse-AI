import { Outlet } from 'react-router-dom'
import { AppRail } from './AppRail'
import { TopBar } from './TopBar'

/**
 * 应用外壳：左侧导航 rail + 右侧列（顶栏 + 内容面）
 * 类名：.shell / .shell-east / .shell-east-body /
 * .shell-right / .shell-body / main.shell-surface
 */
export function AppLayout() {
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
