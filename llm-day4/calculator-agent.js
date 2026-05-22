import { AzureOpenAI } from "openai";
import "dotenv/config";
import { evaluate, to } from "mathjs";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
})

function calculate(expression) {
    return evaluate(expression);
}

const tools = [
    {
        type: "function",
        function: {
            name: "calculate",
            description: "Evaluate a basic math expression like '234 * 56' or '(10+5)/3'. Returns the numeric result.",
            parameters: {
                type: "object",
                properties: {
                    expression: {
                        type: "string",
                        description: "A math expression to evaluate",
                    },
                },
                required: ["expression"],
            },
        }
    }
]

// const userQuestion = "What's 5 + 5, then multiply by 3, then divide by 2?";
const userQuestion = "What's the capital of France?"
const messages = [{ role: "user", content: userQuestion },]

const MAX_TURNS = 10;

for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n-> Turn ${turn}`);

    const round1 = await client.chat.completions.create({
        model: deployment,
        messages: messages,
        tools: tools,

    });

    const assistantMsg = round1.choices[0].message;
    const finishReason = round1.choices[0].finish_reason;
    console.log("  finishReason:", finishReason);
    messages.push(assistantMsg);

    if (finishReason === "stop") {
        console.log(`\n Final answer: ${assistantMsg.content}`);
        break;
    }

    if (finishReason === "tool_calls") {

        for (const toolCall of assistantMsg.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`model wants: ${toolCall.function.name}(${JSON.stringify(args)})`);

            const value = calculate(args.expression)
            console.log(` local result ${value}`);

            messages.push({
                role: "tool",
                content: String(value),
                tool_call_id: toolCall.id,
            });
        }

    }

}
// console.log("→ Round 2: sending result back");
// const round2 = await client.chat.completions.create({
//     model: deployment,
//     messages: messages,
//     tools: tools,
// });

// console.log("finish_reason:", round2.choices[0].finish_reason);
// console.log("\nFinal answer:", round2.choices[0].message.content);
