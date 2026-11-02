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
          <h1>햄이 도움말</h1>
          <p>뭐라고 말할지 고민되면 여기서 골라 말해봐!</p>
        </div>
        <img src={PET_FRAME_IMAGES.question} alt="도와주는 햄이" />
      </header>

      <section className="help-card">
        <h2>1. 햄이 조작하기</h2>
        <ul>
          <li>햄이를 두 번 클릭하면 대화창이 열려.</li>
          <li>누른 채 움직이면 원하는 위치로 옮길 수 있어.</li>
          <li>우클릭하면 일정 다이어리, 새 일정, 집중 타이머, 할 일, 하루 노트, 설정을 열 수 있어.</li>
          <li>말풍선을 클릭하면 문장을 바로 끝까지 볼 수 있어. 끝에 ▶가 보이면 클릭해서 다음 말을 볼 수 있어.</li>
          <li>작업 표시줄 트레이 아이콘을 클릭하면 햄이를 숨기거나 다시 부를 수 있어.</li>
        </ul>
      </section>

      <section className="help-card help-examples">
        <h2>2. 일정은 나한테 말로 맡겨</h2>
        <div className="help-example-grid">
          <div>
            <h3>일정 넣기</h3>
            <ul>
              <Example>내일 3시 병원 일정 추가해줘</Example>
              <Example>나 내일 5시 병원 예약 있어</Example>
              <Example>금요일 저녁 7시 저녁약속 잡아줘</Example>
              <Example>월요일 9시 회의, 화요일 2시 치과</Example>
            </ul>
            <p>“일정 추가해줘”를 붙이면 가장 잘 알아들어. 여러 개 한 번에도 돼!</p>
          </div>
          <div>
            <h3>일정 물어보기</h3>
            <ul>
              <Example>내일 뭐 있어?</Example>
              <Example>이번 주 일정 뭐 있어?</Example>
            </ul>
          </div>
          <div>
            <h3>옮기기 / 취소하기</h3>
            <ul>
              <Example>병원 목요일로 옮겨줘</Example>
              <Example>회의 4시로 바꿔줘</Example>
              <Example>회의 취소해줘</Example>
            </ul>
          </div>
        </div>
        <ul className="help-tips">
          <li>바로 저장하지 않고 확인 카드를 먼저 보여줄게. [추가]를 눌러야 저장돼.</li>
          <li>오전·오후 없이 1시~6시라고 하면 오후로 알아들어. 아침이면 “오전 6시”처럼 말해줘.</li>
          <li>일정으로 알아들은 말은 이 컴퓨터에서만 처리하고, AI 대화 횟수도 쓰지 않아.</li>
          <li>일정으로 못 알아들은 말은 수다처럼 AI로 전송돼. 날짜와 시간이 있으면 답장 아래 [이 말을 일정으로 넣기]로 넣을 수 있어.</li>
          <li>일정이 아닌데 카드가 뜨면 [일정 말고 그냥 대화할래]를 눌러줘.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>3. 나랑 수다 떨기</h2>
        <ul>
          <li>일정 말이 아니면 AI로 대답할게. 기본은 햄이 서버라서 계정이나 API 키 없이 무료로 쓸 수 있어.</li>
          <li>햄이 서버는 하루, 한 달에 나눌 수 있는 횟수가 정해져 있어. 남은 횟수는 설정 → 대화 탭에서 볼 수 있어.</li>
          <li>내 API 키가 있으면 설정 → 대화 탭에서 “내 API 키”로 바꿀 수 있어. OpenAI, Google Gemini 키를 쓸 수 있고, 횟수 제한이 없는 대신 요금은 네 계정에 청구돼.</li>
          <li>내 키는 이 컴퓨터에 암호화해서 저장하고, 햄이 서버로 보내지 않아.</li>
          <li>Gemini를 결제 연결 없이 무료 등급으로 쓰면 입력한 내용이 Google의 AI 학습에 쓰이고, 사람이 읽을 수도 있어. 민감한 내용은 보내지 마.</li>
          <li>대화창에 입력한 말과 최근 대화 일부만 AI로 전송돼. 내 키를 쓰면 고른 회사로 바로 전송돼.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>4. 할 일과 하루 노트</h2>
        <ul>
          <li>한 창에서 탭으로 할 일과 하루 노트를 바꿔 볼 수 있어. 적는 대로 자동 저장돼.</li>
          <li>하루 노트는 날짜마다 한 장이야. 계획이든 있었던 일이든 자유롭게 적어봐.</li>
          <li>할 일은 다 하면 체크하고, 필요 없어지면 지우면 돼. 다 끝내면 내가 같이 기뻐해줄게!</li>
          <li>달력에서 날짜를 누르거나, 일정 상세의 [계획짜자] 버튼으로 그날 노트를 열 수 있어.</li>
          <li>[햄이에게 보여주기]를 누르면 노트를 읽고 말풍선으로 한마디 해줄게. 이때만 그 페이지 내용이 AI로 전송돼.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>5. 집중 타이머</h2>
        <ul>
          <li>우클릭 → 집중 타이머에서 시작할 수 있어.</li>
          <li>집중하는 동안에는 말을 걸지 않고 남은 시간만 조용히 보여줄게.</li>
          <li>쉬는 시간에는 나도 같이 꾸벅꾸벅 쉴게. 시간은 설정 → 집중 타이머에서 바꿀 수 있어.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>6. 내가 챙겨줄게</h2>
        <ul>
          <li>물 마실 시간, 스트레칭할 시간을 말풍선으로 알려줄게.</li>
          <li>설정 → 알림에서 간격을 바꾸거나, “10분 뒤 다시 알림”, “오늘 그만”을 누를 수 있어.</li>
          <li>야간 자동 무음을 켜면 밤에는 조용히 있을게.</li>
        </ul>
      </section>

      <section className="help-card">
        <h2>7. 내 모습</h2>
        <ul>
          <li>가끔 토카토카 댄스를 춰. 하찮지만 진심이야!</li>
          <li>한동안 입력이 없으면 잠들고, 돌아오면 깜짝 놀라며 깨어나.</li>
          <li>설정 → 햄이 동작에서 얼마나 자주 움직일지, 언제 잠들지 정하고 직접 시켜볼 수도 있어.</li>
        </ul>
      </section>

      <p className="help-footnote">많이 힘들 땐 혼자 버티지 말고 믿을 수 있는 사람에게 말해줘. 자살예방 상담전화는 109야.</p>

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
