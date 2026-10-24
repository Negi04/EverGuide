# EverGuide knowledge base (starter set)

These Markdown files are the documents the AI Guide retrieves and cites. Each file starts
with front matter describing the document:

```yaml
---
slug: choosing-a-career-path          # unique, lowercase, hyphens
title: Choosing a career or study path
domain: career                        # career | interview | mental_wellness | physical_wellness | finance | personal_development
source_name: EverGuide starter guide (AI-drafted, pending expert review)
source_url:                           # optional, https only
license: EverGuide original content
status: approved                      # draft | approved | archived — only approved documents are searched
---
```

**Important:** the starter guides were drafted with AI assistance and have not been reviewed
by a qualified expert. Replace or review them before inviting real users, and only add
material you have the right to use.

Load or update them with `npm run kb:ingest -w @everguide/server`. Unchanged files are skipped.
