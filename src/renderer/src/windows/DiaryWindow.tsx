import { useEffect, useRef, useState } from 'react'
import { PET_FRAME_IMAGES } from '../petAssets'
import TypewriterText from '../components/TypewriterText'
import PixelConfirmDialog from '../components/PixelConfirmDialog'

const toDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDate = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일`
}

const moveDate = (dateKey: string, offset: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return toDateKey(new Date(year, month - 1, day + offset))
}

function DiaryWindow(): React.JSX.Element {
  const today = toDateKey(new Date())
  const requestedDate = new URLSearchParams(window.location.search).get('date')
  const [date, setDate] = useState(
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : today
  )
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [comfortLoading, setComfortLoading] = useState(false)
  const [comfortReply, setComfortReply] = useState('')
  const comfortRequestRef = useRef(0)
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const comfortPanelRef = useRef<HTMLElement | null>(null)

  useEffect(
    () => window.desktopPetAPI.onDiaryOpenDateRequested(setDate),
    []
  )

  useEffect(() => {
    let active = true
    comfortRequestRef.current += 1
    setComfortLoading(false)
    setLoading(true)
    setStatus('')
    setComfortReply('')
    void window.desktopPetAPI
      .getDiary(date)
      .then((entry) => {
        if (!active) return
        const nextText = entry?.text ?? ''
        setText(nextText)
        setSavedText(nextText)
        setComfortReply(entry?.hamsterReply ?? '')
      })
      .catch(() => active && setStatus('일기를 불러오지 못했어.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [date])

  useEffect(() => {
    if (!comfortLoading && !comfortReply) return
    const frame = requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [comfortLoading, comfortReply])

  const save = async (): Promise<void> => {
    if (loading) return
    setLoading(true)
    setStatus('')
    try {
      const entry = await window.desktopPetAPI.saveDiary({ date, text })
      const nextText = entry?.text ?? ''
      setText(nextText)
      setSavedText(nextText)
      setStatus(entry ? '저장했어!' : '빈 일기는 남기지 않았어.')
    } catch {
      setStatus('일기를 저장하지 못했어.')
    } finally {
      setLoading(false)
    }
  }

  const changeDate = (nextDate: string): void => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return
    if (text !== savedText) {
      setPendingDate(nextDate)
      return
    }
    setDate(nextDate)
  }

  const askHamster = async (): Promise<void> => {
    if (comfortLoading || loading) return
    if (text !== savedText) {
      setStatus('먼저 일기를 저장해 줘. 저장된 글을 읽어볼게!')
      return
    }
    setComfortLoading(true)
    setComfortReply('')
    setStatus('햄스터가 일기를 읽고 있어...')
    const request = comfortRequestRef.current + 1
    comfortRequestRef.current = request
    try {
      const response = await window.desktopPetAPI.comfortDiary(date)
      if (comfortRequestRef.current !== request) return
      setComfortReply(response.reply)
      setStatus('')
    } catch (error) {
      if (comfortRequestRef.current !== request) return
      setStatus('')
      const message = error instanceof Error ? error.message : String(error)
      if (/GEMINI_KEY_MISSING|GEMINI_KEY_INVALID/u.test(message)) {
        setComfortReply('내가 일기를 읽으려면 설정에서 Gemini API 키를 먼저 확인해 줘.')
      } else if (/GEMINI_TIMEOUT/u.test(message)) {
        setComfortReply('조금 오래 생각하다가 답을 놓쳤어. 잠시 뒤에 다시 들려줄래?')
      } else {
        setComfortReply('지금은 일기를 끝까지 읽지 못했어. 잠시 뒤에 다시 들려줘.')
      }
    } finally {
      if (comfortRequestRef.current === request) setComfortLoading(false)
    }
  }

  return (
    <main className="diary-shell">
      <header className="diary-header">
        <div>
          <p className="pixel-kicker">HAMSTER DIARY</p>
          <h1>하루 한 장 일기</h1>
          <nav className="todo-tabs" aria-label="일정, 할 일, 일기 화면">
            <button type="button" onClick={() => void window.desktopPetAPI.openScheduleDiary()}>일정</button>
            <button type="button" onClick={() => void window.desktopPetAPI.openTodos()}>할 일</button>
            <span aria-current="page">일기</span>
          </nav>
        </div>
        <img src={PET_FRAME_IMAGES.happy} alt="일기를 응원하는 햄스터" />
      </header>

      <section className="diary-panel">
        <div className="diary-date-nav">
          <button type="button" onClick={() => changeDate(moveDate(date, -1))} aria-label="이전 날짜">◀</button>
          <div>
            <strong>{formatDate(date)}</strong>
            <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} aria-label="일기 날짜 선택" />
          </div>
          <button type="button" onClick={() => changeDate(moveDate(date, 1))} aria-label="다음 날짜">▶</button>
        </div>
        {date !== today && <button className="diary-today" type="button" onClick={() => changeDate(today)}>오늘로</button>}
        <label htmlFor="diary-text">오늘의 일기</label>
        <textarea
          id="diary-text"
          value={text}
          disabled={loading}
          maxLength={10000}
          placeholder="오늘은 어떤 하루였어?"
          onChange={(event) => {
            setText(event.target.value)
            setStatus('')
          }}
        />
        <footer className="diary-actions">
          <span role="status">{status}</span>
          <div>
            <button
              type="button"
              className="diary-comfort-button"
              disabled={loading || comfortLoading}
              onClick={() => void askHamster()}
            >
              {comfortLoading ? '햄스터가 읽는 중...' : '나 오늘 이랬어'}
            </button>
            <button type="button" disabled={loading || text === savedText} onClick={() => void save()}>저장</button>
          </div>
        </footer>
        {(comfortLoading || comfortReply) && (
          <section ref={comfortPanelRef} className="diary-comfort" aria-live="polite">
            <img src={PET_FRAME_IMAGES.talking} alt="일기를 읽고 이야기하는 햄스터" />
            <p>
              {comfortLoading
                ? '잠깐만, 천천히 읽어보고 있어...'
                : <TypewriterText text={comfortReply} />}
            </p>
          </section>
        )}
      </section>
      <button type="button" className="todo-close" onClick={() => void window.desktopPetAPI.closeDiary()}>창 닫기</button>
      {pendingDate && (
        <PixelConfirmDialog
          title="날짜를 바꿀까?"
          description="아직 저장하지 않은 일기 내용은 사라져."
          confirmLabel="날짜 바꾸기"
          onCancel={() => setPendingDate(null)}
          onConfirm={() => {
            setDate(pendingDate)
            setPendingDate(null)
          }}
        />
      )}
    </main>
  )
}

export default DiaryWindow
