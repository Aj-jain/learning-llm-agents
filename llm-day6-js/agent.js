import { AzureOpenAI } from "openai";
import "dotenv/config";
import { catalan } from "mathjs";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: deployment,
})

// === Tool Implementations ===
async function web_search({ query }) {
  console.log(`  🔍 web_search(query="${query}")`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
    }),
  });
  const data = await res.json();
  const results = (data.results || []).map(r => ({
    title: r.title,
    url: r.url,
    snippet: (r.content || "").slice(0, 300),
  }));
  return JSON.stringify(results);
}

async function fetch_url({ url }) {
  // TODO: You implement this. See instructions below.
  console.log(`fetch_url(${url})`);

  try{
  const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(15000),
  });
  if(!res.ok){
    return `Error fetching the url ${url}: HTTP ${res.status}`;
  }
const text = await res.text();
return text.slice(0, 3000);
  } catch(e){
return `Error fetching url ${url}: ${e.message}`
  }
}

// === Tool Schemas (what the model sees) ===
const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information. Returns titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the full text of a webpage. Use after web_search to read a promising result in detail.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
];

// Maps tool name -> the JS function to call
const TOOL_FUNCTIONS = {
  web_search,
  fetch_url,
};

// === The Agent Loop ===
// const SYSTEM_PROMPT = `You are a research assistant. Today's date is ${new Date().toISOString().split("T")[0]} When searching for recent information, include the current year.
// Always use web_search before answering factual questions — never rely on prior knowledge for current info.
// After searching, fetch the most promising result to get full content before answering.
// Cite your sources by including URLs in your final answer.`;


const SYSTEM_PROMPT = `You are a research assistant. Today's date is ${new Date().toISOString().split("T")[0]} When searching for recent information, include the current year.
 When you need to fetch multiple URLs that don't depend on each other,request all of them in a single response using parallel tool calls. Always use web_search before answering factual questions — never rely on prior knowledge for current info.
After searching, fetch the most promising result to get full content before answering.
Cite your sources by including URLs in your final answer.`;


async function runAgent(userMessage, maxIterations = 10) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(`\n--- Iteration ${i + 1} ---`);

    const response = await client.chat.completions.create({
      model: deployment,
      messages,
      tools,
    });
    const msg = response.choices[0].message;
    console.log("This is LLM message: ",msg);
    messages.push(msg);

    // No tool calls → model is done
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      console.log(`\n✅ Final answer:\n${msg.content}`);
      return msg.content;
    }

    // Execute each tool the model asked for
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      console.log("this is function object: ", tc.function);
      console.log(`  → model called: ${name}(${JSON.stringify(args)})`);

      let result;
      try {
        result = await TOOL_FUNCTIONS[name](args);
      } catch (e) {
        result = `Error: ${e.message}`;
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  console.log("\n⚠️  Hit max iterations without final answer");
  return null;
}

// Entry point
runAgent("What are the top 206 use cases for AI agents in QA testing right now?");