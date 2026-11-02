// 일기 탭을 없애면서 기존 일기를 같은 날짜의 하루 노트 뒤로 옮깁니다. diary.json은 백업으로 그대로 둡니다.
import { copyFileSync, existsSync } from 'node:fs'
import { diaryStore, dailyPlanStore, settingsStore } from '../stores'

export const mergeDiaryText = (noteText: string, diaryText: string): string => {
  const note = noteText.trimEnd()
  const diary = diaryText.trim()
  if (!note) return diary
  // Already there, for example after a merge that stopped halfway and is running again.
  if (note.includes(diary)) return note
  return `${note}\n\n--- 일기 ---\n${diary}`
}

export const mergeDiaryIntoNotes = (): void => {
  if (settingsStore.get('diaryMergedIntoNotes')) return
  try {
    const entries = Object.entries(diaryStore.store).filter(
      ([key, entry]) => key.startsWith('diary:') && entry.text?.trim()
    )
    if (entries.length > 0 && existsSync(dailyPlanStore.path)) {
      const backup = `${dailyPlanStore.path}.before-diary-merge`
      if (!existsSync(backup)) copyFileSync(dailyPlanStore.path, backup)
    }
    for (const [key, entry] of entries) {
      const date = key.slice('diary:'.length)
      const planKey = `plan:${date}`
      const plan = dailyPlanStore.get(planKey)
      dailyPlanStore.set(planKey, {
        ...plan,
        date,
        text: mergeDiaryText(plan?.text ?? '', entry.text),
        updatedAt: plan?.updatedAt ?? entry.updatedAt
      })
    }
    settingsStore.set('diaryMergedIntoNotes', true)
  } catch (error) {
    // The flag stays unset, so the next launch tries again. Note text never goes in the log.
    console.warn('[notes] diary merge failed', error instanceof Error ? error.name : 'unknown')
  }
}
