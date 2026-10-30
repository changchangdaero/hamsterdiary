import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const client = new SSMClient({})
const cache = new Map<string, string>()

export const getSecret = async (name: string): Promise<string> => {
  const cached = cache.get(name)
  if (cached) return cached
  const response = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  )
  const value = response.Parameter?.Value?.trim()
  if (!value) throw new Error(`SSM 파라미터 ${name}에 값이 없습니다.`)
  cache.set(name, value)
  return value
}
