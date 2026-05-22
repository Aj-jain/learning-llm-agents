# RAG Starter (Azure OpenAI LLM + local embeddings)

Ask questions about your local files (PDF, Word, Excel, text). Chat answers come from Azure OpenAI. Embeddings run locally on your Mac.

## Setup

```bash
# 1. Virtual env
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create your .env file from the template
cp .env.example .env
# then open .env in any editor and fill in your real Azure values

# 4. Add some docs
mkdir -p docs
# drop your PDFs, .docx, .xlsx, .txt into ./docs
```

## Run

```bash
python main.py
```

That's it — no more `export` commands. The script reads `.env` automatically.

## What's in the .env file
4 values, all from your Azure OpenAI resource:

| Variable | Where to find it |
|---|---|
| `AZURE_OPENAI_API_KEY` | Azure Portal → your OpenAI resource → "Keys and Endpoint" |
| `AZURE_OPENAI_ENDPOINT` | Same page — looks like `https://NAME.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | Use `2024-08-01-preview` (works with gpt-4o) |
| `AZURE_OPENAI_LLM_DEPLOYMENT` | The name your team gave to the gpt-4o deployment — ask IT if unsure |

## First run notes
- Embedding model downloads (~130 MB, one-time, cached in `~/.cache/huggingface/`)
- Your docs get indexed into `./storage` (JSON files — no DB server)
- Subsequent runs reuse the index. Delete `./storage` to re-index after adding/changing docs.

## Footprint
~1.5–2 GB on disk (mostly PyTorch, needed by the local embedding model).

## Security
- `.env` is in `.gitignore` — it will never be committed if you put this in git
- Doc content stays on your Mac during indexing. Only your question + retrieved chunks go to Azure when the LLM is called.

## Coming next
- Image support (OCR / vision)
- Source citations (show which file/chunk an answer came from)
