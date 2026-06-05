import { Workbench } from './layout/Workbench'
import { TitleBar } from './layout/TitleBar'

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <TitleBar />
      <Workbench />
    </div>
  )
}
