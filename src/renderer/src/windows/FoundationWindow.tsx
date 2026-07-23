// 런타임 버전과 저장 카운터를 확인하고 증가시키는 구간 0 화면입니다.
import { useEffect, useState } from 'react'
import type { FoundationStatus } from '../../../shared/types/foundation'

type SaveState = 'idle' | 'saving' | 'success' | 'error'

function FoundationWindow(): React.JSX.Element {
  const [foundation, setFoundation] = useState<FoundationStatus | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void window.desktopPetAPI
      .getFoundationStatus()
      .then(setFoundation)
      .catch(() => {
        setErrorMessage('저장소 상태를 불러오지 못했습니다.')
        setSaveState('error')
      })
  }, [])

  const incrementCounter = async (): Promise<void> => {
    setSaveState('saving')
    setErrorMessage('')

    try {
      const nextFoundation = await window.desktopPetAPI.incrementPhase0Counter()
      setFoundation(nextFoundation)
      setSaveState('success')
    } catch {
      setErrorMessage('카운터를 저장하지 못했습니다.')
      setSaveState('error')
    }
  }

  return (
    <main className="foundation-card">
      <h1>Desktop Pet Scheduler Foundation</h1>

      {foundation ? (
        <>
          <dl>
            <div>
              <dt>Electron</dt>
              <dd>{foundation.versions.electron}</dd>
            </div>
            <div>
              <dt>Chrome</dt>
              <dd>{foundation.versions.chrome}</dd>
            </div>
            <div>
              <dt>Node.js</dt>
              <dd>{foundation.versions.node}</dd>
            </div>
            <div>
              <dt>phase0Counter</dt>
              <dd>{foundation.stores.runtime.phase0Counter}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void incrementCounter()}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? '저장 중…' : '카운터 1 증가'}
          </button>
        </>
      ) : (
        <p>기반 상태를 불러오는 중입니다.</p>
      )}

      <p className={`status ${saveState}`} role="status">
        {saveState === 'success' && '저장했습니다.'}
        {saveState === 'error' && errorMessage}
      </p>
    </main>
  )
}

export default FoundationWindow
