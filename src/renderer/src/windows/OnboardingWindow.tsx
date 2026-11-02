import { useState } from 'react'
import { PET_FRAME_IMAGES } from '../petAssets'

function OnboardingWindow(): React.JSX.Element {
  const [step, setStep] = useState(1)

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <div className="onboarding-step" aria-label={`${step}/3 단계`}>{step}/3</div>
        <img className="onboarding-pet" src={PET_FRAME_IMAGES[step === 3 ? 'happy' : 'idle']} alt="인사하는 햄이" />

        {step === 1 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">HAMI</p>
            <h1>안녕! 난 햄이야</h1>
            <p>일정부터 하루 기록까지 함께하는 데스크톱 친구야.</p>
            <button type="button" onClick={() => setStep(2)}>시작하기</button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">PRIVATE BY DEFAULT</p>
            <h1>네 기록은 컴퓨터에만 둘게</h1>
            <p>일정, 할 일, 하루 노트와 뽀모도로 기록은 외부 서버로 보내지 않아. 대화창에서 일정으로 알아들은 말도 이 컴퓨터에서만 처리해.</p>
            <p>나랑 수다를 떨 때만 대화창에 입력한 말과 최근 대화 일부가 답변을 만들기 위해 외부 AI로 전송돼. 하루 노트는 [햄이에게 보여주기]를 누를 때만 그 페이지가 전송돼.</p>
            <p>AI 대화는 무료야. 남은 횟수는 설정 → 대화 탭에서 볼 수 있고, 내 API 키로 바꿀 수도 있어.</p>
            <button type="button" onClick={() => setStep(3)}>확인했어</button>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-content">
            <p className="pixel-kicker">READY!</p>
            <h1>준비 끝!</h1>
            <p>햄이를 두 번 클릭하고 “내일 3시 병원 일정 추가해줘”처럼 말해봐. 일정을 넣어줄게! 더 궁금한 건 우클릭 → 도움말에 있어.</p>
            <button type="button" onClick={() => void window.desktopPetAPI.completeOnboarding()}>
              햄이 만나기
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default OnboardingWindow
