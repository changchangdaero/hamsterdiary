// 긴 말을 말풍선 한 장에 들어가는 길이로, 문장 단위로 나눠 넘겨 보게 하는 함수입니다.

// About three lines of the 300px speech bubble.
export const SPEECH_PAGE_MAX_CHARS = 64

// A sentence runs to its closing punctuation (or a line break) plus trailing spaces.
const SENTENCE = /[^.!?~…\n]+(?:[.!?~…]+|\n|$)\s*/gu

const splitLongSentence = (sentence: string, maxChars: number): string[] => {
  const pieces: string[] = []
  let rest = sentence
  while (rest.length > maxChars) {
    const space = rest.lastIndexOf(' ', maxChars)
    const cut = space > maxChars / 2 ? space : maxChars
    pieces.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) pieces.push(rest)
  return pieces
}

export const splitSpeechPages = (text: string, maxChars = SPEECH_PAGE_MAX_CHARS): string[] => {
  const normalized = text.replace(/\s*\n+\s*/g, '\n').trim()
  if (normalized.length <= maxChars) return normalized ? [normalized] : []

  const sentences = (normalized.match(SENTENCE) ?? [normalized])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((sentence) => splitLongSentence(sentence, maxChars))

  // Greedily pack whole sentences into each page.
  const pages: string[] = []
  for (const sentence of sentences) {
    const last = pages[pages.length - 1]
    if (last !== undefined && last.length + 1 + sentence.length <= maxChars) {
      pages[pages.length - 1] = `${last} ${sentence}`
    } else {
      pages.push(sentence)
    }
  }
  return pages
}
