// 날짜별 텍스트를 불러오고, 입력이 멈추면 자동 저장하는 훅입니다.
import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoSaveStatus =
  | 'loading'
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'load-error'
  | 'save-error'

interface Options {
  date: string
  load: (date: string) => Promise<string>
  save: (date: string, text: string) => Promise<void>
  delayMs?: number
}

interface AutoSavedText {
  text: string
  setText: (text: string) => void
  status: AutoSaveStatus
  flush: () => Promise<void>
}

export const useAutoSavedText = ({
  date,
  load,
  save,
  delayMs = 600
}: Options): AutoSavedText => {
  const [text, setTextState] = useState('')
  const [status, setStatus] = useState<AutoSaveStatus>('loading')
  const dateRef = useRef(date)
  const textRef = useRef('')
  const savedTextRef = useRef('')
  const loadedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // Saves whatever is unsaved for the date currently held in refs.
  const flush = useCallback(async (): Promise<void> => {
    clearTimer()
    if (!loadedRef.current) return
    const targetDate = dateRef.current
    const targetText = textRef.current
    if (targetText === savedTextRef.current) return
    if (dateRef.current === targetDate) setStatus('saving')
    try {
      await saveRef.current(targetDate, targetText)
      if (dateRef.current !== targetDate) return
      savedTextRef.current = targetText
      setStatus(textRef.current === targetText ? 'saved' : 'pending')
    } catch {
      if (dateRef.current === targetDate) setStatus('save-error')
    }
  }, [])

  useEffect(() => {
    let active = true
    dateRef.current = date
    loadedRef.current = false
    setStatus('loading')
    void load(date)
      .then((loadedText) => {
        if (!active) return
        textRef.current = loadedText
        savedTextRef.current = loadedText
        loadedRef.current = true
        setTextState(loadedText)
        setStatus('idle')
      })
      .catch(() => active && setStatus('load-error'))
    return () => {
      active = false
      // Leaving a date (or closing) must not drop what was typed for it.
      void flush()
    }
  }, [date, load, flush])

  useEffect(() => {
    const flushOnUnload = (): void => void flush()
    window.addEventListener('beforeunload', flushOnUnload)
    return () => window.removeEventListener('beforeunload', flushOnUnload)
  }, [flush])

  const setText = useCallback(
    (nextText: string): void => {
      if (!loadedRef.current) return
      textRef.current = nextText
      setTextState(nextText)
      setStatus('pending')
      clearTimer()
      timerRef.current = window.setTimeout(() => void flush(), delayMs)
    },
    [delayMs, flush]
  )

  return { text, setText, status, flush }
}

export const autoSaveStatusLabel = (status: AutoSaveStatus): string => {
  if (status === 'loading') return '불러오는 중…'
  if (status === 'pending' || status === 'saving') return '저장 중…'
  if (status === 'saved') return '저장했어!'
  if (status === 'load-error') return '불러오지 못했어.'
  if (status === 'save-error') return '저장하지 못했어. 계속 쓰면 다시 저장해볼게.'
  return '자동 저장'
}
