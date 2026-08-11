import { PET_FRAME_IMAGES } from '../petAssets'

const Example = ({ children }: { children: string }): React.JSX.Element => (
  <li><code>“{children}”</code></li>
)

function HelpWindow(): React.JSX.Element {
  return (
    <main className="help-shell">
      <header className="help-header">
        <div>
          <p className="pixel-kicker">HAMSTER GUIDE</p>
          <h1>햄스터 도움말</h1>
          <p>뭐라고 말할지 고민되면 여기서 골라 말해봐!</p>
        </div>
        <img src={PET_FRAME_IMAGES.question} alt="도와주는 햄스터" />
      </header>

      <section className="help-card help-examples">
        <h2>1. 나한테 이렇게 말해봐</h2>
        <div className="help-example-grid">
          <div>
            <h3>일정 잡기</h3>
            <ul>
              <Example>내일 3시에 병원</Example>
              <Example>금요일 저녁 7시 저녁약속 잡아줘</Example>
              <Example>월요일 9시 회의, 화요일 2시 치과</Example>
            </ul>
            <p>여러 개 한번에도 돼!</p>
          </div>
          <div>
            <h3>일정 물어보기</h3>
            <ul>
              <Example>이번 주 일정 뭐 있어?</Example>
              <Example>내일 뭐 있더라?</Example>
            </ul>
          </div>
          <div>
            <h3>일정 바꾸기 / 지우기</h3>
            <ul>
              <Example>병원 일정 목요일로 옮겨줘</Example>
              <Example>회의 일정 취소해줘</Example>
            </ul>
          </div>
        </div>
      </section>

      <section className="help-card">
        <h2>2. 할 일도 나한테 맡겨</h2>
        <div className="help-example-grid">
          <div>
            <h3>할 일 추가하기</h3>
            <ul>
              <li>입력창 위에서 “할일”을 선택하고 말하면 돼.</li>
              <Example>장보기</Example>
              <Example>리포트 제출</Example>
              <li>할 일 탭에서 직접 타이핑해서 추가할 수도 있어.</li>
            </ul>
          </div>
          <div>
            <h3>할 일 관리하기</h3>
            <ul>
              <li>다 하면 체크박스를 눌러서 완료 표시해.</li>
              <li>필요 없어진 건 삭제하면 돼.</li>
              <li>할 일을 다 끝내면 내가 같이 기뻐해줄게!</li>
            </ul>
          </div>
          <div>
            <h3>💡 일정이랑 뭐가 달라?</h3>
            <ul>
              <li>시간이 정해진 건 “일정”이야. 예: 내일 3시 병원</li>
              <li>언젠가 하면 되는 건 “할일”이야. 예: 우유 사기</li>
              <li>입력창 위 [일정/할일] 토글로 골라서 넣으면 돼.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="help-card">
        <h2>3. 내가 챙겨줄게</h2>
        <ul>
          <li>물 마실 시간, 스트레칭할 시간을 내가 알려줄게.</li>
          <li>너무 오래 앉아있으면 “잠깐 일어나자~” 하고 말 걸 거야.</li>
          <li>알림 간격은 설정에서 바꾸거나 끌 수 있어.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>4. 알아두면 좋은 것</h2>
        <ul>
          <li>날짜는 “내일”, “이번 주 금요일”처럼 편하게 말해도 돼.</li>
          <li>여러 일정도 한 번에 말할 수 있어.</li>
          <li>지우거나 옮길 때 뭘 말하는지 애매하면 되물어볼게.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>5. 그 외에</h2>
        <ul>
          <li>달력에서 전체 일정을 볼 수 있어.</li>
          <li>집중 타이머를 켜면 나도 옆에서 같이 집중하고 쉴게.</li>
          <li>설정에서 API 키랑 알림을 바꿀 수 있어.</li>
          <li>심심하면 내가 책상 위에서 꼬물거려.</li>
        </ul>
      </section>

      <button
        type="button"
        className="help-close"
        onClick={() => void window.desktopPetAPI.closeHelp()}
      >
        도움말 닫기
      </button>
    </main>
  )
}

export default HelpWindow
