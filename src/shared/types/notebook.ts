// 할 일·일기·계획을 탭으로 전환하는 노트 창의 화면 요청 타입입니다.
export const NOTEBOOK_VIEWS = ['todos', 'diary', 'plan'] as const

export type NotebookView = (typeof NOTEBOOK_VIEWS)[number]

export interface NotebookViewRequest {
  view: NotebookView
  date?: string
}
