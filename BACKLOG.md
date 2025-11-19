# BACKLOG.md - bibliomnomnom Post-MVP Features

**Version:** 1.0
**Last Updated:** 2025-11-07

This document contains features, enhancements, and ideas for **post-MVP** development of bibliomnomnom. All items here are explicitly **NOT** in the initial MVP scope but represent the future vision for the platform.

---

## Priority System

- **P1 (High)**: Critical for product-market fit, should be next after MVP
- **P2 (Medium)**: Important improvements, plan for 3-6 months post-MVP
- **P3 (Low)**: Nice-to-have enhancements, 6-12 months post-MVP
- **P4 (Future)**: Interesting ideas, no immediate timeline

---

## Engineering Health (P1-P2)

### Auth-Safe Dashboard Shell
**Priority:** P1  
**Why:** Streaming layouts currently render dashboard chrome before Clerk finishes redirecting, so Convex hooks fire while the session is missing and blow up the page.  
**What:** Wrap `app/(dashboard)` routes in a shared shell that uses Clerk’s `<SignedIn>/<SignedOut>` boundaries (or a server loader) so child components never mount until a user session + Convex identity exist. Provide a consistent signed-out placeholder instead of component-level hacks.  
**Outcome:** Prevents wasted renders, removes auth plumbing from individual components, and keeps future dashboards from repeating the `Unauthenticated` regressions we just fixed piecemeal.

### Auto-Provision Convex Users
**Priority:** P1  
**Why:** `requireAuth` throws “User not found in database” whenever Clerk webhooks lag or fail, taking down every query/mutation even though the client is signed in.  
**What:** Extend `requireAuth` to upsert a user record on-demand from `ctx.auth.getUserIdentity()` (or queue a background sync) when the Clerk ID is missing. Log when this fallback runs so we can alert on webhook failures.  
**Outcome:** Eliminates a class of hard-to-debug auth errors and keeps the app usable even if background provisioning misfires, improving overall resilience.

---

## Phase 1: AI & Intelligence (P1)

The AI features that will transform bibliomnomnom from a book tracker to an intelligent reading companion.

### Embeddings & Vector Search
**Priority:** P1
**Dependencies:** MVP complete, user data collected

**Features:**
- Generate embeddings for all book metadata (title, author, description)
- Generate embeddings for all user content (notes, quotes, reflections)
- Store embeddings in Convex vector index
- Enable semantic similarity search

**Use Cases:**
- "Find books similar to this one" (semantic, not keyword matching)
- "Show me all my thoughts about loneliness" (across all books)
- "What books discuss similar themes to my favorite books?"

**Technical Approach:**
- OpenAI `text-embedding-3-small` or `text-embedding-ada-002`
- Convex vector search with filters
- Background job to generate embeddings for existing content
- Real-time embedding generation for new content

**User Stories:**
- As a reader, I can search my library by concepts, not just titles
- As a reader, I can discover connections between books I didn't notice
- As a reader, I can find books that resonate with specific themes

---

### Semantic Search Across Library
**Priority:** P1
**Dependencies:** Embeddings infrastructure

**Features:**
- Natural language search: "books about grief and healing"
- Search across all content: books, notes, quotes, reflections
- Relevance-ranked results
- Highlight matching passages
- Filter by content type

**UI/UX:**
- Global search bar (⌘K shortcut)
- Instant results as you type
- Preview snippets with highlights
- Click to jump to full context

**Technical Requirements:**
- Convex vector search actions
- Cosine similarity ranking
- Context window extraction
- Real-time index updates

---

### Auto-Tagging & Theme Extraction
**Priority:** P1
**Dependencies:** LLM integration

**Features:**
- Automatically extract themes from book descriptions
- Extract topics from user's notes and reflections
- Generate tags from quotes
- Suggest tags as you write
- Tag cloud visualization

**Example Tags:**
- Themes: "grief", "identity", "coming-of-age", "political philosophy"
- Genres: "literary fiction", "memoir", "popular science"
- Moods: "contemplative", "urgent", "lyrical"
- Topics: "climate change", "mental health", "artificial intelligence"

**Technical Approach:**
- LLM prompts for tag extraction
- Few-shot learning with examples
- Batch processing for existing content
- User can accept/reject/edit suggestions

**User Stories:**
- As a reader, tags are automatically suggested based on my notes
- As a reader, I can see all books tagged with "existentialism"
- As a reader, I discover patterns in my reading I didn't notice

---

### Reading Pattern Insights
**Priority:** P1
**Dependencies:** Sufficient user data (50+ books)

**Features:**
- **Theme Analysis**: "You've been exploring themes of identity, belonging, and diaspora"
- **Genre Distribution**: Visualize your reading across genres
- **Author Patterns**: "You've read 3 books by Octavia Butler this year"
- **Evolution Over Time**: "Your reading has shifted toward non-fiction"
- **Reading Pace**: Books per month, pages per day
- **Completion Rate**: Percentage of books you finish

**UI/UX:**
- Dashboard with beautiful data visualizations
- Monthly/yearly insights
- Shareable reading wrapped (like Spotify Wrapped)
- Natural language summaries

**Technical Approach:**
- Convex aggregation queries
- Time-series analysis
- LLM-generated narrative summaries
- Chart.js or Recharts for visualizations

---

### AI-Powered Recommendations
**Priority:** P1
**Dependencies:** Embeddings, reading patterns, LLM integration

**Four Types of Recommendations:**

#### 1. Deeper Dive
"Based on your love of 'Thinking, Fast and Slow', here are more books on cognitive psychology and decision-making"
- Same topic, greater depth
- Academic → Popular science progression
- Classic foundational texts

#### 2. Adjacent Topics
"You've been reading about climate science. You might enjoy books on environmental philosophy or sustainable living"
- Related but distinct topics
- Natural conceptual bridges
- Expand knowledge boundaries

#### 3. Complementary Perspectives
"You loved 'Educated'. Try 'The Glass Castle' for another powerful memoir of overcoming adversity"
- Similar themes, different contexts
- Diverse voices on shared experiences
- Balance in perspectives

#### 4. Totally Different
"Your library is heavy on non-fiction. Surprise yourself with 'The Overstory', literary fiction about trees and activism"
- Break patterns
- Discover new genres
- Serendipitous joy

**Technical Approach:**
- Hybrid: collaborative filtering + semantic similarity + LLM reasoning
- Explain *why* each recommendation
- User feedback loop (helpful/not helpful)
- Continuously improve with usage

**User Stories:**
- As a reader, I get personalized recommendations that feel thoughtful
- As a reader, I understand *why* a book is recommended
- As a reader, I discover books I'd never find through algorithms alone

---

### Auto-Generated Summaries & Syntheses
**Priority:** P2
**Dependencies:** LLM integration, user notes

**Features:**
- **Book Summary**: Auto-generate from user's notes and quotes
- **Theme Synthesis**: "Across these 5 books, you've explored..."
- **Reading Session Summary**: "This week you read about..."
- **Yearly Synthesis**: "In 2025, your reading journey covered..."

**Use Cases:**
- Quick refresher on a book you read months ago
- Share your synthesis with others
- Understand your intellectual journey
- Export for personal knowledge management

**Technical Approach:**
- GPT-4 or Claude for high-quality summaries
- Context window with all notes/quotes
- User can edit generated content
- Save summaries as special note type

---

### AI-Generated Book Covers
**Priority:** P2
**Dependencies:** Image generation API, design system

**Features:**
- Generate custom covers using AI (DALL-E, Midjourney, Stable Diffusion)
- Prompt: book title, author, themes, user's notes
- Multiple style options (minimalist, illustrative, photographic, abstract)
- Regenerate until satisfied
- Save generated covers to library

**Use Cases:**
- Books without good covers
- Personalized covers reflecting your interpretation
- Public domain books needing fresh designs
- Make your library visually cohesive

**UI/UX:**
- "Generate Cover" button on book page
- Style selector
- Preview before saving
- Cost consideration (API costs)

**Technical Approach:**
- DALL-E 3 or Midjourney API
- Prompt engineering for consistent style
- Vercel Blob storage for generated images
- Cache generations to avoid regeneration costs

---

## Phase 2: Analytics & Visualization (P2)

Beautiful, insightful data about your reading life.

### Reading Statistics Dashboard
**Priority:** P2
**Dependencies:** Sufficient usage data

**Metrics:**
- **Books Read**: Total, this year, this month
- **Pages Read**: Total, average per book, per day
- **Reading Pace**: Days per book, books per month
- **Completion Rate**: Percentage of started books finished
- **Reread Rate**: Percentage of books reread
- **Audiobook vs. Physical**: Distribution
- **Favorite Rate**: Percentage marked as favorites
- **Reading Streaks**: Consecutive days/weeks reading

**Visualizations:**
- Line chart: Books over time
- Bar chart: Books by genre/theme
- Heatmap: Reading activity calendar
- Pie chart: Fiction vs. non-fiction
- Timeline: Reading journey
- Word cloud: Most common themes

**User Stories:**
- As a reader, I see beautiful visualizations of my reading life
- As a reader, I understand my reading patterns
- As a reader, I can share my stats

---

### Author & Publisher Analytics
**Priority:** P3

**Features:**
- Most-read authors
- Author diversity analysis (gender, nationality, era)
- Publisher distribution
- Publication year distribution
- Language statistics (if multilingual)

**Insights:**
- "You've read 12 books by women authors this year (+40% from last year)"
- "Your library spans 8 decades of literature"
- "You primarily read books published after 2010"

---

### Reading Goal Tracking
**Priority:** P2

**Features:**
- Set annual reading goal (number of books)
- Track progress with visual progress bar
- Projection: "At this pace, you'll read 52 books this year"
- Milestones: Celebrate 25, 50, 100 books
- Custom goals: pages, genres, authors

**Gamification (optional):**
- Badges: "First 10 books", "Completed 50 books", "Read 5 classics"
- Streaks: "7-day reading streak"
- Challenges: "Read a book from each continent"

---

### Export & Reporting
**Priority:** P2

**Features:**
- Export library to JSON, CSV
- Export reading report (PDF)
- Yearly reading report (beautiful PDF)
- Data portability (download all user data)

**Use Cases:**
- Backup personal data
- Migrate to other tools
- Share reading report
- Data ownership

---

## Phase 3: Social & Community (P2-P3)

Features that enable connection while respecting privacy.

### Public User Profiles
**Priority:** P2
**Dependencies:** Privacy controls solid

**Features:**
- Public profile page: `/users/[username]`
- Customizable username
- Bio and profile photo
- Public books displayed
- Reading stats (if user chooses to share)

**Privacy Controls:**
- Profile entirely private (default)
- Profile public but only show selected books
- Profile public with all public books

---

### Following & Activity Feeds
**Priority:** P2

**Features:**
- Follow other readers
- Activity feed: "Jane marked 'Dune' as read", "John added a reflection to 'Sapiens'"
- Filter by followed users
- Discover users by shared books/interests

**Privacy:**
- Only show activities for public books
- User can disable activity sharing
- Unfollow anytime

---

### Collections & Lists
**Priority:** P2

**Features:**
- Create custom collections: "Summer 2025 Reads", "Climate Fiction", "To Gift"
- Add books to multiple collections
- Share collections publicly
- Collaborative lists (with invited users)

**Use Cases:**
- "Books that changed my life"
- "Recommendations for my book club"
- "Books about AI I've read"

---

### Book Clubs & Group Reading
**Priority:** P3

**Features:**
- Create book club groups
- Invite members
- Choose current book
- Shared discussion space
- Member reading progress

**Possible Features:**
- Discussion threads
- Meeting scheduler
- Reading pace suggestions
- Book selection polls

---

### Comments & Discussions
**Priority:** P3

**Features:**
- Comment on public book pages
- Reply to comments
- React to notes/quotes
- Respectful, moderated discussions

**Moderation:**
- Report inappropriate comments
- Block users
- Admin moderation tools

---

## Phase 4: Enhanced Features (P2-P3)

Features that make the core experience even better.

### Advanced Search & Filtering
**Priority:** P2

**Features:**
- Advanced filters: date range, page count, audiobook, favorite
- Sort by: date added, date read, title, author, page count
- Save search queries
- Bulk operations: "Mark all books by X as favorites"

---

### Reading Reminders & Nudges
**Priority:** P3

**Features:**
- Reminder: "You started reading this book 3 weeks ago"
- Nudge: "You haven't read in 5 days"
- Customizable reminder frequency
- Disable reminders per book or globally

---

### Book Lending Tracker
**Priority:** P3

**Features:**
- Track books lent to friends
- Record who borrowed, when
- Reminder to return
- Note book condition

**Use Cases:**
- "I lent this to Sarah on June 1st"
- "Reminder: Get book back from Mike"

---

### Series & Saga Management
**Priority:** P3

**Features:**
- Group books into series
- Track reading order
- Mark series progress
- Display series on library view

**Examples:**
- "The Lord of the Rings" (3 books)
- "Dune Chronicles" (6 books)
- "Discworld" (41 books!)

---

### Multiple Editions
**Priority:** P3

**Features:**
- Track multiple editions of same book
- Mark which edition read
- Compare editions
- Link editions together

**Use Cases:**
- Original vs. translation
- Audiobook vs. physical vs. ebook
- Annotated editions

---

### Book Condition Tracking
**Priority:** P4

**Features:**
- Track condition: mint, good, fair, poor
- Note condition details
- Track repairs/restoration
- For book collectors

---

### Import from Goodreads/CSV
**Priority:** P2

**Features:**
- Import library from Goodreads export
- Import from CSV
- Map fields automatically
- Preview before import
- Handle duplicates

**Goodreads Fields:**
- Title, author, ISBN, date read, rating, review
- Convert star rating to favorite flag
- Import shelves as collections

---

## Phase 5: Technical Enhancements (P2-P3)

Improvements to performance, accessibility, and developer experience.

### Progressive Web App (PWA)
**Priority:** P2

**Features:**
- Install as app on mobile/desktop
- Offline reading of synced content
- Background sync when online
- Push notifications (optional)

**Use Cases:**
- Read notes offline
- Add books without internet
- Native app feel

---

### Dark Mode
**Priority:** P2

**Features:**
- System preference detection
- Manual toggle
- Preserve across sessions
- Beautiful dark color palette (warm, not stark)

**Design:**
- Not pure black, warm dark tones
- Maintain sepia/bibliophile aesthetic
- Adequate contrast for readability

---

### Keyboard Shortcuts
**Priority:** P3

**Features:**
- ⌘K: Global search
- ⌘N: Add new book
- ⌘E: Edit current book
- ⌘F: Toggle favorite
- Esc: Close modals
- Arrow keys: Navigate library

**Accessibility:**
- Shortcuts discoverable (? key for help)
- Don't conflict with browser shortcuts
- Customizable

---

### Mobile App (Native)
**Priority:** P3

**Features:**
- Native iOS app (Swift/React Native)
- Native Android app (Kotlin/React Native)
- Barcode scanner for ISBN
- Photo capture for custom covers
- Push notifications

**Considerations:**
- Development cost vs. benefit
- Maintenance burden
- Web app may be sufficient with PWA

---

### API for Third-Party Integrations
**Priority:** P3

**Features:**
- REST or GraphQL API
- API keys for users
- Rate limiting
- Webhooks for events
- Documentation

**Use Cases:**
- Integrate with Notion, Obsidian
- Build custom analytics tools
- Automate workflows
- Third-party app ecosystem

---

### Performance Optimizations
**Priority:** P2 (ongoing)

**Improvements:**
- Image optimization (WebP, lazy loading)
- Code splitting & lazy loading
- CDN for static assets
- Database query optimization
- Caching strategies
- Bundle size reduction

**Targets:**
- LCP < 1s
- FID < 100ms
- CLS < 0.1
- Lighthouse score > 95

---

### Accessibility (A11y)
**Priority:** P2

**Features:**
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast compliance (WCAG AA)
- Alt text for images

**Testing:**
- axe DevTools
- Lighthouse accessibility audit
- Manual screen reader testing

---

## Phase 6: Advanced Integrations (P3-P4)

Ambitious integrations that expand the product's capabilities.

### Ebook Integration
**Priority:** P3

**Features:**
- Upload EPUB files
- In-browser EPUB reader
- Sync reading position
- Highlight and annotate within ebook
- Auto-create notes from highlights

**Considerations:**
- File storage costs (Vercel Blob)
- Legal considerations (DRM)
- Complex to build

---

### Audiobook Integration
**Priority:** P3

**Features:**
- Integrate with Audible, Libro.fm, Spotify
- Import listening history
- Sync progress
- Track listening time

**Challenges:**
- API availability
- Authentication complexity
- Terms of service compliance

---

### Library & Bookstore Integrations
**Priority:** P3

**Features:**
- "Find at your local library" (Libby, OverDrive)
- "Buy from independent bookstore" (Bookshop.org)
- Affiliate links (ethical monetization)

**Use Cases:**
- Discover where to get a book
- Support local businesses
- Ethical alternative to Amazon

---

### Citation Export
**Priority:** P4

**Features:**
- Export quotes with citations
- Multiple citation formats (MLA, APA, Chicago)
- Bibliography generation
- Zotero integration

**Use Cases:**
- Academic research
- Writing references
- Sharing quotes with attribution

---

## Phase 7: Monetization (P3-P4)

Sustainable business model options (if needed).

### Freemium Model
**Priority:** P3 (if monetization needed)

**Free Tier:**
- 100 books
- Basic notes/quotes
- Public sharing

**Premium Tier ($5-10/month):**
- Unlimited books
- AI features (recommendations, insights)
- Advanced analytics
- Priority support
- Export features
- AI-generated covers

---

### One-Time Purchase
**Priority:** P3

**Option:**
- Pay once, own forever
- $30-50 lifetime access
- All features unlocked
- Support indie development

---

### Patronage / Donations
**Priority:** P3

**Option:**
- Keep free for all
- Optional donations (Ko-fi, Patreon)
- Recognize supporters
- Community-funded development

---

## Ideas & Experiments (P4)

Interesting concepts to explore in the future.

### AI Reading Buddy
- Conversational AI that knows your library
- "What should I read next?"
- "Remind me what happened in this book"
- "Find me a quote about hope"

### Reading Challenges
- "Read 12 genres in 12 months"
- "Read books from 6 continents"
- "Read 5 classics this year"
- Community challenges

### Book Swapping
- Lend books to other users
- Physical book exchange
- Local meetups
- Shipping coordination

### Reading Journeys
- Visualize reading evolution over time
- Themes that emerged across years
- Intellectual autobiography

### Mood-Based Recommendations
- "I'm feeling melancholy, suggest a book"
- Match books to emotional needs
- Comfort reads vs. challenging reads

### Book-to-Book Navigation
- Graph view of connections between books
- Visual network of your library
- Click to navigate related books

### Multi-Language Support
- Interface translation
- Books in multiple languages
- Reading across languages statistics

### Reading Time Estimation
- "This book will take approximately 8 hours to read"
- Based on page count and your reading pace
- Audiobook duration integration

---

## Rejected Ideas

These ideas were considered but deliberately rejected:

### ❌ Star Ratings
**Why rejected:** Reductive, doesn't capture nuance, user explicitly wants better alternative

### ❌ Social Network Features (Likes, Comments Everywhere)
**Why rejected:** Maintain focus on personal reading garden, not social media noise

### ❌ Algorithmic Feed
**Why rejected:** Anti-pattern, user controls their experience

### ❌ Ads
**Why rejected:** Ruins experience, misaligns incentives

### ❌ Data Selling
**Why rejected:** Ethical violation, privacy commitment

---

## Deferred From MVP

- [ ] External book search/import (Google Books or similar) with API-backed modal

---

## Contribution Ideas

If opening to community contributions:

- [ ] Book API integrations (Goodreads, LibraryThing)
- [ ] Translation support
- [ ] Theme variations
- [ ] Custom export formats
- [ ] Third-party integrations
- [ ] Mobile app development
- [ ] Performance optimizations

---

## Research & Exploration

Areas to investigate before implementing:

- **LLM costs**: Estimate costs for recommendation engine
- **Vector DB**: Convex vs. Pinecone vs. Qdrant for scale
- **Image generation**: Cost-effectiveness of AI covers
- **Privacy regulations**: GDPR, CCPA compliance for user data
- **Accessibility**: Best practices for inclusive design
- **Ebook formats**: EPUB, MOBI, PDF handling
- **API rate limits**: Google Books, Open Library limitations

---

## Dependencies & Sequencing

**Must happen before AI features:**
- MVP launched
- 50+ users with meaningful data
- Embedding infrastructure tested
- LLM API costs understood

**Must happen before social features:**
- Privacy controls battle-tested
- Moderation strategy defined
- Community guidelines written

**Must happen before mobile app:**
- Web app proven product-market fit
- Budget for native development

---

## Long-Term Vision

**Year 1:** Beautiful, private book tracker that people love
**Year 2:** Intelligent reading companion with AI insights
**Year 3:** Thriving community of thoughtful readers
**Year 5:** The de facto tool for serious bibliophiles

---

**This backlog is living document. As we learn from users, priorities will shift. Stay nimble. Ship value. Delight readers. 📚✨**
