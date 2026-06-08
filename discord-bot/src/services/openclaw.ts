import axios from 'axios';
import { config } from '../config.js';

/**
 * OpenClawService — relays Discord messages to the OpenClaw gateway.
 * OpenClaw in turn calls the HR Assistant RAG service and returns the answer.
 *
 * Protocol: OpenAI-compatible /v1/chat/completions via Bearer token auth.
 * Session isolation: x-openclaw-session-key header per Discord user ID.
 */
export class OpenClawService {
  private static getHeaders(sessionId: string) {
    return {
      'Authorization': `Bearer ${config.openclawToken}`,
      'Content-Type': 'application/json',
      'x-openclaw-session-key': `discord-${sessionId}`,
    };
  }

  /**
   * Send a chat message to OpenClaw and get the HR Assistant response.
   * Maintains per-user session context via session key header.
   */
  static async chat(
    sessionId: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<string> {
    const url = `${config.openclawApiUrl}/v1/chat/completions`;

    const messages = [
      ...history,
      { role: 'user' as const, content: userMessage },
    ];

    try {
      const response = await axios.post(
        url,
        {
          model: 'hr-assistant',
          messages,
        },
        {
          headers: this.getHeaders(sessionId),
          timeout: 60000, // RAG + LLM can take time
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content || '';
      if (!reply) {
        throw new Error('Empty response from OpenClaw');
      }
      return reply;
    } catch (error: any) {
      console.error('[OpenClaw] Chat Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }
}
