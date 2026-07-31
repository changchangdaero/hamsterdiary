// 물·스트레칭 반복 간격과 야간 무음 시간을 편집하는 설정 화면입니다.
import { useEffect, useState } from 'react'
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderKind,
  type ReminderSettings
} from '../../../shared/types/notifications'

function SettingsWindow(): React.JSX.Element {
  const [settings, setSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS
  )
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.desktopPetAPI
      .getReminderSettings()
      .then(setSettings)
      .catch(() => setStatus('설정을 불러오지 못했습니다.'))
  }, [])

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
      setSettings(await window.desktopPetAPI.updateReminderSettings(settings))
      setStatus('리마인더 설정을 저장했습니다.')
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
