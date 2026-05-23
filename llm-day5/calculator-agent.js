import "dotenv/config";
import { AzureOpenAI } from "openai";
import { evaluate } from "mathjs";
import fs from "fs";
import path from "path";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: deployment,
});

// ---------- Tool implementations ----------
function calculate(expression) {
  return evaluate(expression);
}

function getCurrentTime() {
  return new Date().toString();
}

function readFile(filename) {
  // Tiny safety: prevent path traversal out of the project
  const fullPath = path.resolve(process.cwd(), filename);
  if (!fullPath.startsWith(process.cwd())) {
    throw new Error("Access denied: path outside project");
  }
  return fs.readFileSync(fullPath, "utf-8");
}

// Dispatch table — name → handler. This is your router.
const toolImpls = {
  calculate:        (args) => calculate(args.expression),
  get_current_time: ()     => getCurrentTime(),
  read_file:        (args) => readFile(args.filename),
};

// ---------- Tool schemas (what the model sees) ----------
const tools = [
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluate a math expression like '234 * 56' or '(10+5)/3'. Returns the numeric result.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "A math expression to evaluate" },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Returns the current local date and time. Use whenever the user asks about 'now', 'today', or the current time/date.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a text file from the project directory. Use when the user references a file by name (e.g. 'notes.txt', 'todo.md').",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Filename to read, e.g. 'notes.txt'" },
        },
        required: ["filename"],
      },
    },
  },
];

// ---------- The agent loop (unchanged from Day 4, just generic now) ----------
async function runAgent(userQuestion) {
  console.log(`\n=== Question: ${userQuestion} ===`);
  const messages = [{ role: "user", content: userQuestion }];
  const MAX_TURNS = 10;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n→ Turn ${turn}`);

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      messages,
      tools,
    });

    const msg = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;
    console.log(`  finish_reason: ${finishReason}`);
    messages.push(msg);

    if (finishReason === "stop") {
      console.log(`\n✅ Final answer: ${msg.content}`);
      return msg.content;
    }

    if (finishReason === "tool_calls") {
      for (const toolCall of msg.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const fn = toolImpls[name];

        console.log(`  → ${name}(${JSON.stringify(args)})`);

        let result;
        try {
          result = fn ? fn(args) : `Error: unknown tool '${name}'`;
        } catch (err) {
          result = `Error: ${err.message}`;
        }
        console.log(`    = ${result}`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: String(result),
        });
      }
      continue;
    }

    console.log(`  Unexpected finish_reason — stopping.`);
    break;
  }
}
await runAgent("Read notes.txt and tell me how many hours of QA work I have, divided by 3 people.");