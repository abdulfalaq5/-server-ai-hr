/**
 * Splits document text into overlapping chunks of a maximum size, 
 * attempting to preserve paragraph integrity.
 */
export function chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if ((currentChunk + '\n' + trimmed).length <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If the paragraph itself is larger than chunkSize, we split it by sliding window
      if (trimmed.length > chunkSize) {
        let start = 0;
        while (start < trimmed.length) {
          chunks.push(trimmed.slice(start, start + chunkSize));
          start += chunkSize - chunkOverlap;
        }
        currentChunk = '';
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
