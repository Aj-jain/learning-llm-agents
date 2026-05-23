# Day 5 — What I Learned

- Same agent loop as Day 4, just more tools.
- Added 3 tools: `calculate`, `get_current_time`, `read_file`.
- Used a dispatch map (`toolImpls`) instead of `if/else` — like `Map<String, Function>` in Java.
- The LLM picks the tool. My code only runs what the LLM picked.
- The `description` field is what the LLM uses to choose — it's the actual routing logic.
- Tool chaining: the model can call multiple tools in sequence (read file → calculate → answer).
- Conversation history (`messages` array) is the agent's memory across turns.
- Adding a new tool = 3 edits: function + `toolImpls` + `tools` array. Loop stays untouched.

**One-liner:** LLM decides *which* tool, my code decides *how* to run it, the description is the bridge.