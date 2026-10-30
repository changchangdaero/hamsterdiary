import type { Holiday } from '../../shared/types/holiday'
import { EMBEDDED_HOLIDAYS } from './embeddedHolidays'

export const listHolidays = async (years: number[]): Promise<Holiday[]> => {
  const uniqueYears = [...new Set(years)]
  if (
    uniqueYears.length < 1 ||
    uniqueYears.length > 3 ||
    uniqueYears.some((year) => !Number.isInteger(year))
  ) {
    throw new Error('조회할 공휴일 연도 목록이 올바르지 않습니다.')
  }

  const requestedYears = new Set(uniqueYears)
  return EMBEDDED_HOLIDAYS.filter((holiday) =>
    requestedYears.has(Number(holiday.date.slice(0, 4)))
  )
}
