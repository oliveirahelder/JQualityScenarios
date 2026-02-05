import { prisma } from '@/lib/prisma'

type BackupScope = 'admin' | 'user'

export async function backupAdminSettings(payload: Record<string, unknown>) {
  return prisma.settingsBackup.create({
    data: {
      scope: 'admin',
      payload: JSON.stringify(payload),
    },
  })
}

export async function backupUserSettings(
  userId: string,
  payload: Record<string, unknown>
) {
  return prisma.settingsBackup.create({
    data: {
      scope: 'user',
      userId,
      payload: JSON.stringify(payload),
    },
  })
}
