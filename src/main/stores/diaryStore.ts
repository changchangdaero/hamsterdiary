import Store from 'electron-store'
import type { DiaryEntry } from '../../shared/types/diary'

// Each entry is a top-level `diary:YYYY-MM-DD` key in its own store file.
export const diaryStore = new Store<Record<string, DiaryEntry>>({
  name: 'diary'
})
