# GrantDesk migration roadmap

- [x] Clone and inspect github.com/rafaelcastro7/grantdesk
- [x] Enable Lovable Cloud
- [ ] Copy app code (routes, components, lib, server) into project
- [ ] Apply database schema migrations (26 files) + GRANTs to Lovable Cloud
- [ ] Replace Supabase local config with Lovable Cloud clients
- [ ] Replace Groq/Cerebras/Gemini/Ollama LLM chain with Lovable AI Gateway
- [ ] Replace Ollama embeddings with Lovable AI Gateway embeddings (dimension-matched)
- [ ] Enable email auth (+ Google sign-in)
- [ ] Ingestion/refresh: expose as server function trigger (no local daemon)
- [ ] Verify build, sign-up, catalog, client, matches flows in browser
