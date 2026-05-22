import { AzureOpenAI } from "openai";
import "dotenv/config"

// Change this line to swap models
 const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;
// const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT52;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: deployment,
})

const response = await client.chat.completions.create({
  model: deployment,
  messages: [
    // { role: "system", content: "You are a happy senior QA engineer"+
    //     "who hates eveyone and gives blunt 5-words answers." },
          { role: "system", content: "Assume that you are senior inspector in Police" },
  { role: "user", content: "Explain QA testing" }
  ],
});

// const response = await client.chat.completions.create({
//   model: deployment,
//   temperature: 1.5,      
//   messages: [
//     { role: "user", content: "Write a 1-line tagline for a QA testing tool" }
//   ],
// });

console.log(response.choices[0].message.content);
console.log(`[Model: ${deployment}]`);