// 펫 상태별 PNG URL과 화면에 표시할 시각 프레임 타입을 관리하는 파일입니다.
import blinkImage from './assets/pet/pixel/blink.png'
import dance1Image from './assets/pet/pixel/dance1.png'
import dance2Image from './assets/pet/pixel/dance2.png'
import dance4Image from './assets/pet/pixel/dance4.png'
import happyImage from './assets/pet/pixel/happy.png'
import idleImage from './assets/pet/pixel/idle.png'
import questionImage from './assets/pet/pixel/question.png'
import sadImage from './assets/pet/pixel/sad.png'
import sleep0Image from './assets/pet/pixel/sleep0.png'
import sleep1Image from './assets/pet/pixel/sleep1.png'
import sleep2Image from './assets/pet/pixel/sleep2.png'
import sleep3Image from './assets/pet/pixel/sleep3.png'
import talkingImage from './assets/pet/pixel/talk.png'
import thumbsUpImage from './assets/pet/pixel/thumbsup.png'

export type PetVisualFrame =
  | 'idle'
  | 'blink'
  | 'talking'
  | 'question'
  | 'sad'
  | 'sleep0'
  | 'sleep1'
  | 'sleep2'
  | 'sleep3'
  | 'thumbs-up'
  | 'happy'
  | 'dance1'
  | 'dance2'
  | 'dance4'

export const PET_FRAME_IMAGES: Record<PetVisualFrame, string> = {
  idle: idleImage,
  blink: blinkImage,
  talking: talkingImage,
  question: questionImage,
  sad: sadImage,
  sleep0: sleep0Image,
  sleep1: sleep1Image,
  sleep2: sleep2Image,
  sleep3: sleep3Image,
  'thumbs-up': thumbsUpImage,
  happy: happyImage,
  dance1: dance1Image,
  dance2: dance2Image,
  dance4: dance4Image
}

export const preloadPetImages = (): void => {
  Object.values(PET_FRAME_IMAGES).forEach((source) => {
    const image = new Image()
    image.src = source
  })
}
