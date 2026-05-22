"""
Minimal RAG: ask questions about files in ./docs
- Loads Azure credentials from .env file automatically
- LLM: Azure OpenAI (chat model)
- Embeddings: local HuggingFace model (no Azure embedding deployment needed)
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
    StorageContext,
    load_index_from_storage,
)
from llama_index.llms.azure_openai import AzureOpenAI
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# Load environment variables from .env file
load_dotenv()

DOCS_DIR = "./docs"
INDEX_DIR = "./storage"

# --- LLM: Azure OpenAI chat model ---
Settings.llm = AzureOpenAI(
    engine=os.environ["AZURE_OPENAI_LLM_DEPLOYMENT"],
    model="gpt-4o",
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)

# --- Embeddings: local model (free, ~130 MB download on first run) ---
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")


def get_index():
    """Load existing index if available, else build from ./docs."""
    if Path(INDEX_DIR).exists():
        print("Loading existing index...")
        storage = StorageContext.from_defaults(persist_dir=INDEX_DIR)
        return load_index_from_storage(storage)

    print(f"Indexing files in {DOCS_DIR}/ ...")
    docs = SimpleDirectoryReader(DOCS_DIR).load_data()
    print(f"  Loaded {len(docs)} document chunks")
    index = VectorStoreIndex.from_documents(docs)
    index.storage_context.persist(persist_dir=INDEX_DIR)
    return index


def main():
    index = get_index()
    query_engine = index.as_query_engine(similarity_top_k=3)

    print("\nAsk questions about your docs (type 'quit' to exit):\n")
    while True:
        q = input("> ").strip()
        if q.lower() in ("quit", "exit", ""):
            break
        response = query_engine.query(q)
        print(f"\n{response}\n")


if __name__ == "__main__":
    main()
