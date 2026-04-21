import { supabase } from '../supabaseClient';
import { v5 as uuidv5 } from 'uuid';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const COMPANY_NAMESPACE = uuidv5('Eisenhawer Tech', DNS_NAMESPACE);

export class CKANIngestor {
    private ckanUrl: string;
    private dataSourceId: string;
    private isDelta: boolean;
    private isRunning: boolean = false;
    
    private maxWorkers: number;
    private useWebGPU: boolean;
    private isWebGPUAvailable: boolean;
    private workers: Worker[] = [];
    private idleWorkers: Worker[] = [];
    private embeddingQueue: { id: string, texts: string[], resolve: (val: any) => void, reject: (err: any) => void }[] = [];

    public onProgress: (msg: string, current: number, total: number) => void = () => {};
    public onComplete: (success: boolean, msg: string) => void = () => {};

    constructor(ckanUrl: string, dataSourceId: string, isDelta: boolean = false, maxWorkers: number = 4, useWebGPU: boolean = true) {
        this.ckanUrl = ckanUrl.replace(/\/+$/, '');
        this.dataSourceId = dataSourceId;
        this.isDelta = isDelta;
        
        this.isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;
        this.useWebGPU = this.isWebGPUAvailable && useWebGPU;
        this.maxWorkers = maxWorkers;
        
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker(new URL('../workers/embedder.worker.ts', import.meta.url), { type: 'module' });
            // Send config message immediately upon boot
            worker.postMessage({ type: 'config', useWebGPU });
            this.workers.push(worker);
            this.idleWorkers.push(worker);
        }
    }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            // Fetch local database state to accurately display preserved progress
            let localPackagesMap = new Map();
            let ingestedSet = new Set<string>();

            this.onProgress("Fetching local database state...", 0, 0);
            
            const { data: existingDocs } = await supabase
                .from('docs_meta')
                .select('package_id, metadata->metadata_modified')
                .eq('data_source_id', this.dataSourceId);
            
            if (existingDocs) {
                existingDocs.forEach(doc => {
                     if (this.isDelta) {
                         localPackagesMap.set(doc.package_id, doc.metadata_modified);
                     }
                     ingestedSet.add(doc.package_id);
                });
            }

            this.onProgress(`Preparing CKAN Pagination Network...`, ingestedSet.size, ingestedSet.size);

            let start = 0;
            const rows = 1000;
            let totalCount = 0;
            let keepPaginating = true;

            while (keepPaginating && this.isRunning) {
                const proxyUrl = `${this.ckanUrl}/api/3/action/package_search?q=*:*&rows=${rows}&start=${start}`;
                this.onProgress(`Downloading & Diff-Scanning CKAN Records ${start} to ${start + rows}...`, ingestedSet.size, Math.max(totalCount, ingestedSet.size, 100));
                
                const { data: json, error } = await supabase.functions.invoke('ckan-proxy', {
                    body: { url: proxyUrl }
                });

                if (error || !json || !json.result || !json.result.results) {
                    throw new Error(`Failed to fetch bulk pagination at start ${start}`);
                }

                const packages = json.result.results;
                totalCount = json.result.count;
                
                if (packages.length === 0) break;

                // Validate against Delta state
                const validPackages = packages.filter((pkg: any) => {
                    const identifier = pkg.name || pkg.id;
                    if (this.isDelta && localPackagesMap.has(identifier)) {
                        return localPackagesMap.get(identifier) !== pkg.metadata_modified;
                    }
                    return true;
                });

                if (validPackages.length > 0) {
                     // Feed valid packages dynamically: Max 16 on WebGPU VRAM, strict 2 on WASM CPU threads to avoid locking 
                     const chunkSize = this.useWebGPU ? 16 : 2;
                     const batchPromises = [];
                     let chunksProcessed = 0;
                     
                     for (let i = 0; i < validPackages.length; i += chunkSize) {
                          const chunk = validPackages.slice(i, i + chunkSize);
                          
                          batchPromises.push((async () => {
                              const texts = chunk.map((pkg: any) => {
                                  const tags = pkg.tags?.map((t: any) => t.displaytext || t.name).join(', ') || '';
                                  return `Title: ${pkg.title || ""} Description: ${pkg.notes || ""} Tags: ${tags}`;
                              });
                              
                              try {
                                  // Submit to WebWorker pool
                                  const embeddings = await this.getEmbeddings(crypto.randomUUID(), texts);
                                  
                                  // Construct payload for the Supabase Edge Function Bulk Endpoint
                                  const edgePayload = chunk.map((pkg: any, idx: number) => ({
                                      packageId: pkg.name || pkg.id,
                                      url: `${this.ckanUrl}/dataset/${pkg.name || pkg.id}`,
                                      metadata: pkg,
                                      embedding: embeddings[idx] 
                                  }));
                                  
                                  // Eject immediately to Server
                                  await this.saveBulkToSupabase(edgePayload);
                                  
                                  // On success, add to ingestedSet
                                  chunk.forEach((pkg: any) => ingestedSet.add(pkg.name || pkg.id));
                                  
                              } catch(e) {
                                  console.error("Batch Insertion Failed: ", e);
                              } finally {
                                  chunksProcessed++;
                                  const embeddedCount = Math.min(chunksProcessed * chunkSize, validPackages.length);
                                  this.onProgress(`Embedding Batch ${embeddedCount} / ${validPackages.length} in Page...`, ingestedSet.size, totalCount);
                              }
                          })());
                     }
                     // Throttle RAM by waiting for the whole 1000-page block to finish crunching its batches
                     await Promise.all(batchPromises);
                }

                this.onProgress(`Processed page ${start / rows + 1}...`, ingestedSet.size, totalCount);

                if (start + packages.length >= totalCount) {
                    keepPaginating = false;
                } else {
                    start += rows;
                }
            }

            this.onProgress("Ingestion complete!", totalCount, totalCount);
            this.onComplete(true, `Successfully processed ${totalCount} packages.`);
        } catch (err: any) {
            console.error("Fatal ingestion error:", err);
            this.onComplete(false, err.message || "Unknown error processing CKAN API. (CORS issue?)");
        } finally {
            this.stop();
        }
    }

    public stop() {
        this.isRunning = false;
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        this.idleWorkers = [];
    }

    private processEmbeddingQueue() {
        if (this.embeddingQueue.length > 0 && this.idleWorkers.length > 0) {
            const worker = this.idleWorkers.pop()!;
            const task = this.embeddingQueue.shift()!;
            
            const onMessage = (e: MessageEvent) => {
                if (e.data.id === task.id) {
                    worker.removeEventListener('message', onMessage);
                    this.idleWorkers.push(worker);
                    this.processEmbeddingQueue(); 
                    
                    if (e.data.success) {
                        task.resolve(e.data.embeddings);
                    } else {
                        task.reject(new Error(e.data.error));
                    }
                }
            };
            
            worker.addEventListener('message', onMessage);
            worker.postMessage({ id: task.id, texts: task.texts });
        }
    }

    private getEmbeddings(id: string, texts: string[]): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            this.embeddingQueue.push({ id, texts, resolve, reject });
            this.processEmbeddingQueue();
        });
    }

    private async saveBulkToSupabase(packagesInfoArray: any[]) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error("Authentication failed for bulk edge write.");
        
        const payload = {
            dataSourceId: this.dataSourceId,
            packages: packagesInfoArray
        };
        
        const { data, error } = await supabase.functions.invoke('ingest-ckan-package', {
            body: payload,
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });
        
        if (error) {
            throw new Error(`Edge Function Bulk Insertion Faulted: ${error.message}`);
        }
    }
}
