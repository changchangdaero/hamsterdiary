// renderer에서 PNG 파일을 정적 자산 URL로 가져오기 위한 타입 선언입니다.
declare module '*.png' {
  const source: string
  export default source
}
