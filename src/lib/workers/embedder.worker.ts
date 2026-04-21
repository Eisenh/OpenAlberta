import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let embedder: any = null;
let useWebGPU = false;
let configReceived = false;
let forcedWebGPU = true;

async function getEmbedder() {
    if (!embedder) {
        if (forcedWebGPU) {
            try {
                embedder = await pipeline('feature-extraction', 'onnx-community/embeddinggemma-300m-ONNX', {
                    device: 'webgpu',
                    dtype: 'q8'
                });
                useWebGPU = true;
                console.log("WebGPU Pipeline activated successfully.");
            } catch (e) {
                console.warn("WebGPU unavailable, initializing WASM CPU Pipeline...", e);
                forcedWebGPU = false; // Fallback entirely
            }
        }
        
        if (!forcedWebGPU && !embedder) {
            try {
                embedder = await pipeline('feature-extraction', 'onnx-community/embeddinggemma-300m-ONNX', {
                    device: 'wasm',
                    dtype: 'q8'
                });
                useWebGPU = false;
            } catch (err) {
                console.error("FATAL: WASM CPU Pipeline totally failed to initialize!", err);
                throw err;
            }
        }
    }
    return embedder;
}

async function recursiveBatchInference(model: any, texts: string[], batchSize: number): Promise<number[][]> {
    const results: number[][] = [];
    
    // Process in chunks of batchSize
    for (let i = 0; i < texts.length; i += batchSize) {
        const chunk = texts.slice(i, i + batchSize);
        const formattedChunk = chunk.map(text => `title: none | text: ${text}`);
        
        try {
            // Bulk Inference via GPU/WASM buffers
            const output = await model(formattedChunk, { pooling: 'mean', normalize: true });
            
            // output.data is a flattened TypedArray of size [chunk.length * 768]
            // We must slice it back into a 2D array
            const flattenedArray = Array.from(output.data);
            const dimCount = 768; // Gemma native dimensions
            
            for (let j = 0; j < chunk.length; j++) {
                results.push(flattenedArray.slice(j * dimCount, (j + 1) * dimCount) as number[]);
            }
        } catch (error: any) {
            // Adaptive GPU Batch Degradation
            if (error.message?.includes('memory') || error.message?.includes('out of bounds') || error.name === 'GPUOutOfMemoryError') {
                 if (batchSize <= 1) {
                     throw new Error("Out of memory completely on batching. Model too large.");
                 }
                 const newBatchSize = Math.floor(batchSize / 2);
                 console.warn(`VRAM Buffer Overflow at batch size ${batchSize}. Degrading batch size to ${newBatchSize}...`);
                 
                 // Process the Failed Chunk with halved batch size
                 const subResults = await recursiveBatchInference(model, chunk, newBatchSize);
                 results.push(...subResults);
            } else {
                 console.error("Fatal inference error in WebGPU/WASM:", error);
                 throw error;
            }
        }
    }
    return results;
}

self.addEventListener('message', async (event: MessageEvent) => {
    // Intercept Configuration Packet
    if (event.data.type === 'config') {
        forcedWebGPU = event.data.useWebGPU !== false;
        configReceived = true;
        return;
    }

    const { id, texts } = event.data; 
    
    try {
        const model = await getEmbedder();
        console.log(`Processing batch of ${texts.length} items using ${useWebGPU ? 'WebGPU' : 'WASM'}...`);
        
        // Initiate array mapping with max 64 items batch ceiling on GPU (or 4 on WASM)
        const initBatchSize = useWebGPU ? 64 : 4;
        const embeddings = await recursiveBatchInference(model, texts, initBatchSize);
        
        self.postMessage({ id, success: true, embeddings });
    } catch (error: any) {
        console.error("Worker embedding failed:", error);
        self.postMessage({ id, success: false, error: error.message });
    }
});
