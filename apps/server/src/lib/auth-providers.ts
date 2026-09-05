export interface EnvVarInfo {
  name: string;
  source: string;
  defaultValue?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  requiredEnvVars: string[];
  envVarInfo?: EnvVarInfo[];
  config: unknown;
  required?: boolean;
  isCustom?: boolean;
  customRedirectPath?: string;
}

export const customProviders: ProviderConfig[] = [
  // {
  //   id: "zero",
  //   name: "Zero",
  //   requiredEnvVars: [],
  //   config: {},
  //   isCustom: true,
  //   customRedirectPath: "/zero/signup"
  // }
];

export const authProviders = (env: Record<string, string>): ProviderConfig[] => [
  {
    id: 'google',
    name: 'Google',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    envVarInfo: [
      { name: 'GOOGLE_CLIENT_ID', source: 'Google Cloud Console' },
      { name: 'GOOGLE_CLIENT_SECRET', source: 'Google Cloud Console' },
    ],
    config: {
      accessType: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    required: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    requiredEnvVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    envVarInfo: [
      { name: 'MICROSOFT_CLIENT_ID', source: 'Microsoft Azure App ID' },
      { name: 'MICROSOFT_CLIENT_SECRET', source: 'Microsoft Azure App Password' },
    ],
    config: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      redirectUri: env.MICROSOFT_REDIRECT_URI,
      scope: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/Mail.ReadWrite',
        'https://graph.microsoft.com/Mail.Send',
        'offline_access',
      ],
      authority: 'https://login.microsoftonline.com/common',
      responseType: 'code',
      prompt: 'consent',
      loginHint: 'email',
      disableProfilePhoto: true,
    },
    required: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    requiredEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    envVarInfo: [
      { name: 'GITHUB_CLIENT_ID', source: 'GitHub OAuth App' },
      { name: 'GITHUB_CLIENT_SECRET', source: 'GitHub OAuth App' },
    ],
    config: {
      clientId: env['GITHUB_CLIENT_ID'],
      clientSecret: env['GITHUB_CLIENT_SECRET'],
      scope: ['read:user', 'user:email'],
    },
    // 仅作登录身份,不是邮箱源(driver 层无 github);不设 required——
    // 缺 env 时跳过即可,不像 google/microsoft 缺了要启动 throw。
    // 注:这里用下标访问是因为 tsconfig 开了 noPropertyAccessFromIndexSignature,
    // 上面的 google/microsoft 条目是历史遗留(同样报错,不在本模块范围修)。
    required: false,
  },
  // {
  //   id: 'icloud',
  //   name: 'Apple',
  //   requiredEnvVars: ['ICLOUD_CLIENT_ID', 'ICLOUD_CLIENT_SECRET'],
  //   envVarInfo: [
  //     { name: 'ICLOUD_CLIENT_ID', source: 'iCloud App ID' },
  //     { name: 'ICLOUD_CLIENT_SECRET', source: 'iCloud App Password' },
  //   ],
  //   config: {
  //     clientId: env.ICLOUD_CLIENT_ID,
  //     clientSecret: env.ICLOUD_CLIENT_SECRET,
  //     redirectUri: env.ICLOUD_REDIRECT_URI,
  //     scope: [
  //       'https://graph.icloud.com/User.Read',
  //       'https://graph.icloud.com/Mail.ReadWrite',
  //       'https://graph.icloud.com/Mail.Send',
  //       'offline_access',
  //     ],
  //     authority: 'https://login.icloud.com/common',
  //     responseType: 'code',
  //     prompt: 'consent',
  //     loginHint: 'email',
  //     disableProfilePhoto: true,
  //   },
  //   required: true,
  // },
];

export function isProviderEnabled(provider: ProviderConfig, env: Record<string, string>): boolean {
  if (provider.isCustom) return true;

  const hasEnvVars = provider.requiredEnvVars.every((envVar) => !!env[envVar]);

  if (provider.required && !hasEnvVars) {
    console.error(`Required provider "${provider.id}" is not configured properly.`);
    console.error(
      `Missing environment variables: ${provider.requiredEnvVars.filter((envVar) => !env[envVar]).join(', ')}`,
    );
  }

  return hasEnvVars;
}

export function getSocialProviders(env: Record<string, string>) {
  const socialProviders = Object.fromEntries(
    authProviders(env)
      .map((provider) => {
        if (isProviderEnabled(provider, env)) {
          return [provider.id, provider.config] as [string, unknown];
        } else if (provider.required) {
          throw new Error(
            `Required provider "${provider.id}" is not configured properly. Check your environment variables.`,
          );
        } else {
          console.warn(`Provider "${provider.id}" is not configured properly. Skipping.`);
          return null;
        }
      })
      .filter((provider) => provider !== null),
  );
  return socialProviders;
}
