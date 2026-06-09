export type AppProfile = 'user' | 'test'

export interface AppEnvironmentInfo {
  profile: AppProfile
  profileLabel: string
  javaPort: number
  userDataPath: string
  localLibraryPath: string
}

export const APP_PROFILE_LABELS: Record<AppProfile, string> = {
  user: '用户环境',
  test: '测试环境'
}

export const USER_JAVA_PORT = 17890
export const TEST_JAVA_PORT = 17891
