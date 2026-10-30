const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Accepts only real calendar dates in local `YYYY-MM-DD` form.
export const parseDateKey = (value: unknown): string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new Error('날짜 형식이 올바르지 않습니다.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error('존재하지 않는 날짜입니다.')
  }
  return value
}
