// query string에 따라 foundation 또는 펫 전용 React 화면을 선택하는 파일입니다.
import FoundationWindow from './windows/FoundationWindow'
import PetWindow from './windows/PetWindow'

function App(): React.JSX.Element {
  const isPetWindow =
    new URLSearchParams(window.location.search).get('window') === 'pet'

  return isPetWindow ? <PetWindow /> : <FoundationWindow />
}

export default App
