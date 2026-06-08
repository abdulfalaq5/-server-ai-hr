export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ParsedPage {
  pageNumber: number | null;
  text: string;
}

export interface ChunkMetadata {
  document_name: string;
  page: number | null;
  chunk_index: number;
  text: string;
}
