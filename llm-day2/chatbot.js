import { AzureOpenAI } from "openai";
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Change this line to swap models
 const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;
// const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT52;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: deployment,
})

const message = [
    {role: "system", content: "You are a friendly assistant. Keep replies to 1 sentences."} //Who Are you? please answer the question! And ask a new question either related or random. Do not repeat the answer, canswer the question, which was asked in previous reply."}
]

const rl = readline.createInterface({input, output});

console.log("Chatbot ready. Type 'exit' to quit.")

    while(true){
    const userInput = await rl.question("You: ");
    if(userInput=="exit") break;
      message.push({role: "user", content: userInput});
    const response = await client.chat.completions.create({
        model: deployment,
        messages: message
    })
    const reply = response.choices[0].message.content;

     message.push({role:"assistant", content: reply});

    console.log("Bot: "+reply);
}
    rl.close();
    

