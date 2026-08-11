import type { ReactNode } from 'react'

interface SpeechBubbleFrameProps {
  children: ReactNode
  className?: string
  interactive?: boolean
}

export function SpeechBubbleFrame({
  children,
  className = '',
  interactive = false
}: SpeechBubbleFrameProps): React.JSX.Element {
  return (
    <section
      className={`speech-bubble${className ? ` ${className}` : ''}`}
      data-speech-bubble
      data-interactive-hitbox={interactive ? 'true' : undefined}
    >
      {children}
    </section>
  )
}

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
    <SpeechBubbleFrame
      className={`speech-bubble-message${isClosing ? ' is-closing' : ''}`}
      interactive
    >
      <button
        className="speech-bubble-message-button"
        type="button"
        onClick={() => {
          if (isTyping) onCompleteTyping()
        }}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={
          isTyping ? '메시지 전체 내용 바로 표시' : '햄스터가 전하는 메시지'
        }
      >
        <span aria-live="polite">{text}</span>
      </button>
    </SpeechBubbleFrame>
  )
}

export default SpeechBubble
