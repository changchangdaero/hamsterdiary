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
  // Another page of the same message follows; a click turns to it.
  hasMorePages?: boolean
  onCompleteTyping: () => void
  onNextPage?: () => void
}

function SpeechBubble({
  text,
  isClosing,
  isTyping,
  hasMorePages = false,
  onCompleteTyping,
  onNextPage
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
          else if (hasMorePages) onNextPage?.()
        }}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={
          isTyping
            ? '메시지 전체 내용 바로 표시'
            : hasMorePages
              ? '다음 말 보기'
              : '햄이가 전하는 메시지'
        }
      >
        <span aria-live="polite">
          {text}
          {isTyping && <span className="typewriter-cursor" aria-hidden="true">▍</span>}
          {!isTyping && hasMorePages && <span className="speech-next-page" aria-hidden="true">▶</span>}
        </span>
      </button>
    </SpeechBubbleFrame>
  )
}

export default SpeechBubble
