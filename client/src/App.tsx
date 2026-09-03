import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './shell/AppLayout'
import { AssistantScreen } from './screens/AssistantScreen'
import { PipelineScreen } from './screens/PipelineScreen'
import { DiscoverScreen } from './screens/DiscoverScreen'
import { AtlasScreen } from './screens/AtlasScreen'
import { StudioScreen } from './screens/StudioScreen'
import { StoriesScreen } from './screens/StoriesScreen'
import { MockScreen } from './screens/MockScreen'
import { LiveScreen } from './screens/LiveScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { LoginScreen } from './screens/LoginScreen'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<AssistantScreen />} />
        <Route path="pipeline" element={<PipelineScreen />} />
        <Route path="discover" element={<DiscoverScreen />} />
        <Route path="atlas" element={<AtlasScreen />} />
        <Route path="studio" element={<StudioScreen />} />
        <Route path="stories" element={<StoriesScreen />} />
        <Route path="mock" element={<MockScreen />} />
        <Route path="live" element={<LiveScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
