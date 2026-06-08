// =============================================================================
// TS Types - Discord Bot
// =============================================================================

export interface BotConfig {
  nodeEnv: string;
  discordToken: string;
  alertChannelId: string;
  adminUsers: string[];
  emailWhitelist: string[];
}

export interface UserEmailMap {
  discordId: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface ConversationSession {
  discordId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  lastActive: string;
}
