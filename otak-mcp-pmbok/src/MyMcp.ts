import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
// import { Ai } from '@cloudflare/ai'; // Removed - Use native binding env.AI

// Import actual PMBOK content
// wrangler.toml rule should handle loading this as text
import pmbokContent from '../pmbok.md';


// Define the environment interface including AI and Vectorize bindings
interface Env {
	MCP_OBJECT: DurableObjectNamespace;
	AI: any; // Type provided by @cloudflare/ai binding
	VECTORIZE_INDEX: VectorizeIndex;
}

// Define the VectorizeIndex interface (subset of actual)
interface VectorizeIndexVector {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
}
interface VectorizeIndexQueryResult {
    id: string;
    score: number;
    metadata?: Record<string, any>;
    values?: number[]; // Sometimes included
}
interface VectorizeIndex {
	upsert(vectors: Array<VectorizeIndexVector>): Promise<void>;
	query(vector: number[], options?: { topK?: number; filter?: Record<string, any>; returnMetadata?: boolean; returnValues?: boolean }): Promise<{ matches: Array<VectorizeIndexQueryResult> }>;
	getByIds(ids: string[]): Promise<Array<VectorizeIndexVector>>;
    // Add other methods if needed, e.g., deleteByIds
}


export class MyMCP extends McpAgent {
	server = new McpServer({
		name: 'PMBOK RAG MCP Server',
		version: '0.1.0',
	});
	env: Env;
	// ai: Ai; // Removed - Use native binding env.AI
	vectorizeIndex: VectorizeIndex;
	initialized: boolean = false; // Simple flag to avoid re-indexing

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.env = env;
		// this.ai = new Ai(env.AI); // Removed - Use native binding env.AI
		this.vectorizeIndex = env.VECTORIZE_INDEX;
	}

	// Simple Markdown chunking by paragraphs
	chunkText(text: string, chunkSize: number = 500): string[] {
		const paragraphs = text.split(/\n\s*\n/); // Split by blank lines
		const chunks: string[] = [];
		let currentChunk = '';

		for (const paragraph of paragraphs) {
			if (paragraph.trim().length === 0) continue;

			if (currentChunk.length + paragraph.length + 1 <= chunkSize) {
				currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
			} else {
				if (currentChunk.length > 0) {
					chunks.push(currentChunk);
				}
				// Start new chunk, handle paragraphs larger than chunkSize if necessary
				currentChunk = paragraph.length <= chunkSize ? paragraph : paragraph.substring(0, chunkSize);
				// Basic handling for oversized paragraphs, could be improved
				if (paragraph.length > chunkSize) {
					console.warn("Paragraph larger than chunk size, truncating.");
				}
			}
		}
		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}
		return chunks;
	}

	async initializeVectorStore() {
		// Simple check: Query a known ID. If it exists, assume indexed.
		// A more robust method would use DO storage to track indexing state.
		try {
			const check = await this.vectorizeIndex.getByIds(["chunk_0"]);
			if (check && check.length > 0) {
				console.log("Vector store seems initialized. Skipping indexing.");
				this.initialized = true;
				return;
			}
		} catch (e) {
			console.log("Checking index failed or index empty, proceeding with initialization.", e);
		}


		console.log("Initializing Vector Store with PMBOK content...");
		// Ensure pmbokContent is not empty before proceeding
		if (!pmbokContent || pmbokContent.trim().length === 0) {
			console.error("Error: Imported pmbok.md content is empty or failed to load.");
			this.initialized = false;
			return;
		}
		const chunks = this.chunkText(pmbokContent); // Chunk the imported content dynamically
		console.log(`Created ${chunks.length} chunks.`);

        let embeddings;
        try {
            embeddings = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', { // Use env.AI
                text: chunks
            });

            if (!embeddings.data) {
                throw new Error("Embeddings data is missing in the AI response.");
            }
            console.log(`Generated ${embeddings.data.length} embedding vectors.`);
        } catch (error) {
            console.error("Failed to generate embeddings:", error);
            this.initialized = false;
            return; // Stop initialization if embeddings fail
        }


		const vectors: Array<VectorizeIndexVector> = [];
		for (let i = 0; i < chunks.length; i++) {
			if (embeddings.data[i]) {
				vectors.push({
					id: `chunk_${i}`,
					values: embeddings.data[i],
					metadata: { text: chunks[i] }
				});
			} else {
				console.warn(`Missing embedding for chunk ${i}`);
			}
		}

		if (vectors.length > 0) {
			// Upsert in batches if necessary (Vectorize has limits)
			const batchSize = 100; // Adjust as needed
            try {
                for (let i = 0; i < vectors.length; i += batchSize) {
                    const batch = vectors.slice(i, i + batchSize);
                    console.log(`Upserting batch ${Math.floor(i / batchSize) + 1} with ${batch.length} vectors...`);
                    await this.vectorizeIndex.upsert(batch);
                }
                console.log("Vector store initialization complete.");
                this.initialized = true;
            } catch (error) {
                console.error("Error upserting vectors:", error);
                this.initialized = false; // Mark as not initialized on error
            }
		} else {
			console.error("No vectors generated to upsert.");
            this.initialized = false;
		}
	}


	async init() {
		console.log("Initializing PMBOK MCP...");
		// Initialize vector store only once or if needed
        if (!this.initialized) {
		    await this.initializeVectorStore();
        } else {
            console.log("Skipping vector store initialization as it's already marked complete.");
        }

		this.server.tool(
			'ask_pmbok',
			'PMBOKガイドに関する質問に答えます',
			{ query: z.string().describe('PMBOKに関する質問') },
			async ({ query }) => {
				if (!this.initialized) {
					// Attempt re-initialization or return error
                    console.warn("Attempting re-initialization of vector store on demand...");
                    await this.initializeVectorStore();
                    if (!this.initialized) {
					    return { content: [{ type: 'text', text: "エラー: ベクトルストアが初期化されていません。再試行に失敗しました。" }] };
                    }
				}

				console.log(`Received query: ${query}`);

				// 1. Embed the query using the native AI binding
				let queryVector: number[];
				try {
					const queryEmbeddingResponse = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
						text: [query]
					});
					if (!queryEmbeddingResponse.data || !queryEmbeddingResponse.data[0]) {
						throw new Error("AI embedding response missing data.");
					}
					queryVector = queryEmbeddingResponse.data[0];
					console.log("Query embedded.");
				} catch (error) {
					console.error("Failed to embed query:", error);
					return { content: [{ type: 'text', text: "エラー: 質問のベクトル化に失敗しました。" }] };
				}


				// 2. Query Vectorize
				let searchResults: { matches: Array<VectorizeIndexQueryResult> };
                const topK = 3; // Number of relevant chunks to retrieve
				try {
					searchResults = await this.vectorizeIndex.query(queryVector, { topK, returnMetadata: true }); // Ensure metadata is returned
					console.log(`Found ${searchResults.matches.length} relevant chunks.`);
				} catch (error) {
					console.error("Failed to query Vectorize index:", error);
					return { content: [{ type: 'text', text: "エラー: ベクトル検索に失敗しました。" }] };
				}


				if (!searchResults.matches || searchResults.matches.length === 0) {
					return { content: [{ type: 'text', text: "関連する情報が見つかりませんでした。" }] };
				}

				// 3. Construct Context
				const context = searchResults.matches
					.map(match => match.metadata?.text) // Access metadata correctly
					.filter((text): text is string => typeof text === 'string' && text.length > 0) // Ensure text is valid string
					.join("\n\n---\n\n"); // Join chunks with separator

                if (context.length === 0) {
                    console.warn("Context constructed but is empty. Check vector metadata.");
                    return { content: [{ type: 'text', text: "関連する情報が見つかりましたが、内容を取得できませんでした。" }] };
                }

				console.log(`Context constructed (length: ${context.length})`);
				// console.log("Context:\n", context); // Log context for debugging if needed

				// 4. Generate Response using LLM with Context
				const systemPrompt = `あなたはPMBOKガイドに関する専門家アシスタントです。提供された以下のコンテキスト情報のみを使用して、ユーザーの質問に正確かつ簡潔に答えてください。コンテキストに関係ない質問には、情報がない旨を伝えてください。`;

				const messages = [
					{ role: 'system', content: systemPrompt },
					// Add explicit instruction to answer in Japanese
					{ role: 'user', content: `コンテキスト:\n${context}\n\n質問: ${query}\n\n日本語で回答してください。` }
				];

				let responseText: string;
				try {
					console.log("Generating response from LLM...");
					const llmResponse = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', { messages });

					// Ensure response is string
	                responseText = typeof llmResponse.response === 'string' ? llmResponse.response : JSON.stringify(llmResponse.response);

					console.log("LLM response received.");
	                // console.log("LLM Raw Response:", llmResponse); // Log raw response if needed
				} catch (error) {
					console.error("Failed to generate response from LLM:", error);
					return { content: [{ type: 'text', text: "エラー: 回答の生成に失敗しました。" }] };
				}


				return {
					content: [{ type: 'text', text: responseText }],
				};
			}
		);
		console.log("PMBOK MCP initialization complete.");
	}
}