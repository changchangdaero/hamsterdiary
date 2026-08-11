// 물·스트레칭 반복 간격과 야간 무음 시간을 편집하는 설정 화면입니다.
import { useEffect, useState } from 'react'
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderKind,
  type ReminderSettings
} from '../../../shared/types/notifications'
import type { GeminiKeyStatus } from '../../../shared/types/geminiKey'
import {
  DEFAULT_POMODORO_SETTINGS,
  type PomodoroSettings
} from '../../../shared/types/pomodoro'

function SettingsWindow(): React.JSX.Element {
  const [settings, setSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS
  )
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [keyStatus, setKeyStatus] = useState<GeminiKeyStatus>({ configured: false })
  const [apiKey, setApiKey] = useState('')
  const [pomodoro, setPomodoro] = useState<PomodoroSettings>(
    DEFAULT_POMODORO_SETTINGS
  )

  useEffect(() => {
    void window.desktopPetAPI
      .getReminderSettings()
      .then(setSettings)
      .catch(() => setStatus('설정을 불러오지 못했습니다.'))
    void window.desktopPetAPI
      .getGeminiKeyStatus()
      .then(setKeyStatus)
      .catch(() => setStatus('API 키 상태를 불러오지 못했습니다.'))
    void window.desktopPetAPI
      .getPomodoroSettings()
      .then(setPomodoro)
      .catch(() => setStatus('집중 타이머 설정을 불러오지 못했습니다.'))
  }, [])

  const saveApiKey = async (): Promise<void> => {
    setSaving(true)
    setStatus('')
    try {
      setKeyStatus(await window.desktopPetAPI.saveGeminiKey(apiKey))
      setApiKey('')
      setStatus('Gemini API 키를 저장했어.')
    } catch {
      setStatus('API 키 형식을 다시 확인해줘.')
    } finally {
      setSaving(false)
    }
  }

  const deleteApiKey = async (): Promise<void> => {
    if (!window.confirm('저장된 Gemini API 키를 삭제할까?')) return
    try {
      setKeyStatus(await window.desktopPetAPI.deleteGeminiKey())
      setApiKey('')
      setStatus('API 키를 삭제했어. 다음 실행 때 온보딩이 다시 열려.')
    } catch {
      setStatus('API 키를 삭제하지 못했어.')
    }
  }

  const savePomodoro = async (openTimer = false): Promise<void> => {
    setSaving(true)
    setStatus('')
    try {
      setPomodoro(
        await window.desktopPetAPI.updatePomodoroSettings(pomodoro)
      )
      setStatus('집중 타이머 시간을 저장했어.')
      if (openTimer) await window.desktopPetAPI.openPomodoro()
    } catch {
      setStatus('집중은 1~120분, 휴식은 1~60분으로 입력해줘.')
    } finally {
      setSaving(false)
    }
  }

  const updateReminder = (
    kind: ReminderKind,
    patch: Partial<ReminderSettings[ReminderKind]>
  ): void => {
    setSettings((current) => ({
      ...current,
      [kind]: { ...current[kind], ...patch }
    }))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setStatus('')
    try {
      const [nextReminders, nextPomodoro] = await Promise.all([
        window.desktopPetAPI.updateReminderSettings(settings),
        window.desktopPetAPI.updatePomodoroSettings(pomodoro)
      ])
      setSettings(nextReminders)
      setPomodoro(nextPomodoro)
      setStatus('설정을 저장했어.')
    } catch {
      setStatus('설정을 저장하지 못했습니다. 입력값을 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const control = async (
    kind: ReminderKind,
    action: 'snooze' | 'mute'
  ): Promise<void> => {
    try {
      if (action === 'snooze') {
        await window.desktopPetAPI.snoozeReminder({ kind })
        setStatus('10분 뒤에 다시 알려드릴게요.')
      } else {
        await window.desktopPetAPI.muteReminderForToday({ kind })
        setStatus('이 리마인더는 오늘 더 이상 알리지 않습니다.')
      }
    } catch {
      setStatus('리마인더 제어 요청을 처리하지 못했습니다.')
    }
  }

  return (
    <main className="reminder-settings">
      <header>
        <p>Desktop Pet Scheduler</p>
        <h1>리마인더 설정</h1>
        <span>햄스터가 말을 거는 간격과 조용한 시간을 정할 수 있어요.</span>
      </header>

      <section className="reminder-setting-card api-key-settings">
        <div className="setting-card-heading">
          <div>
            <h2>Gemini API 키</h2>
            <p>키는 이 컴퓨터에만 저장되고 main 프로세스에서만 사용돼.</p>
          </div>
          <strong className={`key-status ${keyStatus.configured ? 'is-set' : ''}`}>
            {keyStatus.configured ? '설정됨' : '없음'}
          </strong>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => void window.desktopPetAPI.openGeminiKeyPage()}
        >
          AI Studio 열기
        </button>
        <label>
          {keyStatus.configured ? '새 키로 변경' : 'API 키 입력'}
          <input
            type="password"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder="Gemini API 키"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <div className="api-key-actions">
          <button
            type="button"
            disabled={saving || apiKey.trim().length === 0}
            onClick={() => void saveApiKey()}
          >
            {keyStatus.configured ? '키 변경' : '키 저장'}
          </button>
          {keyStatus.configured && (
            <button type="button" className="danger" onClick={() => void deleteApiKey()}>
              키 삭제
            </button>
          )}
        </div>
      </section>

      {(['water', 'stretch'] as const).map((kind) => {
        const label = kind === 'water' ? '물 마시기' : '스트레칭'
        return (
          <section key={kind} className="reminder-setting-card">
            <div className="setting-card-heading">
              <div>
                <h2>{label}</h2>
                <p>기본 간격마다 펫 말풍선으로 알려줍니다.</p>
              </div>
              <label className="setting-switch">
                <input
                  type="checkbox"
                  checked={settings[kind].enabled}
                  onChange={(event) =>
                    updateReminder(kind, { enabled: event.target.checked })
                  }
                />
                <span>{settings[kind].enabled ? '켜짐' : '꺼짐'}</span>
              </label>
            </div>
            <label>
              알림 간격(분)
              <input
                type="number"
                min={1}
                max={720}
                value={settings[kind].intervalMinutes}
                disabled={!settings[kind].enabled}
                onChange={(event) =>
                  updateReminder(kind, {
                    intervalMinutes: Number(event.target.value)
                  })
                }
              />
            </label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings[kind].showOsNotification}
                disabled={!settings[kind].enabled}
                onChange={(event) =>
                  updateReminder(kind, {
                    showOsNotification: event.target.checked
                  })
                }
              />
              OS 알림도 함께 표시
            </label>
            <div className="reminder-controls">
              <button
                type="button"
                className="secondary"
                onClick={() => void control(kind, 'snooze')}
              >
                10분 뒤 다시 알림
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void control(kind, 'mute')}
              >
                오늘 그만
              </button>
            </div>
          </section>
        )
      })}

      <section className="reminder-setting-card">
        <div className="setting-card-heading">
          <div>
            <h2>야간 자동 무음</h2>
            <p>설정 시간에는 반복 리마인더를 조용히 건너뜁니다.</p>
          </div>
          <label className="setting-switch">
            <input
              type="checkbox"
              checked={settings.quietHours.enabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    enabled: event.target.checked
                  }
                }))
              }
            />
            <span>{settings.quietHours.enabled ? '켜짐' : '꺼짐'}</span>
          </label>
        </div>
        <div className="quiet-hours-row">
          <label>
            시작 시
            <input
              type="number"
              min={0}
              max={23}
              value={settings.quietHours.startHour}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    startHour: Number(event.target.value)
                  }
                }))
              }
            />
          </label>
          <span>부터</span>
          <label>
            종료 시
            <input
              type="number"
              min={0}
              max={23}
              value={settings.quietHours.endHour}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    endHour: Number(event.target.value)
                  }
                }))
              }
            />
          </label>
          <span>까지</span>
        </div>
      </section>

      <section className="reminder-setting-card pomodoro-settings-card">
        <div className="setting-card-heading">
          <div>
            <h2>같이 집중 타이머</h2>
            <p>집중과 휴식 시간을 원하는 길이로 맞출 수 있어.</p>
          </div>
        </div>
        <div className="pomodoro-settings-row">
          <label>
            집중 시간(분)
            <input
              type="number"
              min={1}
              max={120}
              value={pomodoro.focusMinutes}
              onChange={(event) =>
                setPomodoro((current) => ({
                  ...current,
                  focusMinutes: Number(event.target.value)
                }))
              }
              onBlur={() => void savePomodoro()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void savePomodoro()
              }}
            />
          </label>
          <label>
            휴식 시간(분)
            <input
              type="number"
              min={1}
              max={60}
              value={pomodoro.breakMinutes}
              onChange={(event) =>
                setPomodoro((current) => ({
                  ...current,
                  breakMinutes: Number(event.target.value)
                }))
              }
              onBlur={() => void savePomodoro()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void savePomodoro()
              }}
            />
          </label>
        </div>
        <div className="pomodoro-settings-actions">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => void savePomodoro()}
          >
            시간 저장
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void savePomodoro(true)}
          >
            저장하고 타이머 열기
          </button>
        </div>
      </section>

      <div className="settings-footer">
        <p role="status">{status}</p>
        <button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? '저장 중…' : '설정 저장'}
        </button>
      </div>
    </main>
  )
}

export default SettingsWindow
