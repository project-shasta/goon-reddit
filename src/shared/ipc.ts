export const IPC = {
  // Auth
  authStatus: 'auth:status',
  authOpenLogin: 'auth:openLogin',
  authLogout: 'auth:logout',
  authState: 'auth:state',

  // Subreddit/User validation
  subredditValidate: 'subreddit:validate',
  userValidate: 'user:validate',

  // Job
  jobStart: 'job:start',
  jobCancel: 'job:cancel',
  jobState: 'job:state',
  jobMedia: 'job:media',
  jobMediaUpdate: 'job:mediaUpdate',
  jobLog: 'job:log',

  // Settings
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChooseDestination: 'settings:chooseDestination',
  settingsResetToDefaults: 'settings:resetToDefaults',

  // History
  historyTotal: 'history:total',
  historyClear: 'history:clear',

  // Cache
  cacheClear: 'cache:clear',

  // Tools
  toolsStatus: 'tools:status',
  toolsUpdateYtdlp: 'tools:updateYtdlp',
  toolsMissing: 'tools:missing',

  // Shell
  shellOpenExternal: 'shell:openExternal',
  shellRevealFile: 'shell:revealFile',
  shellOpenFolder: 'shell:openFolder',
  shellBeep: 'shell:beep',

  // Notifications
  notificationShow: 'notification:show'
} as const
