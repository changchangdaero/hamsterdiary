// 펫 상태별 PNG URL과 화면에 표시할 시각 프레임 타입을 관리하는 파일입니다.
import happyImage from './assets/pets/happy.png'
import idleImage from './assets/pets/idle.png'
import questionImage from './assets/pets/question.png'
import sadImage from './assets/pets/sad.png'
import sleepImage from './assets/pets/sleep.png'
import sleepZ1Image from './assets/pets/sleep-z1.png'
import sleepZ2Image from './assets/pets/sleep-z2.png'
import sleepZ3Image from './assets/pets/sleep-z3.png'
import talkingImage from './assets/pets/talking.png'
import thumbsUpImage from './assets/pets/thumbs-up.png'

export type PetVisualFrame =
  | 'idle'
  | 'blink'
  | 'talking'
  | 'question'
  | 'sad'
  | 'sleep'
  | 'sleep-z1'
  | 'sleep-z2'
  | 'sleep-z3'
  | 'thumbs-up'
  | 'happy'

export const PET_FRAME_IMAGES: Record<PetVisualFrame, string> = {
  idle: idleImage,
  blink: sleepImage,
  talking: talkingImage,
  question: questionImage,
  sad: sadImage,
  sleep: sleepImage,
  'sleep-z1': sleepZ1Image,
  'sleep-z2': sleepZ2Image,
  'sleep-z3': sleepZ3Image,
  'thumbs-up': thumbsUpImage,
  happy: happyImage
}

export const preloadPetImages = (): void => {
  Object.values(PET_FRAME_IMAGES).forEach((source) => {
    const image = new Image()
    image.src = source
  })
}
