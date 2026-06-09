export type AppProfile = 'user' | 'test'

export interface AppEnvironmentInfo {
  profile: AppProfile
  profileLabel: string
  javaPort: number
  userDataPath: string
  /** HanStudy 项目根目录 */
  workspaceRoot: string
  /** Agent 可感知根目录（项目根/workspace） */
  agentWorkspacePath: string
  /** 知识库目录（项目根/workspace/library） */
  localLibraryPath: string
  /** 未自定义时的默认项目根 */
  defaultWorkspaceRoot: string
  workspaceRootIsCustom: boolean
}

export const APP_PROFILE_LABELS: Record<AppProfile, string> = {
  user: '用户环境',
  test: '测试环境'
}

export const USER_JAVA_PORT = 17890
export const TEST_JAVA_PORT = 17891
