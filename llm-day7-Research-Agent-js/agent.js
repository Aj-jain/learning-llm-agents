import { AzureOpenAI } from "openai";
import "dotenv/config";
import { promises as fs} from "fs";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: deployment,
})

// === Tool Implementations ===
async function web_search({query}) {
    console.log(`  🔍 web_search(query="${query}")`);
    const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
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

async function fetch_url({url}) {
    // TODO: You implement this. See instructions below.
    console.log(`fetch_url(${url})`);

    try {
        const res = await fetch(`https://r.jina.ai/${url}`, {
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            return `Error fetching the url ${url}: HTTP ${res.status}`;
        }
        const text = await res.text();
        return text.slice(0, 3000);
    } catch (e) {
        return `Error fetching url ${url}: ${e.message}`
    }
}

const FINDINGS_FILE = "findings.json";

async function save_findings({source_url,key_points}) {
    console.log(`Save findings(URL="${source_url.slice(0, 50)}..")})`);
    let findings = [];
    try {
        const data = await fs.readFile(FINDINGS_FILE, "utf-8");
        findings = JSON.parse(data);
    } catch (e) {
        console.log(`File doesn't exist yet — that's fine, start fresh`);
    }

    findings.push({
        source_url,
        key_points,
        saved_at: new Date().toISOString(),
    })

    try {
       await fs.writeFile(FINDINGS_FILE, JSON.stringify(findings, null, 2));

    } catch (e) {
        console.log(e.message);
    }
    return `Saved. Total findings so far: ${findings.length}`;
}


async function list_findings() {
    console.log(`list_finding()`);

    try {
        const data = await fs.readFile(FINDINGS_FILE, "utf-8");
        const findings = JSON.parse(data);
        if (findings.length === 0) return `No findings saved yet`;
        return JSON.stringify(findings, null, 2);
    } catch (e) {
        return `No findings saved yet.`;
    }

}

// === Tool Schemas (what the model sees) ===
const tools = [{
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for current information. Returns titles, URLs, and snippets.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query"
                    },
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
                    url: {
                        type: "string",
                        description: "The full URL to fetch"
                    },
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "save_findings",
            description: "Save a key finding with its source URL. Call this after fetch_url whenever you find a fact worth including in the final brief. One call per distinct finding.",
            parameters: {
                type: "object",
                properties: {
                    source_url: {
                        type: "string",
                        description: "The URL where this finding came from"
                    },
                    key_points: {
                        type: "string",
                        description: "A concise, self-contained statement of the finding (1-3 sentences)"
                    }
                },
                required: ["source_url", "key_points"],
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_findings",
            description: "Retrieve all findings saved so far. Call this before writing the final brief to make sure you cite everything.",
            parameters: {
                type: "object",
                properties: {}
            },
        },
    }
];

// Maps tool name -> the JS function to call
const TOOL_FUNCTIONS = {
    web_search,
    fetch_url,
    save_findings,
    list_findings
};

// === The Agent Loop ===
const SYSTEM_PROMPT = `You are a research assistant. Today's date is ${new Date().toISOString().split("T")[0]}. 
When searching for recent information, include the current year.

RESEARCH WORKFLOW:
1. web_search to find relevant sources
2. fetch_url to read the most promising results (you can fetch multiple in parallel)
3. save_finding for every key fact worth including in the final brief — one call per distinct point, always with its source URL
4. Repeat 1-3 until you have enough findings (aim for 4-7 strong findings)
5. list_findings before writing your final answer
6. Synthesize a final brief in this markdown format:

# <Title>

## Executive Summary
<2-3 sentence overview>

## Key Findings
- **<Finding 1>** — Source: <url>
- **<Finding 2>** — Source: <url>
...

## Open Questions
<Anything the research couldn't answer>

RULES:
- Never rely on prior knowledge for factual claims — always search and cite.
- Every finding must have a source URL. No URL = don't save it.
- Don't loop forever. After 5-6 findings, stop researching and synthesize.`;


async function runAgent(userMessage, maxIterations = 10) {
  try{await fs.unlink(FINDINGS_FILE);} catch(e){console.log(`file may not exist`)};
  const messages = [{
            role: "system",
            content: SYSTEM_PROMPT
        },
        {
            role: "user",
            content: userMessage
        },
    ];

    for (let i = 0; i < maxIterations; i++) {
        console.log(`\n--- Iteration ${i + 1} ---`);

        const response = await client.chat.completions.create({
            model: deployment,
            messages,
            tools,
        });
        const msg = response.choices[0].message;
        // console.log("This is LLM message: ", msg);
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
            // console.log("this is function object: ", tc.function);
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
runAgent("What are the top 5 use cases for AI agents in QA testing right now?");