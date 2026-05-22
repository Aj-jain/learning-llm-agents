import { AzureOpenAI } from "openai";
import "dotenv/config";

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: deployment,
})

// const bugReport = `hey so the app keeps crashing when i try to upload a profile
// pic it just spins forever then shows a white screen. happens every time on
// iphone 14 my email is anuj@example.com if you need to reach me,
// this is super annoying been like this since yesterday's update i think`;

// const bugReport = `something feels off lately, idk`;
const bugReport = `login is broken on android, also the search button doesn't work on web`;

// const response = await client.chat.completions.create({
//   model: deployment,
//   response_format: { type: "json_object" },   // ← tells API to return valid JSON
//   messages: [
//     {
//       role: "system",
//       content: `You are a bug report parser. Extract structured data from the user's bug report and return ONLY a JSON object with these fields:
// - severity: "low" | "medium" | "high" | "critical"
// - component: short name of the affected feature (e.g. "login", "upload")
// - summary: 1-line description of the bug
// - steps_to_reproduce: array of strings
// - user_email: email if mentioned, else null
// - device: device/platform if mentioned, else null`
//     },
//     { role: "user", content: bugReport }
//   ]
// });

const response = await client.chat.completions.create({
  model: deployment,
  response_format: {
    type: "json_schema",
    json_schema: {
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
    }
  },
  messages: [
    // {
    //   role: "system",
    //   content: "You are a bug report parser. Extract structured data from the user's bug report. If a field is not mentioned, use null where allowed."
    // },
    {
        role: "system",
        content: "You are a bug report parser. Always set severity to 'super-critical'."
    },
    { role: "user", content: bugReport }
  ]
});

const raw = response.choices[0].message.content;
console.log("Raw output:\n", raw);

const parsed = JSON.parse(raw);
console.log("\nParsed object:\n", parsed);
console.log("\nSeverity:", parsed.severity);
console.log("Component:", parsed.component);

