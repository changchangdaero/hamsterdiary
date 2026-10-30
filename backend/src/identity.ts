import { createHmac } from 'node:crypto'

export const hashInstallationId = (installationId: string, secret: string): string =>
  createHmac('sha256', secret).update(installationId).digest('hex')
