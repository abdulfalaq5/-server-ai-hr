import axios from 'axios';
import { qdrantClient, COLLECTION_NAME } from './db.js';
import { getEmbedding } from './embedding.js';
import { config } from '../config/index.js';
import { ChatMessage } from '../types/index.js';

/**
 * Runs the Retrieval-Augmented Generation pipeline.
 * Performs similarity search in Qdrant and instructs LLM to formulate an answer with citations.
 */
export async function queryHR(
  userQuery: string,
  history: ChatMessage[] = []
): Promise<string> {
  let contextText = '';
  
  try {
    // 1. Generate query embedding
    const queryVector = await getEmbedding(userQuery);

    // 2. Query Qdrant for top-K matches (K=5)
    const searchResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
    });

    // 3. Format contexts with metadata
    if (searchResults.length > 0) {
      contextText = searchResults.map((result, idx) => {
        const payload = result.payload as any;
        const docName = payload?.document_name || 'Tidak diketahui';
        const pageInfo = payload?.page ? `Halaman: ${payload.page}` : `Chunk: ${payload?.chunk_index ?? idx}`;
        const text = payload?.text || '';
        return `[Dokumen: ${docName} | ${pageInfo}]\n${text}`;
      }).join('\n\n---\n\n');
    } else {
      contextText = 'Tidak ada dokumen pendukung ditemukan di knowledge base.';
    }

  } catch (err: any) {
    console.error(`[RAG Pipeline] Retrieval error, falling back to empty context:`, err.message);
    contextText = 'Error retrieving document context.';
  }

  // 4. Build system instructions
  const systemPrompt = `You are a Human Resource Assistant.

You answer only using information found in the HR knowledge base.

Always cite the source document.

Never fabricate policies.

If the answer is not found in the HR documents, clearly state that the information is unavailable.

Do not answer infrastructure, database, server, networking, or DevOps questions.

Only answer HR-related questions.

Dokumen HR yang relevan untuk menjawab pertanyaan:
---
${contextText}
---

Instruksi Tambahan:
1. Jawablah pertanyaan user HANYA berdasarkan dokumen di atas.
2. Jika informasi tidak ditemukan di dokumen yang disediakan, Anda WAJIB menjawab persis: "Saya tidak menemukan informasi tersebut pada dokumen HR yang tersedia." Jangan mengarang jawaban atau menambahkan penjelasan lain yang tidak ada di dokumen.
3. Di akhir jawaban Anda, berikan referensi dari mana Anda mendapatkan informasi tersebut menggunakan format berikut:

Referensi:
Dokumen: <nama_file_dokumen>
Halaman: <nomor_halaman_atau_tanda_minus_jika_tidak_ada>
Pasal: <nomor_pasal_jika_ditemukan_dalam_teks_dokumen>
Ayat: <nomor_ayat_jika_ditemukan_dalam_teks_dokumen>
Chunk: <nomor_chunk_atau_tanda_minus_jika_tidak_ada>
Section: <nama_section_atau_tanda_minus_jika_tidak_ada>

Jawablah dengan sopan, formal, dan menggunakan Bahasa Indonesia.`;

  // 5. Build Chat Messages array
  // Filter history to last 10 messages to avoid token bloating
  const recentHistory = history.slice(-10);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    { role: 'user', content: userQuery }
  ];

  // 6. Call LLM
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const url = `${config.openaiBaseUrl}/chat/completions`;

  try {
    const response = await axios.post(
      url,
      {
        model: config.openaiModel,
        messages: messages,
        temperature: 0.1, // Low temperature for maximum factual reliability
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const answer = response.data?.choices?.[0]?.message?.content || '';
    if (!answer) {
      throw new Error(`Empty response from LLM API: ${JSON.stringify(response.data)}`);
    }

    return answer;
  } catch (error: any) {
    const detail = error.response?.data?.error?.message || error.response?.data || error.message;
    console.error(`[RAG Pipeline] LLM Completion error:`, detail);
    throw new Error(`Failed to query HR Assistant: ${detail}`);
  }
}
