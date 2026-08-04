// query string에 따라 foundation 또는 펫 전용 React 화면을 선택하는 파일입니다.
import FoundationWindow from './windows/FoundationWindow'
import PetWindow from './windows/PetWindow'
import ScheduleDiaryWindow from './windows/ScheduleDiaryWindow'
import SettingsWindow from './windows/SettingsWindow'

function App(): React.JSX.Element {
  const windowName = new URLSearchParams(window.location.search).get('window')

  if (windowName === 'pet') {
    return <PetWindow />
  }
  if (windowName === 'schedule-diary') {
    return <ScheduleDiaryWindow />
  }
  if (windowName === 'settings') {
    return <SettingsWindow />
  }
  return <FoundationWindow />
}

export default App
