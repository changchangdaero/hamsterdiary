import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { estimateCostMicroUsd } from './cost.js'
import { loadConfig } from './config.js'
import { requestAiReply } from './ai-client.js'
import { hashInstallationId } from './identity.js'
import { publishEstimatedAiCost } from './monitoring.js'
import { getSecret } from './secrets.js'
import {
  cancelReservation,
  recordUsage,
  releaseLock,
  reserveUsage,
  UsageLimitError
} from './usage-store.js'
import { parseChatRequest } from './validation.js'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  },
  body: JSON.stringify(body)
})

const limitMessage = (reason: UsageLimitError['reason']): string => {
  if (reason === 'daily') return '오늘 나랑 나눌 수 있는 AI 대화를 모두 사용했어. 내일 다시 얘기하자! 🐹'
  if (reason === 'monthly') return '이번 달에 나랑 나눌 수 있는 AI 대화를 모두 사용했어. 다음 달에 다시 얘기하자! 🐹'
  if (reason === 'budget') return '이번 달에는 내가 잠깐 쉬어야 할 것 같아. 다음 달에 다시 얘기하자! 일정이나 할 일, 일기, 뽀모도로는 계속 사용할 수 있어. 🐹'
  return '아직 앞에서 한 말을 생각하고 있어. 잠깐 뒤에 다시 말해줘! 🐹'
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  if (event.requestContext.http.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })
  const config = loadConfig()
  let reservation: Awaited<ReturnType<typeof reserveUsage>> | null = null
  let usageRecorded = false
  try {
    const raw = event.body
      ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body)
      : null
    const request = parseChatRequest(raw, config.maxMessageLength, config.maxHistoryItems)
    const [hashSecret, apiKey] = await Promise.all([
      getSecret(config.hashSecretParameterName),
      getSecret(config.aiApiKeyParameterName)
    ])
    const installationHash = hashInstallationId(request.installationId, hashSecret)
    const now = new Date()
    reservation = await reserveUsage(installationHash, now, config)
    const result = await requestAiReply(apiKey, request.message, request.history, config)
    const costMicroUsd = estimateCostMicroUsd(result.usage, config)
    const estimatedMonthlyCostMicroUsd = await recordUsage(
      installationHash,
      now,
      result.usage.inputTokens,
      result.usage.outputTokens,
      costMicroUsd,
      config
    )
    usageRecorded = true
    await publishEstimatedAiCost(estimatedMonthlyCostMicroUsd, config).catch((error) => {
      console.warn('cost metric publish failed', {
        requestId: context.awsRequestId,
        errorType: error instanceof Error ? error.name : 'UnknownError'
      })
    })
    return json(200, {
      reply: result.reply,
      remainingDailyUsage: Math.max(0, config.dailyRequestLimit - reservation.dailyCount),
      remainingMonthlyUsage: Math.max(0, config.monthlyRequestLimit - reservation.monthlyCount)
    })
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return json(429, { error: error.reason.toUpperCase(), reply: limitMessage(error.reason) })
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.message.includes('요청'))) {
      return json(400, { error: 'INVALID_REQUEST', reply: '한 번에 듣기에는 이야기가 조금 길거나 형식이 달라. 조금만 짧게 다시 말해줄래? 🐹' })
    }
    console.error('chat request failed', {
      requestId: context.awsRequestId,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    })
    return json(503, { error: 'SERVICE_UNAVAILABLE', reply: '지금은 대답하기가 조금 어려워. 잠시 후에 다시 말 걸어줘! 🐹' })
  } finally {
    if (reservation) {
      if (!usageRecorded) {
        await cancelReservation(reservation, config).catch(() => undefined)
      }
      await releaseLock(reservation.lockKey, config).catch(() => undefined)
    }
  }
}
