import { useState } from 'react'
import { PET_FRAME_IMAGES } from '../petAssets'

function OnboardingWindow(): React.JSX.Element {
  const [step, setStep] = useState(1)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const saveKey = async (): Promise<void> => {
    setSaving(true)
    setStatus('')
    try {
      await window.desktopPetAPI.saveGeminiKey(key)
      setKey('')
      setStep(3)
    } catch {
      setStatus('키 형식을 다시 확인해줘.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="onboarding-shell">
      <section className={`onboarding-card${step === 2 ? ' is-step-2' : ''}`}>
        <div className="onboarding-step" aria-label={`${step}/3 단계`}>
          {step}/3
        </div>
        <img
          className="onboarding-pet"
          src={PET_FRAME_IMAGES[step === 3 ? 'happy' : 'idle']}
          alt="인사하는 햄스터"
        />

        {step === 1 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">DESKTOP PET SCHEDULER</p>
            <h1>안녕! 난 네 일정 햄스터야</h1>
            <p>말로 일정을 관리하는 데스크탑 햄스터 친구야.</p>
            <button type="button" onClick={() => setStep(2)}>
              시작하기
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">GEMINI API KEY</p>
            <h1>대화하려면 키가 필요해</h1>
            <p>
              이 앱은 Google Gemini로 네 말을 이해해. 키는 네 컴퓨터에만
              저장되고 Gemini 호출 외에는 전송되지 않아.
            </p>
            <h2 className="key-guide-title">키 받는 법</h2>
            <ol className="key-guide">
              <li>아래 "AI Studio 열기" 버튼 클릭</li>
              <li>(로그인 안 돼 있으면) Google 계정으로 로그인</li>
              <li>"Create API key" 클릭</li>
              <li>생성된 키를 복사해서 아래에 붙여넣기</li>
            </ol>
            <p className="key-free-notice">
              💡 무료로 시작할 수 있어. 카드 등록 없이 Google 계정만 있으면 돼!
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => void window.desktopPetAPI.openGeminiKeyPage()}
            >
              AI Studio 열기
            </button>
            <label className="api-key-field">
              Gemini API 키
              <input
                type="password"
                value={key}
                autoComplete="off"
                spellCheck={false}
                placeholder="API 키를 붙여넣어줘"
                onChange={(event) => {
                  setKey(event.target.value)
                  setStatus('')
                }}
              />
            </label>
            {status && <p className="onboarding-error" role="alert">{status}</p>}
            <div className="onboarding-actions">
              <button type="button" className="secondary" onClick={() => setStep(3)}>
                나중에
              </button>
              <button
                type="button"
                disabled={saving || key.trim().length === 0}
                onClick={() => void saveKey()}
              >
                {saving ? '저장 중…' : '저장하고 시작'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">READY!</p>
            <h1>준비 끝!</h1>
            <p>이제 햄스터한테 일정을 말해봐.</p>
            <button
              type="button"
              onClick={() => void window.desktopPetAPI.completeOnboarding()}
            >
              햄스터 만나기
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default OnboardingWindow
