// 저장된 펫 위치를 화면 작업 영역에 맞게 검증하고 기본 위치를 계산하는 파일입니다.
import { screen, type Display, type Rectangle } from 'electron'
import type { PetPosition } from '../../shared/types/stores'

export const PET_WINDOW_SIZE = { width: 360, height: 420 } as const
export const PET_WINDOW_LAYOUT_VERSION = 2
const PREVIOUS_PET_WINDOW_SIZE = { width: 220, height: 260 } as const
const PET_WINDOW_MARGIN = 20
const MINIMUM_VISIBLE_AREA_RATIO = 0.25

const getIntersectionArea = (first: Rectangle, second: Rectangle): number => {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x)
  )
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y)
  )

  return width * height
}

const isFinitePosition = (position: PetPosition | null): position is PetPosition =>
  position !== null &&
  Number.isFinite(position.x) &&
  Number.isFinite(position.y)

export const getDefaultPetPosition = (): PetPosition => {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea

  return {
    x: Math.round(x + width - PET_WINDOW_SIZE.width - PET_WINDOW_MARGIN),
    y: Math.round(y + height - PET_WINDOW_SIZE.height - PET_WINDOW_MARGIN)
  }
}

export const isPetPositionVisible = (
  position: PetPosition | null,
  displays: Display[] = screen.getAllDisplays()
): position is PetPosition => {
  if (!isFinitePosition(position)) {
    return false
  }

  const petBounds: Rectangle = {
    x: position.x,
    y: position.y,
    ...PET_WINDOW_SIZE
  }
  const minimumArea =
    PET_WINDOW_SIZE.width * PET_WINDOW_SIZE.height * MINIMUM_VISIBLE_AREA_RATIO

  return displays.some(
    ({ workArea }) => getIntersectionArea(petBounds, workArea) >= minimumArea
  )
}

export const resolvePetPosition = (position: PetPosition | null): PetPosition =>
  isPetPositionVisible(position)
    ? { x: Math.round(position.x), y: Math.round(position.y) }
    : getDefaultPetPosition()

export const migratePetPosition = (
  position: PetPosition | null,
  layoutVersion: number
): PetPosition => {
  if (
    position === null ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    return resolvePetPosition(null)
  }

  if (layoutVersion >= PET_WINDOW_LAYOUT_VERSION) {
    return resolvePetPosition(position)
  }

  return resolvePetPosition({
    x:
      position.x -
      (PET_WINDOW_SIZE.width - PREVIOUS_PET_WINDOW_SIZE.width) / 2,
    y:
      position.y -
      (PET_WINDOW_SIZE.height - PREVIOUS_PET_WINDOW_SIZE.height)
  })
}
