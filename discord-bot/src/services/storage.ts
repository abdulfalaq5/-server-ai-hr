import fs from 'fs';
import path from 'path';
import { UserEmailMap, ConversationSession } from '../types/index.js';

const STORAGE_DIR = '/app/storage';
const DISCORD_DIR = path.join(STORAGE_DIR, 'discord');

const PATHS = {
  users: path.join(DISCORD_DIR, 'users.json'),
  conversations: path.join(DISCORD_DIR, 'conversations.json'),
};

// Ensure directories exist
function initStorage() {
  if (!fs.existsSync(DISCORD_DIR)) {
    fs.mkdirSync(DISCORD_DIR, { recursive: true });
  }
}

initStorage();

export class StorageService {
  // --- Users ---
  static getUsers(): UserEmailMap[] {
    try {
      if (fs.existsSync(PATHS.users)) {
        const data = fs.readFileSync(PATHS.users, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('[Storage] Error reading users.json:', err);
    }
    return [];
  }

  static saveUsers(users: UserEmailMap[]) {
    try {
      fs.writeFileSync(PATHS.users, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Error writing users.json:', err);
    }
  }

  static getUserEmail(discordId: string): string | undefined {
    const users = this.getUsers();
    return users.find(u => u.discordId === discordId)?.email;
  }

  static setUserEmail(discordId: string, email: string, username: string) {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.discordId === discordId);
    const newEntry: UserEmailMap = {
      discordId,
      email,
      username,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex > -1) {
      users[existingIndex] = newEntry;
    } else {
      users.push(newEntry);
    }
    this.saveUsers(users);
  }

  // --- Conversations ---
  static getConversations(): ConversationSession[] {
    try {
      if (fs.existsSync(PATHS.conversations)) {
        const data = fs.readFileSync(PATHS.conversations, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('[Storage] Error reading conversations.json:', err);
    }
    return [];
  }

  static saveConversations(sessions: ConversationSession[]) {
    try {
      fs.writeFileSync(PATHS.conversations, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Error writing conversations.json:', err);
    }
  }

  static getConversation(discordId: string, mode: 'monitoring' | 'hr' = 'hr'): ConversationSession {
    const sessions = this.getConversations();
    const sessionId = `${discordId}-${mode}`;
    let session = sessions.find(s => s.discordId === sessionId);
    if (!session) {
      session = {
        discordId: sessionId,
        messages: [],
        lastActive: new Date().toISOString(),
      };
    }
    return session;
  }

  static saveConversation(session: ConversationSession, mode: 'monitoring' | 'hr' = 'hr') {
    const sessions = this.getConversations();
    const sessionId = session.discordId.endsWith(`-${mode}`) ? session.discordId : `${session.discordId}-${mode}`;
    session.discordId = sessionId;
    const existingIndex = sessions.findIndex(s => s.discordId === sessionId);
    session.lastActive = new Date().toISOString();

    if (existingIndex > -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    this.saveConversations(sessions);
  }

  static clearConversation(discordId: string, mode?: 'monitoring' | 'hr') {
    let sessions = this.getConversations();
    if (mode) {
      const sessionId = `${discordId}-${mode}`;
      sessions = sessions.filter(s => s.discordId !== sessionId);
    } else {
      sessions = sessions.filter(
        s => s.discordId !== `${discordId}-monitoring` && 
             s.discordId !== `${discordId}-hr` && 
             s.discordId !== discordId
      );
    }
    this.saveConversations(sessions);
  }
}
