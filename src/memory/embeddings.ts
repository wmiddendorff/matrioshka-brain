/**
 * Embeddings Module
 *
 * Generates text embeddings using @xenova/transformers (all-MiniLM-L6-v2).
 * The model is lazy-loaded on first use to avoid loading ~80MB if memory tools are unused.
 */

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384;

/** Cached pipeline instance */
let pipelineInstance: unknown = null;
let loading: Promise<unknown> | null = null;

/**
 * Get or create the embedding pipeline. Lazy-loaded on first call.
 */
async function getPipeline(): Promise<unknown> {
  if (pipelineInstance) return pipelineInstance;

  if (loading) return loading;

  loading = (async () => {
    // Dynamic import to avoid loading transformers.js until needed
    const { pipeline } = await import('@xenova/transformers');
    pipelineInstance = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    });
    return pipelineInstance;
  })();

  pipelineInstance = await loading;
  loading = null;
  return pipelineInstance;
}

/**
 * Generate an embedding vector for a text string.
 * Returns a Float32Array of 384 dimensions.
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const extractor = (await getPipeline()) as (
    text: string,
    options: { pooling: string; normalize: boolean }
  ) => Promise<{ data: Float32Array }>;

  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });

  return new Float32Array(output.data);
}

/**
 * Get the embedding dimensions used by the model.
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Check if the embedding model is loaded.
 */
export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}

/**
 * Preload the embedding model. Call this to warm up before first search.
 */
export async function preloadModel(): Promise<void> {
  await getPipeline();
}
