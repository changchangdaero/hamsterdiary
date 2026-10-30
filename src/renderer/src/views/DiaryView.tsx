// 노트 창의 일기 탭: 날짜별 일기 한 장을 자동 저장합니다.
import { formatDateKey, moveDateKey, toDateKey } from '../dateKey'
import {
  autoSaveStatusLabel,
  useAutoSavedText
} from '../hooks/useAutoSavedText'

interface Props {
  date: string
  onDateChange: (date: string) => void
}

const loadDiary = async (date: string): Promise<string> =>
  (await window.desktopPetAPI.getDiary(date))?.text ?? ''

const saveDiary = async (date: string, text: string): Promise<void> => {
  await window.desktopPetAPI.saveDiary({ date, text })
}

function DiaryView({ date, onDateChange }: Props): React.JSX.Element {
  const today = toDateKey(new Date())
  const { text, setText, status } = useAutoSavedText({
    date,
    load: loadDiary,
    save: saveDiary
  })

  return (
    <section className="diary-panel">
      <div className="diary-date-nav">
        <button type="button" onClick={() => onDateChange(moveDateKey(date, -1))} aria-label="이전 날짜">◀</button>
        <div>
          <strong>{formatDateKey(date)}</strong>
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} aria-label="일기 날짜 선택" />
        </div>
        <button type="button" onClick={() => onDateChange(moveDateKey(date, 1))} aria-label="다음 날짜">▶</button>
      </div>
      {date !== today && <button className="diary-today" type="button" onClick={() => onDateChange(today)}>오늘로</button>}
      <label htmlFor="diary-text">오늘의 일기</label>
      <textarea
        id="diary-text"
        value={text}
        disabled={status === 'loading' || status === 'load-error'}
        maxLength={10000}
        placeholder="오늘은 어떤 하루였어?"
        onChange={(event) => setText(event.target.value)}
      />
      <footer className="diary-actions">
        <span role="status">{autoSaveStatusLabel(status)}</span>
      </footer>
    </section>
  )
}

export default DiaryView
