// 타이핑 중인 펫 메시지를 접근 가능한 CSS 말풍선으로 표시하는 파일입니다.
interface SpeechBubbleProps {
  text: string
  isClosing: boolean
  isTyping: boolean
  onCompleteTyping: () => void
}

function SpeechBubble({
  text,
  isClosing,
  isTyping,
  onCompleteTyping
}: SpeechBubbleProps): React.JSX.Element {
  return (
    <button
      className={`speech-bubble${isClosing ? ' is-closing' : ''}`}
      type="button"
      data-speech-bubble
      data-interactive-hitbox="true"
      onClick={() => {
        if (isTyping) {
          onCompleteTyping()
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={
        isTyping ? '메시지 전체 내용 바로 표시' : '햄스터가 전하는 메시지'
      }
    >
      <span aria-live="polite">{text}</span>
    </button>
  )
}

export default SpeechBubble
