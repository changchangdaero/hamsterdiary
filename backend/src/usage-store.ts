import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'
import { budgetCutoffMicroUsd, type AppConfig } from './config.js'

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
})

export type LimitReason = 'daily' | 'monthly' | 'budget' | 'concurrent'

export class UsageLimitError extends Error {
  constructor(public readonly reason: LimitReason) {
    super(`사용 한도 초과: ${reason}`)
  }
}

interface Reservation {
  lockKey: string
  installationHash: string
  day: string
  dailyCount: number
  monthlyCount: number
  month: string
}

const periods = (now: Date): { day: string; month: string } => ({
  day: now.toISOString().slice(0, 10),
  month: now.toISOString().slice(0, 7)
})

const expiresAt = (now: Date): number => {
  const expiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1))
  return Math.floor(expiry.getTime() / 1_000)
}

const reasonFromTransactionError = (error: unknown): LimitReason => {
  const reasons =
    typeof error === 'object' && error !== null && 'CancellationReasons' in error
      ? (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons
      : undefined
  if (reasons?.[0]?.Code === 'ConditionalCheckFailed') return 'concurrent'
  if (reasons?.[1]?.Code === 'ConditionalCheckFailed') return 'daily'
  if (reasons?.[2]?.Code === 'ConditionalCheckFailed') return 'monthly'
  return 'budget'
}

export const reserveUsage = async (
  installationHash: string,
  now: Date,
  config: AppConfig
): Promise<Reservation> => {
  const { day, month } = periods(now)
  const ttl = expiresAt(now)
  const lockKey = `LOCK#${installationHash}`
  try {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: config.tableName,
              Item: {
                pk: lockKey,
                sk: 'ACTIVE',
                requestId: randomUUID(),
                expiresAt: Math.floor(now.getTime() / 1_000) + 90
              },
              ConditionExpression: 'attribute_not_exists(pk) OR expiresAt < :now',
              ExpressionAttributeValues: { ':now': Math.floor(now.getTime() / 1_000) }
            }
          },
          {
            Update: {
              TableName: config.tableName,
              Key: { pk: `INSTALL#${installationHash}`, sk: `DAY#${day}` },
              UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :one, expiresAt = :ttl',
              ConditionExpression: 'attribute_not_exists(requestCount) OR requestCount < :dailyLimit',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
                ':ttl': ttl,
                ':dailyLimit': config.dailyRequestLimit
              }
            }
          },
          {
            Update: {
              TableName: config.tableName,
              Key: { pk: `INSTALL#${installationHash}`, sk: `MONTH#${month}` },
              UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :one, expiresAt = :ttl',
              ConditionExpression: 'attribute_not_exists(requestCount) OR requestCount < :monthlyLimit',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
                ':ttl': ttl,
                ':monthlyLimit': config.monthlyRequestLimit
              }
            }
          },
          {
            Update: {
              TableName: config.tableName,
              Key: { pk: 'GLOBAL', sk: `MONTH#${month}` },
              UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :one, reservedCostMicroUsd = if_not_exists(reservedCostMicroUsd, :zero) + :reserved, expiresAt = :ttl',
              ConditionExpression: '(attribute_not_exists(estimatedCostMicroUsd) AND attribute_not_exists(reservedCostMicroUsd)) OR (attribute_not_exists(estimatedCostMicroUsd) AND reservedCostMicroUsd + :reserved <= :cutoff) OR (attribute_not_exists(reservedCostMicroUsd) AND estimatedCostMicroUsd + :reserved <= :cutoff) OR estimatedCostMicroUsd + reservedCostMicroUsd + :reserved <= :cutoff',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
                ':ttl': ttl,
                ':reserved': config.maxRequestCostMicroUsd,
                ':cutoff': budgetCutoffMicroUsd(config)
              }
            }
          }
        ]
      })
    )
    const counts = await documentClient.send(
      new BatchGetCommand({
        RequestItems: {
          [config.tableName]: {
            ConsistentRead: true,
            Keys: [
              { pk: `INSTALL#${installationHash}`, sk: `DAY#${day}` },
              { pk: `INSTALL#${installationHash}`, sk: `MONTH#${month}` }
            ],
            ProjectionExpression: 'sk, requestCount'
          }
        }
      })
    )
    const items = counts.Responses?.[config.tableName] ?? []
    const countFor = (prefix: string): number =>
      Number(items.find((item) => String(item.sk).startsWith(prefix))?.requestCount ?? 1)
    return {
      lockKey,
      installationHash,
      day,
      dailyCount: countFor('DAY#'),
      monthlyCount: countFor('MONTH#'),
      month
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TransactionCanceledException') {
      throw error
    }
    throw new UsageLimitError(reasonFromTransactionError(error))
  }
}

export const cancelReservation = async (
  reservation: Reservation,
  config: AppConfig
): Promise<void> => {
  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: config.tableName,
            Key: {
              pk: `INSTALL#${reservation.installationHash}`,
              sk: `DAY#${reservation.day}`
            },
            UpdateExpression: 'SET requestCount = requestCount - :one',
            ConditionExpression: 'requestCount >= :one',
            ExpressionAttributeValues: { ':one': 1 }
          }
        },
        {
          Update: {
            TableName: config.tableName,
            Key: {
              pk: `INSTALL#${reservation.installationHash}`,
              sk: `MONTH#${reservation.month}`
            },
            UpdateExpression: 'SET requestCount = requestCount - :one',
            ConditionExpression: 'requestCount >= :one',
            ExpressionAttributeValues: { ':one': 1 }
          }
        },
        {
          Update: {
            TableName: config.tableName,
            Key: { pk: 'GLOBAL', sk: `MONTH#${reservation.month}` },
            UpdateExpression: 'SET requestCount = requestCount - :one, reservedCostMicroUsd = reservedCostMicroUsd - :reserved',
            ConditionExpression: 'requestCount >= :one AND reservedCostMicroUsd >= :reserved',
            ExpressionAttributeValues: {
              ':one': 1,
              ':reserved': config.maxRequestCostMicroUsd
            }
          }
        }
      ]
    })
  )
}

export const recordUsage = async (
  installationHash: string,
  now: Date,
  inputTokens: number,
  outputTokens: number,
  costMicroUsd: number,
  config: AppConfig
): Promise<number> => {
  const { month } = periods(now)
  const values = {
    ':zero': 0,
    ':input': inputTokens,
    ':output': outputTokens,
    ':cost': costMicroUsd,
    ':reserved': config.maxRequestCostMicroUsd,
    ':updatedAt': now.toISOString()
  }
  await Promise.all([
    documentClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: `INSTALL#${installationHash}`, sk: `MONTH#${month}` },
        UpdateExpression: 'SET inputTokens = if_not_exists(inputTokens, :zero) + :input, outputTokens = if_not_exists(outputTokens, :zero) + :output, estimatedCostMicroUsd = if_not_exists(estimatedCostMicroUsd, :zero) + :cost, updatedAt = :updatedAt',
        ExpressionAttributeValues: values
      })
    ),
    documentClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: 'GLOBAL', sk: `MONTH#${month}` },
        UpdateExpression: 'SET inputTokens = if_not_exists(inputTokens, :zero) + :input, outputTokens = if_not_exists(outputTokens, :zero) + :output, estimatedCostMicroUsd = if_not_exists(estimatedCostMicroUsd, :zero) + :cost, reservedCostMicroUsd = if_not_exists(reservedCostMicroUsd, :zero) - :reserved, updatedAt = :updatedAt',
        ExpressionAttributeValues: values
      })
    )
  ])
  const global = await documentClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk: 'GLOBAL', sk: `MONTH#${month}` },
      ConsistentRead: true,
      ProjectionExpression: 'estimatedCostMicroUsd'
    })
  )
  return Number(global.Item?.estimatedCostMicroUsd ?? 0)
}

export const releaseLock = async (lockKey: string, config: AppConfig): Promise<void> => {
  await documentClient.send(
    new DeleteCommand({
      TableName: config.tableName,
      Key: { pk: lockKey, sk: 'ACTIVE' }
    })
  )
}
