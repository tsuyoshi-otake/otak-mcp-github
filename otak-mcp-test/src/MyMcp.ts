import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

// McpAgentのデフォルト型パラメータを使用。ブログ記事では型パラメータは明示されていなかった。
// 必要であれば <any, any, Record<string, unknown>> なども試す。
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: 'MyMCP Server',
		version: '0.1.0',
	});

	// ブログ記事には明示的なコンストラクタはない。
	// McpAgentがinitを呼び出すことを期待。
	// constructor(state: DurableObjectState, env: any) {
	// 	super(state, env);
	// }

	async init() {
		console.log("Initializing MyMCP tools (blog-like structure)...");
		this.server.tool(
			'dice_roll',
			'サイコロを降った結果を返します',
			{ sides: z.number().min(1).max(100).default(6).describe('サイコロの面の数') },
			async ({ sides }) => {
				const result = Math.floor(Math.random() * (sides ?? 6)) + 1;
				return {
					content: [{ type: 'text', text: result.toString() }],
				};
			}
		);

        this.server.tool(
            'weather',
            '指定した都市の天気情報を返します',
            { city: z.string().describe('都市名') },
            async ({ city }) => {
                const mockWeather = {
                    temperature: Math.floor(Math.random() * 30) + 10,
                    condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
                };
                return {
                    content: [{
                        type: 'text',
                        text: `${city}の天気:\n気温: ${mockWeather.temperature}°C\n天気: ${mockWeather.condition}`
                    }]
                };
            }
        );
		console.log("MyMCP tools initialization complete (blog-like structure).");
	}
}