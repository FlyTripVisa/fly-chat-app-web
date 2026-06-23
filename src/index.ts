import { Env, ChatMessage } from "./types";
import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { generateText } from "ai";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// ১. স্ট্যাটিক ফাইল বা ফ্রন্টএন্ড হ্যান্ডলিং
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// ২. চ্যাট এন্ডপয়েন্ট
		if (url.pathname === "/api/chat" && request.method === "POST") {
			return handleChatRequest(request, env);
		}

		// ৩. প্রজেক্ট অ্যানালাইসিস এন্ডপয়েন্ট (AI Gateway)
		if (url.pathname === "/api/agent/analyze" && request.method === "POST") {
			return handleAgentAnalysis(request, env);
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// চ্যাট হ্যান্ডলার (SSE Streaming)
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
	const { messages = [] } = await request.json() as { messages: ChatMessage[] };
	
	const stream = await env.AI.run(MODEL_ID, {
		messages,
		stream: true,
	}, {
		gateway: {
			id: "default", // আপনার দেওয়া গেটওয়ে নাম
			skipCache: false,
		},
	});

	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	});
}

// এআই গেটওয়ে এজেন্ট হ্যান্ডলার
async function handleAgentAnalysis(request: Request, env: any): Promise<Response> {
	const aigateway = createAiGateway({
		accountId: "b73b80fa62deef032d3c08248cf2f30b",
		gateway: "default",
		apiKey: env.CF_AIG_TOKEN,
	});
	
	const unified = createUnified();

	const { text } = await generateText({
		model: aigateway(unified("workers-ai/" + MODEL_ID)),
		prompt: "Analyze the current project structure and suggest improvements for the templates.",
	});

	return new Response(JSON.stringify({ analysis: text }), {
		headers: { "content-type": "application/json" },
	});
}
