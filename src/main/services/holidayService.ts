import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { Holiday } from '../../shared/types/holiday'
import { holidaysStore } from '../stores'

const HOLIDAY_ENDPOINT =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'
const REQUEST_TIMEOUT_MS = 10_000
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const readEnvFile = (path: string): Record<string, string> => {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .flatMap((line) => {
          const separator = line.indexOf('=')
          if (separator < 1) return []
          const key = line.slice(0, separator).trim()
          let value = line.slice(separator + 1).trim()
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }
          return [[key, value]]
        })
    )
  } catch {
    return {}
  }
}

const getApiKey = (): string => {
  const processKey = process.env.HOLIDAY_API_KEY?.trim()
  if (processKey) return processKey

  const candidates = [
    join(process.cwd(), '.env'),
    join(app.getAppPath(), '.env'),
    join(dirname(process.execPath), '.env')
  ]
  for (const path of new Set(candidates)) {
    const key = readEnvFile(path).HOLIDAY_API_KEY?.trim()
    if (key) return key
  }
  throw new Error('HOLIDAY_API_KEY가 설정되지 않았습니다.')
}

const normalizeApiKey = (key: string): string => {
  try {
    return key.includes('%') ? decodeURIComponent(key) : key
  } catch {
    return key
  }
}

const decodeXml = (value: string): string =>
  value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&')

const tagValue = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'u'))
  return match ? decodeXml(match[1].trim()) : null
}

const parseHolidayXml = (xml: string): Holiday[] => {
  const gatewayErrorCode = tagValue(xml, 'returnReasonCode')
  if (gatewayErrorCode && gatewayErrorCode !== '00') {
    throw new Error(
      `공공데이터포털 인증 오류 ${gatewayErrorCode}: ${
        tagValue(xml, 'returnAuthMsg') ?? '알 수 없는 오류'
      }`
    )
  }
  const resultCode = tagValue(xml, 'resultCode')
  if (resultCode && resultCode !== '00') {
    throw new Error(
      `특일정보 API 오류 ${resultCode}: ${tagValue(xml, 'resultMsg') ?? '알 수 없는 오류'}`
    )
  }

  if (!xml.includes('<response>') && !xml.includes('<response ')) {
    throw new Error('특일정보 API 응답 형식이 올바르지 않습니다.')
  }

  const items: Holiday[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)) {
    const item = match[1]
    const rawDate = tagValue(item, 'locdate')
    const name = tagValue(item, 'dateName')
    if (!rawDate || !name || tagValue(item, 'isHoliday') !== 'Y') continue
    if (!/^\d{8}$/u.test(rawDate)) continue
    items.push({
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      name
    })
  }
  return items
}

const fetchHolidayYear = async (year: number): Promise<Holiday[]> => {
  const url = new URL(HOLIDAY_ENDPOINT)
  url.searchParams.set('serviceKey', normalizeApiKey(getApiKey()))
  url.searchParams.set('solYear', String(year))
  url.searchParams.set('numOfRows', '100')
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`특일정보 API HTTP ${response.status}`)
  }
  return parseHolidayXml(body)
}

const isFresh = (fetchedAt: string): boolean => {
  const timestamp = Date.parse(fetchedAt)
  return Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_MAX_AGE_MS
}

const getHolidayYear = async (year: number): Promise<Holiday[]> => {
  const key = String(year)
  const cached = holidaysStore.get('years')[key]
  if (cached && isFresh(cached.fetchedAt)) {
    console.log('[holiday] cache hit', { year, count: cached.items.length })
    return cached.items
  }

  try {
    const items = await fetchHolidayYear(year)
    holidaysStore.set(`years.${key}`, {
      fetchedAt: new Date().toISOString(),
      items
    })
    console.log('[holiday] API fetch success', { year, count: items.length })
    return items
  } catch (error) {
    if (cached) {
      console.warn('[holiday] API failed; using stale cache', { year, error })
      return cached.items
    }
    throw error
  }
}

export const listHolidays = async (years: number[]): Promise<Holiday[]> => {
  const uniqueYears = [...new Set(years)]
  const currentYear = new Date().getFullYear()
  if (
    uniqueYears.length < 1 ||
    uniqueYears.length > 3 ||
    uniqueYears.some(
      (year) =>
        !Number.isInteger(year) || year < currentYear - 10 || year > currentYear + 10
    )
  ) {
    throw new Error('조회할 공휴일 연도가 올바르지 않습니다.')
  }
  return (await Promise.all(uniqueYears.map(getHolidayYear)))
    .flat()
    .sort((left, right) => left.date.localeCompare(right.date))
}
