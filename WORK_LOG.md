# Work Log: Reader Profile Feature

## Progress
- [x] Schema: Add readerProfiles table + username field on users
- [x] Backend: convex/profiles.ts (queries + mutations)
- [x] Backend: convex/actions/profileInsights.ts (LLM generation)
- [x] Backend: lib/ai/models.ts (add profile model constant)
- [x] Frontend: components/profile/* (UI components)
- [x] Frontend: app/(dashboard)/profile/page.tsx (private profile)
- [x] Frontend: app/readers/[username]/page.tsx (public profile)
- [x] API: app/api/og/profile/route.tsx (OG images)
- [x] Navigation: Added profile link to Masthead
- [ ] Tests: Unit tests for stats computation (deferred)
- [x] Integration: Build verified, types checked

## Files Created

### Backend (Convex)
- `convex/schema.ts` - Added readerProfiles table and username field
- `convex/profiles.ts` - Full module with queries/mutations:
  - `getStats` - Fresh stats computation
  - `get` - Get own profile with status
  - `getPublic` - Public profile by username
  - `checkUsername` - Username availability
  - `generateProfile` - Create/regenerate profile
  - `togglePublic` - Share toggle
  - `updateUsername` / `updateDisplayName` - Profile updates
- `convex/actions/profileInsights.ts` - LLM generation action with fallback chain

### Frontend (React)
- `components/profile/ProfilePage.tsx` - Main container with all states
- `components/profile/ProfileHero.tsx` - Hero card (the product)
- `components/profile/ProfileStats.tsx` - Stats grid
- `components/profile/ProfileInsights.tsx` - AI insight cards
- `components/profile/ProfileThreshold.tsx` - Below 20 books state
- `components/profile/ProfileSkeleton.tsx` - Loading states
- `components/profile/ShareModal.tsx` - Share dialog
- `components/profile/PublicProfile.tsx` - Public view
- `components/profile/index.ts` - Barrel exports

### Routes
- `app/(dashboard)/profile/page.tsx` - Private profile route
- `app/readers/[username]/page.tsx` - Public profile route with OG metadata
- `app/api/og/profile/route.tsx` - OG image generation

### Lib
- `lib/ai/models.ts` - Added DEFAULT_PROFILE_MODEL and fallback chain

## Decisions Made
- Used Gemini 3 Flash Preview as primary model (cost-effective, good quality)
- Fallback chain: Gemini → DeepSeek → Qwen for resilience
- 20 book minimum for profile unlock
- 50 book minimum for full insights (reading evolution)
- 7-day + 5 book delta staleness detection
- 5-minute cooldown on regeneration
- Structured Convex storage (not JSON blob)

## Blockers
(None - implementation complete)

## Next Steps
1. Test the full flow manually in dev
2. Add unit tests for stats computation (optional)
3. Consider adding username editing UI
4. Monitor LLM costs in production
