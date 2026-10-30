// 설정의 "대화" 탭에서 오늘·이번 달 남은 AI 대화 횟수를 막대로 보여주는 패널입니다.
import { useEffect, useState } from 'react'
import type { HamiUsage, HamiUsagePeriod } from '../../../shared/types/chat'

// At or under this share of the limit the bar turns orange.
const LOW_SHARE = 0.2

const formatReset = (period: 'daily' | 'monthly', resetsAt: string): string => {
  if (period === 'daily') return '자정에 다시 채워져요'
  const date = new Date(resetsAt)
  return `${date.getMonth() + 1}월 ${date.getDate()}일에 다시 채워져요`
}

const formatChecked = (checkedAt: Date): string =>
  checkedAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

function UsageMeter({
  label,
  period,
  usage
}: {
  label: string
  period: 'daily' | 'monthly'
  usage: HamiUsagePeriod
}): React.JSX.Element {
  const share = usage.limit > 0 ? usage.remaining / usage.limit : 0
  const level = usage.remaining === 0 ? 'is-empty' : share <= LOW_SHARE ? 'is-low' : 'is-ok'
  return (
    <div className={`usage-meter ${level}`}>
      <div className="usage-meter-heading">
        <span>{label}</span>
        <strong>
          {usage.remaining} <small>/ {usage.limit}회</small>
        </strong>
      </div>
      <div
        className="usage-meter-bar"
        role="meter"
        aria-label={`${label} ${usage.limit}회 중 ${usage.remaining}회`}
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.remaining}
      >
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p>
        {usage.remaining === 0
          ? `다 썼어요. ${formatReset(period, usage.resetsAt)}`
          : formatReset(period, usage.resetsAt)}
      </p>
    </div>
  )
}

function HamiUsagePanel(): React.JSX.Element {
  const [usage, setUsage] = useState<HamiUsage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setUsage(await window.desktopPetAPI.getHamiUsage())
      setCheckedAt(new Date())
      setError('')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : ''
      setError(
        message.includes('HAMI_CHAT_NOT_CONFIGURED')
          ? 'AI 대화 서버가 아직 연결되지 않았어요.'
          : '사용량을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="usage-panel" aria-busy={loading}>
      {usage ? (
        <>
          <UsageMeter label="오늘 남은 대화" period="daily" usage={usage.daily} />
          <UsageMeter label="이번 달 남은 대화" period="monthly" usage={usage.monthly} />
          {usage.budgetPaused && (
            <p className="usage-paused">
              이번 달 햄이 AI 대화 예산을 다 써서 다음 달까지 쉬어요. 일정·할 일·일기·뽀모도로는 그대로 쓸 수 있어요.
            </p>
          )}
        </>
      ) : (
        !error && <p className="usage-loading">사용량을 불러오는 중…</p>
      )}
      {error && <p className="usage-error" role="alert">{error}</p>}
      <p className="usage-note">🐹 일정 추가·조회·옮기기·취소는 횟수를 쓰지 않아요.</p>
      <div className="usage-refresh">
        <span>{checkedAt ? `마지막 확인 ${formatChecked(checkedAt)}` : ''}</span>
        <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? '확인 중…' : '새로 고침'}
        </button>
      </div>
    </div>
  )
}

export default HamiUsagePanel
