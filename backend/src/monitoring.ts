import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import type { AppConfig } from './config.js'

const client = new CloudWatchClient({})

export const publishEstimatedAiCost = async (
  estimatedCostMicroUsd: number,
  config: AppConfig
): Promise<void> => {
  const estimatedCostKrw = (estimatedCostMicroUsd / 1_000_000) * config.usdKrwRate
  await client.send(
    new PutMetricDataCommand({
      Namespace: 'Hami/AI',
      MetricData: [
        {
          MetricName: 'EstimatedMonthlyCostKrw',
          Unit: 'None',
          Value: estimatedCostKrw
        }
      ]
    })
  )
}
