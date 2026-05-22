import { AzureOpenAI } from "openai";
import "dotenv/config"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: deployment
})

const rl = readline.createInterface({input, output});
const messages = [{role: "system", content: "You are a friendly assistant. Keep replies to 1 sentences."}]
const bugSchema = {
      name: "bug_report",
      strict: true,
      schema: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"]
          },
          component: { type: "string" },
          summary: { type: "string" },
          steps_to_reproduce: {
            type: "array",
            items: { type: "string" }
          },
          user_email: { type: ["string", "null"] },
          device: { type: ["string", "null"] }
        },
        required: ["severity", "component", "summary", "steps_to_reproduce", "user_email", "device"],
        additionalProperties: false
      }
  };

console.log("Chatbot ready. Type 'exit' to quit.")
while(true){
    const userInput = await rl.question("You : ");
    if(userInput=="exit"){
        break;
    }
     else if(userInput.startsWith('file bug')){
        const desc = userInput.slice("file bug".length).trim();

    const response = await client.chat.completions.create({
        model: deployment,
        response_format: {
            type: "json_schema",
            json_schema: bugSchema,
        },
        messages: [
            {role: "system", content: "You are a bug report parser. Extract structured data from the user's bug report. If a field is not mentioned, use null where allowed."},
            {role: "user", content: desc }
        ]
    })

   const raw = response.choices[0].message.content;
   console.log("Raw output:\n", raw);

    const parsed = JSON.parse(raw);
    console.log("\nParsed object:\n", parsed);
    console.log("\nSeverity:", parsed.severity);
    console.log("Component:", parsed.component);

     }else{
    messages.push({role: "user", content: userInput})
    const response = await client.chat.completions.create({
        model: deployment,
        messages: messages
    })
    const reply = response.choices[0].message.content;
    messages.push({role:"assistant", content: reply});
    console.log("Bot: "+reply);
     }
    
}  
rl.close();