# Reader Profile: AI-Powered Reading Identity

## Problem Statement

Voracious readers accumulate hundreds of books but can't articulate their literary identity. What themes recur? What kind of reader are they? **bibliomnomnom should transform a book collection into a single, shareable artifact that captures who you are as a reader.**

## The ONE Thing

**A gorgeous, full-screen Reader Identity Card that people want to screenshot and share.**

Everything else is decoration. The card is the product.

## User Persona

### The Reflective Bibliophile
- **Context**: Has 20-500+ books tracked, reads regularly, values self-knowledge
- **Pain Point**: "I know I read a lot, but I can't articulate what I gravitate toward"
- **Goal**: A visual artifact that captures their literary identity
- **Success**: Shows friend the card; friend says "that's so you"

## Core Value Proposition

**Your reading history as a shareable identity.**

Not a dashboard. Not a stats page. An identity card — the kind of thing you'd put in a bio or share when someone asks "what do you read?"

## User Stories & Acceptance Criteria

### Story 1: View My Reader Profile
As a reflective bibliophile, I want to see my reader identity card so I understand and can share my literary identity.

**Acceptance Criteria**:
- [ ] Full-screen hero card dominates the view
- [ ] Card shows: name, avatar, 3-4 key stats, AI-generated taste tagline
- [ ] Scroll reveals: stats grid, AI insight cards
- [ ] Requires minimum 20 books (encouraging message below threshold)
- [ ] Generated on-demand with delightful loading animation (< 60s)
- [ ] Clear error states with retry/fallback options

### Story 2: Share My Reader Profile
As a reflective bibliophile, I want to share my profile so others understand my literary taste.

**Acceptance Criteria**:
- [ ] ONE button: "Share" → toggles profile public
- [ ] Preview modal shows exactly what others will see
- [ ] Public URL: `/readers/[username]` (clean, memorable)
- [ ] Open Graph meta for rich social previews
- [ ] To "unshare": flip toggle back to private
- [ ] Warning if revoking: "This will break existing shared links"

### Story 3: Graceful Sparse Data Handling
As a new user, I want to understand why I can't see my profile yet so I'm motivated to add more books.

**Acceptance Criteria**:
- [ ] < 20 books: Progress bar showing "X/20 books to unlock your Reader Profile"
- [ ] 20-49 books: Full stats, AI sections with confidence disclaimer
- [ ] 50+ books: Full profile with speculative insights
- [ ] Never generate nonsense insights from insufficient data

## Data Thresholds

| Books | What's Available |
|-------|------------------|
| 0-19 | "Add X more books to unlock" + progress bar |
| 20-49 | Stats + Literary Taste + Themes (with "early insights" label) |
| 50+ | Full profile including speculative insights |

## Profile Content

### The Hero Card (The Product)
- User name + avatar
- 3-4 headline stats (books read, pages, reading pace)
- AI-generated taste tagline: "A reader drawn to [X] who explores [Y]"
- Visually stunning — magazine cover quality
- Fixed aspect ratios: 1.91:1 (Twitter/OG) + 1:1 (Instagram)

### Stats Grid (Below Fold)
Pick 5, no more:
- Total books read (number + trend sparkline)
- Pages read (with audiobook equivalent)
- Fiction/Nonfiction ratio (simple bar)
- Reading pace (books/month average)
- Favorite authors by volume (top 3)

### AI Insight Cards (3 Max)
1. **Literary Taste**: Genre tendencies, mood preferences, complexity level
2. **Thematic Connections**: Recurring themes, subject clusters
3. **Reading Evolution**: How taste has shifted (if 2+ years of data)

No more than 3 cards. Quality over quantity.

## UX Flow

```
/profile (single page)
│
├── Hero: Full-screen Reader Identity Card
│   ├── Name, avatar, headline stats
│   ├── AI taste tagline
│   ├── [Share] button (toggles public)
│   └── "Last updated [time]" footer
│
├── Stats Grid (scroll to reveal)
│   └── 5 metric cards with micro-visualizations
│
├── AI Insights (scroll more)
│   └── 3 editorial-styled content cards
│
└── Footer
    └── "Based on X books" + regenerate option
```

### Key States

**Generating (First Visit or Stale)**:
```
"Analyzing your library..."
[Delightful loading animation - books turning pages, etc.]
"Usually takes 30-60 seconds"

After 90s: "Taking longer than expected... still working"
After 3min: "Generation failed. [Retry] [Contact Support]"
```

**Below Threshold (<20 books)**:
```
"Your Reader Profile awaits!"
[Progress: 12/20 books]
"Add 8 more books to unlock AI-powered insights about your reading patterns."
[Add a Book]
```

**Share Preview Modal**:
```
"This is what others will see:"
[Preview of public card]

Public profile includes:
✓ Books read count, reading pace
✓ AI taste profile and themes
✓ Top genres (aggregated)

Never shared:
✗ Individual book titles
✗ Notes and quotes
✗ Reading dates

[Cancel] [Make Public]
```

## Visual Design

**Aesthetic**: Editorial magazine meets identity card. Think "The New Yorker" contributor bio meets Spotify Wrapped hero.

**The Card**:
- Typography-forward: Large Crimson Text heading
- Generous whitespace
- Subtle texture (paper grain)
- Name + avatar prominent
- Stats as elegant data points, not chart vomit
- Taste tagline as pull quote

**Animation**:
- Fade-in on load
- Number counters animate up
- Subtle parallax on scroll
- Respect `prefers-reduced-motion`

**Accessibility**:
- All charts have text alternatives (sr-only data tables)
- Color not sole differentiator (patterns + labels)
- 44x44px minimum touch targets
- High contrast mode support

## Generation Approach

**On-Demand, Not Cron**:
- User visits `/profile` → check if stale (>7 days + new books)
- If stale: generate NOW with loading animation
- Cache result in Convex
- No background jobs, no cron complexity

**LLM Strategy**:
- Send: titles, authors, descriptions (not notes — privacy)
- Token budget: ~2000 tokens input, ~500 output
- Prompt: Few-shot with example literary analyses

**Model Selection (OpenRouter, December 2025)**:

| Tier | Model | Cost/1M (in/out) | Context | Use Case |
|------|-------|------------------|---------|----------|
| **Primary** | Gemini 3 Flash Preview | $0.50 / $3.00 | 1M | Default — near-Pro quality at 1/4 cost |
| **Premium** | Gemini 3 Pro Preview | $2.00 / $12.00 | 1M | Future paid tier, #1 LMArena |
| **Budget** | DeepSeek V3.2 | $0.22 / $0.32 | 164K | 10x cheaper, IMO gold medal performance |
| **Fallback** | GPT-5.2 | $1.75 / $14.00 | 400K | If Google unavailable |
| **Cheapest** | Qwen3 235B | $0.18 / $0.54 | 131K | Extreme cost optimization |

**Recommendation**: Start with **Gemini 3 Flash Preview** — latest Google model (Dec 17, 2025), near-Pro quality, 1M context (fits 500+ books easily), excellent reasoning. Fallback to DeepSeek V3.2 if costs spike (10x cheaper). Consider Gemini 3 Pro Preview for future premium tier.

**Cost Estimate** (500 books, ~2K input tokens, ~500 output tokens):
- Gemini 3 Flash: $0.001 + $0.0015 = ~$0.0025 per profile
- DeepSeek V3.2: $0.00044 + $0.00016 = ~$0.0006 per profile
- At 1,000 users: $2.50/month (Gemini) or $0.60/month (DeepSeek)
- At 100,000 users: $250/month (Gemini) or $60/month (DeepSeek)

**Error Handling**:
```
Rate Limit (429): "High demand. Try again in a few minutes."
Context Too Large (500+ books): "Large library! Analysis may take 2-3 minutes."
API Outage: "Analysis temporarily unavailable. Showing cached profile."
Generic Failure: "Something went wrong. [Retry]"
```

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Profile generation rate | 50% of users with 20+ books | Core engagement |
| Time on profile page | >45 seconds | Indicates interest |
| Share toggle rate | 15% of profile visitors | Social willingness |
| Return visits (7 day) | 30% | Retention signal |

## Non-Goals (Explicit)

What we are NOT building:

- **Monthly digests** — cut entirely (feature bloat)
- **Yearly wrapped** — defer to December 2025 as one-time event
- **Recommendations engine** — insights only, no "add to library" flows
- **Comparison with other users** — no "you read more than X%" stats
- **Reading goals/challenges** — separate feature
- **Privacy toggles per-field** — simple public/private binary
- **Real-time updates** — regenerate on visit if stale, not live

## Open Questions for Architecture

1. **Username System**: Need usernames for `/readers/[username]` URLs. Add to user schema?
2. **LLM Model**: Gemini 3 Flash Preview recommended (see Model Selection above). Validate quality for literary analysis.
3. **Report Storage**: Single JSON blob in Convex? Structured fields?
4. **Image Generation**: How to render shareable card as static image for OG? Canvas? Puppeteer? Vercel OG?
5. **Rate Limiting**: How to handle user spamming regenerate button? Cooldown period?
6. **Model Fallback**: Implement automatic fallback chain (Gemini → DeepSeek → Qwen) on errors?

## Future Considerations (Post-MVP)

These are explicitly DEFERRED, not planned:

- **Yearly Wrapped**: December 2025 event, validate interest first
- **Comparison features**: "Readers like you also enjoyed..."
- **Premium tier**: If LLM costs justify paywall
- **Mobile share formats**: Instagram Stories (9:16), TikTok

---

## Reviewer Feedback Incorporated

**From Jobs Review**:
- Cut monthly digests ✓
- Deferred yearly wrapped ✓
- Single page, card-first ✓
- On-demand generation ✓
- 20 book minimum ✓
- Simplified privacy ✓

**From UX Review**:
- Explicit error states ✓
- Data thresholds by book count ✓
- Share preview modal ✓
- Revocation warning ✓
- Accessibility requirements ✓

**From Product Review**:
- Positioned as retention, not growth ✓
- Acknowledged weak viral mechanics ✓
- Realistic metrics ✓
- Validation recommended before full build ✓

---

**Next Step**: Run `/architect` to design the technical implementation.
