// query string에 따라 foundation 또는 펫 전용 React 화면을 선택하는 파일입니다.
import FoundationWindow from './windows/FoundationWindow'
import PetWindow from './windows/PetWindow'
import ScheduleDiaryWindow from './windows/ScheduleDiaryWindow'
import SettingsWindow from './windows/SettingsWindow'
import OnboardingWindow from './windows/OnboardingWindow'
import HelpWindow from './windows/HelpWindow'
import PomodoroWindow from './windows/PomodoroWindow'
import NotebookWindow from './windows/NotebookWindow'

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
  if (windowName === 'onboarding') {
    return <OnboardingWindow />
  }
  if (windowName === 'help') {
    return <HelpWindow />
  }
  if (windowName === 'pomodoro') {
    return <PomodoroWindow />
  }
  if (windowName === 'notebook') {
    return <NotebookWindow />
  }
  return <FoundationWindow />
}

export default App
