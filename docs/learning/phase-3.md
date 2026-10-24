# Phase 3: AI Guide with Retrieval-Augmented Generation (RAG)

## 60-second pitch (say this in an interview)

> "The core of EverGuide is an AI Guide that answers from a curated knowledge base instead of from the model's memory. Documents are split into sections, embedded with Gemini into 768-dimension vectors, and stored in Postgres with pgvector and an HNSW index. For each question the server embeds it, retrieves the closest approved passages above a similarity threshold, and asks Gemini to answer only from those numbered sources. Before saving, it strips any citation number that doesn't match a retrieved passage, so every citation a user can click is real. I chose the threshold from an evaluation set rather than guessing. The default of 0.5 would have 'grounded' off-topic questions, and the data showed a clean gap, so I set 0.6. Answers stream to the browser over server-sent events. The database enforces privacy and a monthly allowance that can't be beaten by concurrent requests; I tested that with 10 simultaneous requests against a limit of 3. Testing in a real browser caught bugs unit tests couldn't: a Stop button that silently re-sent the question, and a server that kept paying for answers after the user had left."

## What we built

| Area | What | Where |
|---|---|---|
| Database | Knowledge tables (pgvector + HNSW), conversations, messages, citations, usage (atomic reservation), feedback; RLS so users can't forge AI messages | `database/migrations/20261024000002_ai_guide.sql` |
| Knowledge base | 10 AI-drafted starter guides (clearly labelled), evaluation questions | `database/knowledge/` |
| Ingestion | Markdown → sections → embeddings → pgvector; skips unchanged files | `server/scripts/ingest-knowledge.ts` |
| Evaluation | hit@1, hit@3, MRR, similarity gap → threshold | `server/scripts/eval-retrieval.ts` |
| RAG logic | Retriever, prompt, citation validation, crisis screen | `server/src/rag/` |
| Chat orchestration | Allowance → store → retrieve → stream → validate citations → save → follow-ups | `server/src/services/ai-guide-service.ts` |
| Streaming API | SSE over POST, disconnect handling | `server/src/routes/ai.ts` |
| Workspace UI | History, search, rename, delete, streaming, citations, sources panel, copy, retry, stop, feedback, follow-ups, usage | `client/src/pages/guide/` |

## The RAG pipeline (draw this on a whiteboard)

```
OFFLINE (ingestion)                          ONLINE (each question)
Markdown guide                               Question
   │ split by section                          │ embed (RETRIEVAL_QUERY)
   ▼                                           ▼
Chunks ── embed (RETRIEVAL_DOCUMENT) ──▶ pgvector (HNSW, cosine) ──▶ top-5 approved chunks ≥ 0.60
                                                                       │ numbered SOURCES + question
                                                                       ▼
                                                                Gemini (temp 0.3, streamed)
                                                                       │ "…[1]…[2]"
                                                                       ▼
                                                    keep only [n] that were retrieved → save + citations
```

## Key concepts, explained

**1. Why RAG instead of just asking the model?** Models answer from training data that may be outdated, generic or wrong, and they can't cite it. RAG fetches trusted passages at question time, so answers are current, specific to your content, and checkable.

**2. Embeddings and similarity.** An embedding turns text into a vector; texts with similar meaning point in similar directions. Cosine similarity (1 = same direction) measures closeness. Questions and documents use different *task types* (`RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT`) because a short question and a long passage are phrased differently.

**3. Chunking.** Whole documents are too broad to match well and too long to send. We split by Markdown section, so every chunk is one complete idea, and add the title and heading to the embedded text for context.

**4. HNSW index.** Comparing a question with every vector is slow at scale. HNSW (Hierarchical Navigable Small World) is an approximate nearest-neighbour index: much faster, very slightly less exact. pgvector's HNSW handles vectors up to 2000 dimensions, one reason we chose 768 over the default 3072.

**5. The threshold, and why measure it.** Too low, and irrelevant passages are dressed up as sources. Too high, and good answers lose their evidence. Our evaluation showed correct documents scoring ≥ 0.670 and off-topic questions ≤ 0.535, so 0.60 sits in the gap. The old default of 0.5 would have "grounded" every off-topic question.

**6. Citation integrity.** The model can write "[7]" when only five sources exist. `resolveCitations` drops any marker without a retrieved source *before saving*, and the database stores a snapshot of each cited passage. That's how "every citation corresponds to a real retrieved source" becomes a guarantee, not a hope.

**7. Retrieval metrics.** hit@k = how often the right document is in the top k. MRR (mean reciprocal rank) averages 1/rank of the right answer (1.0 = always first). Ours were perfect, but the questions were written alongside the guides, so real-world quality must come from logged similarities and user feedback.

**8. Server-sent events (SSE).** A one-way stream of `event:`/`data:` messages over normal HTTP. The browser's `EventSource` only supports GET without custom headers, so we use `fetch` with our auth token and parse the stream ourselves, including events split across network packets.

**9. Race conditions in limits.** "Count, then insert if under the limit" lets two simultaneous requests both see 2/3 and both insert. The database function takes a per-user advisory lock so the check and the insert happen as one step. Proven: 10 concurrent requests, limit 3, exactly 3 granted.

**10. Prompt injection.** Text in a document or a user message might say "ignore your rules". The system prompt treats SOURCES and messages as data, and the model can't do anything dangerous anyway: it only produces text, which we render safely.

**11. XSS-safe rendering.** AI output is rendered as React elements from a tiny Markdown subset, never as HTML, so `<script>` in an answer is just text.

**12. Safety design.** A crisis screen errs toward false positives (it even flags "suicide squeeze" in baseball), because missing someone at risk is far worse than showing support information by mistake. Crisis replies skip the model and never cost allowance. Helpline numbers still need human verification before launch.

## Bugs found, and how (great interview stories)

1. **Batch embeddings collapsed into one.** `gemini-embedding-2` returns a single embedding for a list of texts. A defensive count check in the embedder caught it before bad vectors could be stored, and we switched to `gemini-embedding-001`.
2. **Stop re-sent the question** (found only in a real browser). React reused the same `<button>` element and flipped it from `type="button"` to `type="submit"` while the click was still being processed, so the browser submitted the restored question. Fixed by giving the two buttons different `key`s.
3. **Server kept generating after Stop.** The disconnect arrived 56 ms in, before the "client left" listener was attached. The answer kept running and was charged to the user. Diagnosed from request logs; fixed by listening from the first line and checking for cancellation between steps (refund + clean-up). Two unit tests now pin this down.
4. **Slow completion.** Follow-up suggestions (a second model call) delayed the answer. They now arrive as a separate event after the answer is saved: 19.3 s → about 8.5 s total, with text visible after roughly 1.5 s.
5. **Misleading bundle number.** The "main chunk" shrank while total first-load JavaScript grew, because the bundler split shared code into more files. The budget now checks the real total (175 kB gzip, limit 185) and fails the build if exceeded; I verified that it fails.
6. **Overstated evidence.** "Based on 5 sources" was really 5 passages from 1 guide. The label now counts guides.

## Trade-offs

- **Stored citation snapshots** keep old answers readable after document edits, at the cost of some duplicated text.
- **Keyword crisis screen:** fast and free, but limited. A trained classifier plus a professionally reviewed policy is the production answer.
- **Streaming, then cleaning:** users may briefly see an invalid "[7]" that disappears when the answer completes. The alternative, buffering the whole answer, would hurt perceived speed.
- **Answers keep streaming if you navigate away**, which is better for users. Only Stop cancels.
- **AI-drafted starter content** keeps development unblocked, but it is clearly labelled and must be expert-reviewed before launch.

## How companies do this

- **Evaluation is a first-class artefact.** Teams keep "golden" question sets in the repo, run them in CI on every prompt or model change, and track metrics over time, plus offline review of real conversations with consent.
- **LLM observability.** Per-answer timings, token counts, retrieval scores and feedback go to dashboards (Langfuse, LangSmith, Datadog). We store these in `messages.metadata`.
- **Content governance.** Knowledge sources have owners, licences, review dates and an approval workflow (our `status: approved`); the admin portal arrives in Phase 5.
- **Safety review.** Mental-health and finance features go through legal and clinical review; crisis policies are written with professionals.
- **Cost control.** Per-user quotas, rate limits, caching, cheaper models for side tasks (like follow-ups), and alerts on spend.

## Likely interview questions

**Q: How do you stop the model making things up?**
A: Retrieval from a curated base, a threshold measured on evaluation data, a prompt that requires answering from numbered sources, server-side removal of citations that don't match retrieved passages, a visible "not based on EverGuide sources" label, and low temperature. Hallucination can't be eliminated, but it can be constrained and made visible.

**Q: How did you choose chunk size and threshold?**
A: Chunks follow document structure (one section, one idea). The threshold came from measurement: the evaluation script reports the gap between correct and off-topic similarities.

**Q: How do you enforce usage limits correctly?**
A: Server-side only, with an atomic database function using a per-user advisory lock; reservations are refunded on failure, timeout or cancellation. Tested under concurrency.

**Q: Why SSE and not WebSockets?**
A: Answers flow one way, server to client. SSE is plain HTTP: it works through proxies and load balancers, carries normal auth headers when used with fetch, and needs no extra infrastructure. WebSockets are for two-way, long-lived interaction.

**Q: Tell me about a bug unit tests didn't catch.**
A: The Stop button re-submitting the question: a timing interaction between React's DOM reuse and the browser's form activation. It only showed up in a real browser, which is why end-to-end tests matter.

## What I'd improve next
- Expert-reviewed, properly licensed content; an admin approval workflow (Phase 5).
- Hybrid search (keywords + vectors) and a reranker for larger knowledge bases.
- An LLM-as-judge evaluation of answer faithfulness, run in CI.
- A trained safety classifier, and verified, localised helpline data.
- A Playwright end-to-end suite in the repo (Phase 6).
