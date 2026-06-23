import { Env, ChatMessage } from "./types";
import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { generateText } from "ai";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// ১. পাবলিক ওয়েব অ্যাপ হ্যান্ডলার
		if (url.pathname === "/webapp") {
			const fileContent = await env.KV_BINDING.get("FLYTRIPVISA_HOME");
			if (!fileContent) return new Response("File not found", { status: 404 });
			return new Response(fileContent, { headers: { "Content-Type": "text/html" } });
		}

		// ২. অ্যাডমিন সেভ এন্ডপয়েন্ট
		if (url.pathname === "/api/admin/save" && request.method === "POST") {
			return handleAdminSave(request, env);
		}

		// ৩. চ্যাট এন্ডপয়েন্ট
		if (url.pathname === "/api/chat" && request.method === "POST") {
			return handleChatRequest(request, env);
		}

		// ৪. প্রজেক্ট অ্যানালাইসিস এন্ডপয়েন্ট
		if (url.pathname === "/api/agent/analyze" && request.method === "POST") {
			return handleAgentAnalysis(request, env);
		}

		// ৫. ডিফল্ট স্ট্যাটিক ফাইল
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

// অ্যাডমিন সেভ হ্যান্ডলার (KV_BINDING ব্যবহার করে)
async function handleAdminSave(request: Request, env: Env): Promise<Response> {
    try {
        const { key, value } = await request.json() as { key: string, value: string };
        await env.KV_BINDING.put(key, value);
        return new Response(JSON.stringify({ success: true, message: `Key ${key} updated!` }), {
            headers: { "content-type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to save" }), { status: 500 });
    }
}

// চ্যাট হ্যান্ডলার
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
	const { messages = [] } = await request.json() as { messages: ChatMessage[] };
	const stream = await env.AI.run(MODEL_ID, { messages, stream: true }, {
		gateway: { id: "default", skipCache: false },
	});
	return new Response(stream, {
		headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
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
		prompt: "Analyze the current project structure and suggest improvements.",
	});
	return new Response(JSON.stringify({ analysis: text }), { headers: { "content-type": "application/json" } });
}
