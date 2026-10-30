// 런타임 버전과 저장 카운터를 확인하고 증가시키는 구간 0 화면입니다.
import { useEffect, useState } from 'react'
import type { FoundationStatus } from '../../../shared/types/foundation'
import type { PetEmotion, PetMessagePayload } from '../../../shared/types/pet'

type SaveState = 'idle' | 'saving' | 'success' | 'error'
const TEST_EMOTIONS: PetEmotion[] = [
  'idle',
  'question',
  'sad',
  'sleep',
  'thumbsUp',
  'happy'
]
const DEFAULT_MESSAGE =
  '스트레칭할 시간이야! 어깨가 돌이 되기 전에 잠깐 움직이자.'

const QUICK_MESSAGES: Array<{
  label: string
  payload: PetMessagePayload
}> = [
  {
    label: '기본 알림',
    payload: {
      text: '10분 뒤에 데이터베이스 과제가 있어!',
      finalEmotion: 'idle'
    }
  },
  {
    label: '질문 알림',
    payload: {
      text: '시간이 조금 애매한데, 오후 3시로 등록할까?',
      finalEmotion: 'question'
    }
  },
  {
    label: '일정 완료 알림',
    payload: {
      text: '일정 완료. 오늘도 시간의 지배자.',
      finalEmotion: 'thumbsUp'
    }
  }
]

function FoundationWindow(): React.JSX.Element {
  const [foundation, setFoundation] = useState<FoundationStatus | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [messageText, setMessageText] = useState(DEFAULT_MESSAGE)
  const [finalEmotion, setFinalEmotion] = useState<PetEmotion>('idle')
  const [testStatus, setTestStatus] = useState('')

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

  const runPetAction = async (
    action: () => Promise<void>,
    successMessage: string
  ): Promise<void> => {
    setTestStatus('')
    try {
      await action()
      setTestStatus(successMessage)
    } catch {
      setTestStatus('펫 테스트 요청을 처리하지 못했습니다.')
    }
  }

  const showMessage = (payload: PetMessagePayload): Promise<void> =>
    runPetAction(
      () => window.desktopPetAPI.showPetMessage(payload),
      '말풍선 메시지를 보냈습니다.'
    )

  return (
    <main className="foundation-card">
      <h1>Hami Developer Tools</h1>

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

      <section className="pet-test-panel" aria-labelledby="pet-test-heading">
        <h2 id="pet-test-heading">구간 2 펫 표현 테스트</h2>

        <fieldset>
          <legend>감정 상태</legend>
          <div className="test-button-grid">
            {TEST_EMOTIONS.map((testEmotion) => (
              <button
                key={testEmotion}
                type="button"
                onClick={() =>
                  void runPetAction(
                    () => window.desktopPetAPI.setPetEmotion(testEmotion),
                    `${testEmotion} 상태를 보냈습니다.`
                  )
                }
              >
                {testEmotion}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>말풍선 메시지</legend>
          <label htmlFor="pet-message-text">테스트 문장</label>
          <textarea
            id="pet-message-text"
            value={messageText}
            maxLength={200}
            rows={3}
            onChange={(event) => setMessageText(event.target.value)}
          />

          <label htmlFor="pet-final-emotion">타이핑 후 감정</label>
          <select
            id="pet-final-emotion"
            value={finalEmotion}
            onChange={(event) =>
              setFinalEmotion(event.target.value as PetEmotion)
            }
          >
            {TEST_EMOTIONS.map((testEmotion) => (
              <option key={testEmotion} value={testEmotion}>
                {testEmotion}
              </option>
            ))}
          </select>

          <div className="test-button-row">
            <button
              type="button"
              onClick={() =>
                void showMessage({ text: messageText, finalEmotion })
              }
            >
              말풍선 표시
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                void runPetAction(
                  () => window.desktopPetAPI.hidePetMessage(),
                  '말풍선을 숨겼습니다.'
                )
              }
            >
              말풍선 숨기기
            </button>
          </div>

          <div className="quick-message-buttons">
            {QUICK_MESSAGES.map(({ label, payload }) => (
              <button
                key={label}
                type="button"
                className="secondary"
                onClick={() => void showMessage(payload)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="test-status" role="status">
          {testStatus}
        </p>
      </section>
    </main>
  )
}

export default FoundationWindow
