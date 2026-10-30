// 물·스트레칭 반복 간격과 야간 무음 시간을 편집하는 설정 화면입니다.
import { useEffect, useState } from 'react'
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderKind,
  type ReminderSettings
} from '../../../shared/types/notifications'
import {
  DEFAULT_POMODORO_SETTINGS,
  type PomodoroSettings
} from '../../../shared/types/pomodoro'
import {
  DEFAULT_PET_BEHAVIOR_SETTINGS,
  PET_SLEEP_AFTER_MINUTES,
  type PetActivityLevel,
  type PetBehaviorSettings,
  type PetIdleActionId
} from '../../../shared/types/pet'
import type { SettingsSection } from '../../../shared/types/foundation'
import { IDLE_ACTIONS, PET_STATE_CLIPS } from '../petIdleBehaviors'
import PetClipPreview from '../components/PetClipPreview'
import HamiUsagePanel from '../components/HamiUsagePanel'

const ACTIVITY_LEVELS: Array<{ value: PetActivityLevel; label: string; hint: string }> = [
  { value: 'calm', label: '차분', hint: '45~90초마다' },
  { value: 'normal', label: '보통', hint: '20~45초마다' },
  { value: 'lively', label: '활발', hint: '10~25초마다' }
]

// Single-frame state clips replay their one-shot motion on this cycle.
const STATE_PREVIEW_CYCLE_MS = 2_400

const isSettingsSection = (value: string | null): value is SettingsSection =>
  value === 'conversation' || value === 'reminders' || value === 'focus' || value === 'pet'

function SettingsWindow(): React.JSX.Element {
  const initialSection = new URLSearchParams(window.location.search).get('section')
  const [activeTab, setActiveTab] = useState<SettingsSection>(
    isSettingsSection(initialSection) ? initialSection : 'conversation'
  )
  const [settings, setSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS
  )
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [pomodoro, setPomodoro] = useState<PomodoroSettings>(
    DEFAULT_POMODORO_SETTINGS
  )
  const [dirty, setDirty] = useState(false)
  const [behavior, setBehavior] = useState<PetBehaviorSettings>(
    DEFAULT_PET_BEHAVIOR_SETTINGS
  )
  const [actionStatus, setActionStatus] = useState<Partial<Record<PetIdleActionId, string>>>({})

  useEffect(() => {
    void window.desktopPetAPI
      .getReminderSettings()
      .then(setSettings)
      .catch(() => setStatus('설정을 불러오지 못했습니다.'))
    void window.desktopPetAPI
      .getPomodoroSettings()
      .then(setPomodoro)
      .catch(() => setStatus('집중 타이머 설정을 불러오지 못했습니다.'))
    void window.desktopPetAPI
      .getPetBehaviorSettings()
      .then(setBehavior)
      .catch(() => setStatus('햄이 동작 설정을 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    window.desktopPetAPI.setSettingsDirty(dirty)
  }, [dirty])

  useEffect(
    () => window.desktopPetAPI.onSettingsSectionRequested(setActiveTab),
    []
  )

  const updateReminder = (
    kind: ReminderKind,
    patch: Partial<ReminderSettings[ReminderKind]>
  ): void => {
    setDirty(true)
    setSettings((current) => ({
      ...current,
      [kind]: { ...current[kind], ...patch }
    }))
  }

  const save = async (): Promise<boolean> => {
    setSaving(true)
    setStatus('')
    try {
      const [nextReminders, nextPomodoro, nextBehavior] = await Promise.all([
        window.desktopPetAPI.updateReminderSettings(settings),
        window.desktopPetAPI.updatePomodoroSettings(pomodoro),
        window.desktopPetAPI.updatePetBehaviorSettings(behavior)
      ])
      setSettings(nextReminders)
      setPomodoro(nextPomodoro)
      setBehavior(nextBehavior)
      setStatus('설정을 저장했어.')
      setDirty(false)
      return true
    } catch {
      setStatus('설정을 저장하지 못했습니다. 입력값을 확인해 주세요.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateBehavior = (patch: Partial<PetBehaviorSettings>): void => {
    setDirty(true)
    setBehavior((current) => ({ ...current, ...patch }))
  }

  const toggleAction = (id: PetIdleActionId, enabled: boolean): void => {
    updateBehavior({
      disabledActions: enabled
        ? behavior.disabledActions.filter((disabled) => disabled !== id)
        : [...behavior.disabledActions, id]
    })
  }

  const playAction = async (id: PetIdleActionId): Promise<void> => {
    setActionStatus((current) => ({ ...current, [id]: '' }))
    try {
      const result = await window.desktopPetAPI.playPetAction(id)
      setActionStatus((current) => ({
        ...current,
        [id]: result === 'played' ? '햄이가 하는 중!' : '햄이가 지금 바빠.'
      }))
    } catch {
      setActionStatus((current) => ({ ...current, [id]: '햄이에게 전하지 못했어.' }))
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
        <p>HAMI</p>
        <h1>Hami 설정</h1>
        <span>대화, 알림, 집중 시간과 햄이 동작을 한곳에서 관리할 수 있어.</span>
      </header>

      <nav className="settings-tabs" aria-label="설정 영역">
        <button type="button" className={activeTab === 'conversation' ? 'active' : ''} onClick={() => setActiveTab('conversation')}>대화</button>
        <button type="button" className={activeTab === 'reminders' ? 'active' : ''} onClick={() => setActiveTab('reminders')}>알림</button>
        <button type="button" className={activeTab === 'focus' ? 'active' : ''} onClick={() => setActiveTab('focus')}>집중 타이머</button>
        <button type="button" className={activeTab === 'pet' ? 'active' : ''} onClick={() => setActiveTab('pet')}>햄이 동작</button>
      </nav>

      <section className="reminder-setting-card api-key-settings" hidden={activeTab !== 'conversation'}>
        <div className="setting-card-heading">
          <div>
            <h2>햄이 AI 대화</h2>
            <p>별도의 계정이나 API 키 없이 무료로 대화할 수 있어.</p>
          </div>
          <strong className="key-status is-set">무료 제공</strong>
        </div>
        {/* Mounted only while the tab is open, so opening it always shows fresh counts. */}
        {activeTab === 'conversation' && <HamiUsagePanel />}
        <div className="usage-privacy">
          <p>대화창에 입력한 수다와 최근 대화 일부만 외부 AI로 전송돼.</p>
          <p>하루 계획은 [햄이에게 보여주기]를 누를 때만 그 내용이 전송돼.</p>
          <p>일정·할 일·일기·뽀모도로 기록과 일정 관련 말은 이 컴퓨터에서만 처리돼.</p>
        </div>
      </section>

      {(['water', 'stretch'] as const).map((kind) => {
        const label = kind === 'water' ? '물 마시기' : '스트레칭'
        return (
          <section key={kind} className="reminder-setting-card" hidden={activeTab !== 'reminders'}>
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

      <section className="reminder-setting-card" hidden={activeTab !== 'reminders'}>
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
                { setDirty(true); setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    enabled: event.target.checked
                  }
                })) }
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
                { setDirty(true); setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    startHour: Number(event.target.value)
                  }
                })) }
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
                { setDirty(true); setSettings((current) => ({
                  ...current,
                  quietHours: {
                    ...current.quietHours,
                    endHour: Number(event.target.value)
                  }
                })) }
              }
            />
          </label>
          <span>까지</span>
        </div>
      </section>

      <section className="reminder-setting-card pomodoro-settings-card" hidden={activeTab !== 'focus'}>
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
                { setDirty(true); setPomodoro((current) => ({
                  ...current,
                  focusMinutes: Number(event.target.value)
                })) }
              }
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
                { setDirty(true); setPomodoro((current) => ({
                  ...current,
                  breakMinutes: Number(event.target.value)
                })) }
              }
            />
          </label>
        </div>
        <div className="pomodoro-settings-actions">
          <button
            type="button"
            disabled={saving}
            onClick={() => void (async () => {
              if ((!dirty || await save())) await window.desktopPetAPI.openPomodoro()
            })()}
          >
            타이머 열기
          </button>
        </div>
      </section>

      <section className="reminder-setting-card" hidden={activeTab !== 'pet'}>
        <div className="setting-card-heading">
          <div>
            <h2>햄이 움직임</h2>
            <p>가끔 하는 동작의 빈도와 잠드는 시간을 정할 수 있어.</p>
          </div>
        </div>
        <fieldset className="pet-choice-group">
          <legend>동작 빈도</legend>
          {ACTIVITY_LEVELS.map((level) => (
            <label key={level.value}>
              <input
                type="radio"
                name="pet-activity"
                checked={behavior.activityLevel === level.value}
                onChange={() => updateBehavior({ activityLevel: level.value })}
              />
              <span>{level.label}</span>
              <small>{level.hint}</small>
            </label>
          ))}
        </fieldset>
        <fieldset className="pet-choice-group">
          <legend>잠드는 시간</legend>
          {PET_SLEEP_AFTER_MINUTES.map((minutes) => (
            <label key={minutes}>
              <input
                type="radio"
                name="pet-sleep-after"
                checked={behavior.sleepAfterMinutes === minutes}
                onChange={() => updateBehavior({ sleepAfterMinutes: minutes })}
              />
              <span>{minutes}분</span>
            </label>
          ))}
          <p className="pet-choice-note">키보드·마우스 입력이 이 시간 동안 없으면 햄이가 잠들어.</p>
        </fieldset>
      </section>

      <section className="reminder-setting-card" hidden={activeTab !== 'pet'}>
        <div className="setting-card-heading">
          <div>
            <h2>가끔 하는 동작</h2>
            <p>끈 동작은 저절로 하지 않지만, 직접 시키면 언제든 해줘.</p>
          </div>
        </div>
        <ul className="pet-clip-grid">
          {IDLE_ACTIONS.map((action) => {
            const enabled = !behavior.disabledActions.includes(action.id)
            return (
              <li key={action.id} className={`pet-clip-card${enabled ? '' : ' is-off'}`}>
                <PetClipPreview clip={action} cycleMs={action.duration} />
                <strong>{action.label}</strong>
                <p>{action.description}</p>
                <label className="setting-checkbox">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => toggleAction(action.id, event.target.checked)}
                  />
                  가끔 하기
                </label>
                <button type="button" className="secondary" onClick={() => void playAction(action.id)}>
                  햄이에게 시키기
                </button>
                <small role="status">{actionStatus[action.id] ?? ''}</small>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="reminder-setting-card" hidden={activeTab !== 'pet'}>
        <div className="setting-card-heading">
          <div>
            <h2>상황별 모습</h2>
            <p>햄이가 상황에 맞춰 알아서 보여주는 모습이야.</p>
          </div>
        </div>
        <ul className="pet-clip-grid">
          {PET_STATE_CLIPS.map((clip) => (
            <li key={clip.label} className="pet-clip-card">
              <PetClipPreview clip={clip} cycleMs={STATE_PREVIEW_CYCLE_MS} />
              <strong>{clip.label}</strong>
              <p>{clip.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="settings-footer">
        <p role="status">{status || (dirty ? '저장하지 않은 변경사항이 있어.' : '')}</p>
        <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? '저장 중…' : '변경사항 저장'}
        </button>
      </div>
    </main>
  )
}

export default SettingsWindow
