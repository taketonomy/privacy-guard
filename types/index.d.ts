export type Hit = {
  kind: 'name' | 'token'
  file: string
  line: number
  match: string
}

export type Check = {
  command: string
  hits: Hit[]
  isBlocked: boolean
  // The person chose to let these hits through.
  isAllowed?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'privacy-guard': { last: Check | null; checked: number; blocked: number; isHidden: boolean }
  }
}
