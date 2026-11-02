// 설정 "대화" 탭: 햄이 서버와 내 API 키(BYOK) 중 대화 방식을 고르고, 내 키를 확인·저장합니다.
import { useEffect, useState } from 'react'
import {
  BYOK_PROVIDER_INFO,
  BYOK_PROVIDERS,
  DEFAULT_CHAT_SETTINGS,
  type ByokProvider,
  type ByokStatus,
  type ChatMode,
  type ChatSettings
} from '../../../shared/types/byok'
import HamiUsagePanel from './HamiUsagePanel'

type Feedback = { tone: 'ok' | 'error' | 'info'; text: string } | null

function ChatModeSettings({ active }: { active: boolean }): React.JSX.Element {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS)
  const [status, setStatus] = useState<ByokStatus | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    void window.desktopPetAPI.getChatSettings().then(setSettings).catch(() => undefined)
    void window.desktopPetAPI.getByokStatus().then(setStatus).catch(() => undefined)
  }, [])

  const provider = settings.provider
  const info = BYOK_PROVIDER_INFO[provider]
  const savedKey = status?.keys[provider]
  const typedKey = keyInput.trim()

  const update = async (patch: Partial<ChatSettings>): Promise<void> => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setFeedback(null)
    try {
      setSettings(await window.desktopPetAPI.updateChatSettings(next))
    } catch {
      setFeedback({ tone: 'error', text: '설정을 저장하지 못했어. 다시 시도해 줘.' })
    }
  }

  // Tests the typed key (or the saved one) with a one-line chat, and saves a typed key only if it works.
  const checkKey = async (): Promise<void> => {
    setBusy(true)
    setFeedback({ tone: 'info', text: '햄이가 연결을 확인하고 있어…' })
    try {
      const result = await window.desktopPetAPI.testByok({
        provider,
        model: settings.models[provider],
        apiKey: typedKey || undefined
      })
      if (!result.ok) {
        setFeedback({ tone: 'error', text: result.message })
        return
      }
      if (typedKey) {
        setStatus(await window.desktopPetAPI.saveByokKey({ provider, apiKey: typedKey }))
        setKeyInput('')
      }
      setFeedback({ tone: 'ok', text: `연결됐어! 햄이 답장: “${result.reply}”` })
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/u, '') : ''
      setFeedback({ tone: 'error', text: message || '연결 확인에 실패했어.' })
    } finally {
      setBusy(false)
    }
  }

  const removeKey = async (): Promise<void> => {
    setStatus(await window.desktopPetAPI.deleteByokKey(provider))
    setFeedback({ tone: 'info', text: `${info.label} 키를 지웠어.` })
  }

  const modeOption = (mode: ChatMode, label: string, hint: string): React.JSX.Element => (
    <label>
      <input
        type="radio"
        name="chat-mode"
        checked={settings.mode === mode}
        onChange={() => void update({ mode })}
      />
      <span>{label}</span>
      <small>{hint}</small>
    </label>
  )

  return (
    <>
      <div className="setting-card-heading">
        <div>
          <h2>햄이 AI 대화</h2>
          <p>무료 햄이 서버로 대화하거나, 내 API 키로 횟수 제한 없이 대화할 수 있어.</p>
        </div>
        <strong className="key-status is-set">{settings.mode === 'server' ? '무료 제공' : '내 키 사용'}</strong>
      </div>

      <fieldset className="pet-choice-group chat-mode-group">
        <legend>대화 방식</legend>
        {modeOption('server', '햄이 서버', '무료 · 하루·한 달 횟수 제한')}
        {modeOption('byok', '내 API 키', '횟수 제한 없음 · 요금은 내 계정')}
      </fieldset>

      {settings.mode === 'server' && active && <HamiUsagePanel />}

      {settings.mode === 'byok' && (
        <div className="byok-panel">
          {status && !status.encryptionAvailable && (
            <p className="usage-paused">이 컴퓨터에서는 키를 안전하게 암호화할 수 없어서 내 키 방식을 쓸 수 없어.</p>
          )}
          <label>
            제공사
            <select
              value={provider}
              onChange={(event) => {
                setKeyInput('')
                void update({ provider: event.target.value as ByokProvider })
              }}
            >
              {BYOK_PROVIDERS.map((id) => (
                <option key={id} value={id}>{BYOK_PROVIDER_INFO[id].label}</option>
              ))}
            </select>
          </label>
          <label>
            모델
            <select
              value={settings.models[provider]}
              onChange={(event) =>
                void update({ models: { ...settings.models, [provider]: event.target.value } })
              }
            >
              {info.models.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
            <small>{info.models.find((model) => model.id === settings.models[provider])?.hint}</small>
          </label>
          <label>
            API 키
            <input
              type="password"
              value={keyInput}
              autoComplete="off"
              spellCheck={false}
              placeholder={savedKey?.saved ? `저장됨 (…${savedKey.hint})` : `${info.label} API 키를 붙여넣어 줘`}
              onChange={(event) => {
                setKeyInput(event.target.value)
                setFeedback(null)
              }}
            />
          </label>
          <div className="api-key-actions">
            {savedKey?.saved && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void removeKey()}>
                키 삭제
              </button>
            )}
            <button
              type="button"
              disabled={busy || (!typedKey && !savedKey?.saved) || status?.encryptionAvailable === false}
              onClick={() => void checkKey()}
            >
              {typedKey ? '확인하고 저장' : '연결 확인'}
            </button>
          </div>
          {feedback && (
            <p className={`byok-feedback is-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
              {feedback.text}
            </p>
          )}
          {!savedKey?.saved && !feedback && (
            <p className="byok-feedback is-info">키를 저장하기 전까지는 대화할 수 없어. 키가 맞는지 확인한 뒤에만 저장돼.</p>
          )}
          <div className="byok-links">
            <button type="button" className="link" onClick={() => void window.desktopPetAPI.openByokPage(provider, 'key')}>
              {info.label} 키 발급 페이지 열기
            </button>
            <button type="button" className="link" onClick={() => void window.desktopPetAPI.openByokPage(provider, 'usage')}>
              내 사용량·요금 보기
            </button>
          </div>
          <p className="usage-note">키는 이 컴퓨터의 Windows 계정으로 암호화해서 저장하고, 햄이 서버로는 보내지 않아.</p>
        </div>
      )}

      <div className="usage-privacy">
        {settings.mode === 'server' ? (
          <p>대화창에 입력한 수다와 최근 대화 일부만 햄이 서버를 거쳐 외부 AI로 전송돼.</p>
        ) : (
          <>
            <p>대화창에 입력한 수다와 최근 대화 일부가 {info.label}로 바로 전송되고, 그 회사의 약관을 따라.</p>
            {provider === 'gemini' && (
              <p className="byok-warning">
                ⚠️ 결제를 연결하지 않은 무료 등급에서는 입력한 내용이 Google의 AI 학습에 쓰이고, 사람이 읽을 수도 있어. 비밀번호나 건강 정보 같은 민감한 내용은 보내지 마. 결제를 연결한 키는 학습에 쓰이지 않아.
              </p>
            )}
          </>
        )}
        <p>하루 계획은 [햄이에게 보여주기]를 누를 때만 그 내용이 전송돼.</p>
        <p>일정·할 일·일기·뽀모도로 기록과 일정 관련 말은 이 컴퓨터에서만 처리돼.</p>
      </div>
    </>
  )
}

export default ChatModeSettings
