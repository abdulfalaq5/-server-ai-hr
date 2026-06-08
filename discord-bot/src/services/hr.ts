import axios from 'axios';

export class HRAssistantService {
  /**
   * Forwards the user message and history to the HR Assistant RAG microservice.
   */
  static async chat(
    sessionId: string,
    email: string,
    query: string,
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<string> {
    const url = 'http://hr-assistant:9004/query';

    try {
      const response = await axios.post(
        url,
        {
          query,
          history,
        },
        {
          timeout: 45000, // LLM completions can take a bit of time
        }
      );

      const answer = response.data?.answer || '';
      if (!answer) {
        throw new Error('Empty response from HR Assistant service.');
      }
      return answer;
    } catch (error: any) {
      console.error(`[HR Assistant Service] Request failed:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }
}
