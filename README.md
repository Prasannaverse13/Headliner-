# Headliner

**An AI tour planning agent powered by Qloo's Taste AI. Type an artist or comedian and watch a 3D Earth light up with the best tour, built from real taste data.**

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/) ("Agents, but with taste").
Deadline: **Oct 30, 2026, 11:45pm EDT**.

---

## 1. The one line pitch

Promoters guess where to tour. Headliner uses Qloo's taste graph to show where fans really are, who should open, which brands should sponsor, and what to eat nearby. All on a spinning globe.

## 2. The problem

- Touring is a multi million dollar bet. Cities are picked by past ticket sales and gut feel.
- Past sales only show where an act already plays. They miss cities with high taste demand and no show yet.
- Sponsors, openers, venues and local marketing are planned in separate tools by separate people.
- A plain LLM cannot fix this. It has no live cultural data. It guesses.

## 3. The solution

An agent that takes one input (an artist, comedian or band) and returns a full tour plan:

1. **Fan taste profile** from Qloo (what else do their fans love: music, film, food, fashion, brands, podcasts).
2. **Untapped demand cities** from Qloo location and heatmap signals. High affinity and no tour stop yet.
3. **Best opener** per city. Picked by audience overlap, not by genre label.
4. **Sponsor matches.** Local and global brands whose fans match the act.
5. **VIP and fan experience plan.** Restaurants, bars and venues near each show that match the fan taste.
6. **City specific ad copy.** Written by an LLM using what locals in that city love.
7. **Explainability.** Every pick shows its Qloo score and the reason.

All of it is drawn live on a **3D globe** with glowing arcs between tour stops.

## 4. Why judges should care

Judging criteria from Devpost and how Headliner answers each:

| Criteria | Our answer |
|---|---|
| Technological Implementation | Uses many Qloo features together: search, insights, audiences, tags, location signals. Agent loop with tool calls. Works end to end. |
| Design | Full product feel. Globe, stop cards, explain panel, export. Not a proof of concept. |
| Potential Impact | Real B2B market: promoters, agents, venues, sponsors. |
| Quality of the Idea | Qloo used for demand discovery and sponsor matching, not just "recommend me a movie". |

Judges: Jason Calacanis (investor, offers $25k extra to his favorite), Mike Diolosa (Qloo CTO), Nicole Seligman (OpenAI board), Todd Boehly (Eldridge, owns Chelsea and Dodgers), Cedric the Entertainer, Michael Abrams (Live Nation). The pitch speaks to live events, sports, entertainment and startup investing.

Prizes: $15k first, $6k second, $4k third, plus $25k from Calacanis.

## 5. Hackathon required submission items

Do not miss any of these or the entry may not qualify.

- [ ] Live functional demo link that judges can use end to end (hosted, not local)
- [ ] Public repo (GitHub) with all source, assets and run instructions
- [ ] Text description: what it does and what makes it "Qloo powered"
- [ ] Hosted on the web (Vercel)
- [ ] Open source license file (MIT) visible in the repo About section
- [ ] Demo video is optional but a 2 min video helps

## 6. Product experience (what the user sees)

1. **Landing screen.** Dark space theme. A slowly spinning Earth. One search bar: "Who is going on tour?"
2. **Type an artist.** Example: "Kendrick Lamar", "Dave Chappelle", "Coldplay".
3. **Globe flies to home city.** Camera glides in.
4. **Heat layer.** Hotspots glow where fan taste demand is high.
5. **Agent trace panel.** Live step list: "Reading fan taste...", "Scanning 120 cities...", "Picking openers..." Shows the agent is real.
6. **Tour arcs draw one by one.** Each stop pulses.
7. **Click a stop.** Side card opens:
   - City and suggested venue type
   - Demand score (Qloo)
   - Best opener and overlap %
   - Top 3 sponsor brands and why
   - Food and nightlife picks for VIP
   - Local ad copy
   - "Why this city" explanation
8. **Controls.** Tour length (5, 10, 20 stops), region filter, budget tier, genre of opener.
9. **Export.** Download PDF tour brief. Share link.

## 7. Architecture

```
Browser (Next.js + globe.gl)
   |
   |  POST /api/plan  { artist, stops, region }
   v
Next.js API route (agent orchestrator)
   |
   |-- OpenAI model (tool calling agent loop)
   |       tools:
   |         search_entity(name)           -> Qloo Search
   |         get_fan_profile(entityId)     -> Qloo Insights / Tags / Audiences
   |         find_demand_cities(entityId)  -> Qloo Insights with location signal
   |         find_openers(entityId, city)  -> Qloo Insights (same type, overlap)
   |         find_brands(entityId, city)   -> Qloo Insights (brand type)
   |         find_places(city, tasteTags)  -> Qloo Insights (place type)
   |         write_ad_copy(city, taste)    -> LLM only
   |
   v
Qloo API (taste graph, 250M+ entities)
   |
   v
Stream results back (SSE) so the globe animates as the agent works
```

Key design choices:

- **Stream the agent steps** to the UI with Server Sent Events. The globe draws as results arrive. This makes the agent feel alive and shows real work.
- **Cache Qloo responses** (in memory or Vercel KV) so demos are fast and you stay inside rate limits.
- **Pre-warm 5 demo artists** so judges always see a fast, perfect run. Live search still works for any artist.
- **Fallback.** If Qloo is slow, show cached result and a small "cached" tag. Never show a blank screen.

## 8. Tech stack

- **Framework:** Next.js 14+ (App Router) and TypeScript
- **Styling:** Tailwind CSS and shadcn/ui
- **Globe:** `globe.gl` (Three.js). Features: arcs, points, hex bin heat layer, auto rotate, fly to
- **Agent LLM:** OpenAI API (model set by `OPENAI_MODEL`, "luna") with tool calling
- **Taste data:** Qloo API (required)
- **Hosting:** Vercel
- **Cache:** in memory Map first, Vercel KV or Upstash if time allows
- **PDF export:** `@react-pdf/renderer` or print stylesheet
- **License:** MIT

## 9. Qloo API notes (verified)

Verified against the hackathon developer guide and live calls on 2026-10-23.

- **Base URL:** `https://hackathon.api.qloo.com` (hackathon keys fail on the staging and production hosts)
- **Auth:** `X-Api-Key` header. All calls are `GET`, with parameters in the query string.
- **Search:** `/search?query=...&types=urn:entity:artist` returns the entity ID and tags. Comedians are `urn:entity:person`.
- **Insights:** `/v2/insights` with `filter.type` and `signal.interests.entities=<id>`.
  - Openers: `filter.type` artist (or person) returns related acts with an affinity score.
  - Sponsors: `filter.type=urn:entity:brand`.
  - City demand: `filter.type=urn:entity:place` with `filter.location=POINT(lng lat)` and `filter.location.radius`. We score a city by the mean affinity of the top places.
  - VIP picks: the same place call plus `filter.tags` (`urn:tag:genre:place:restaurant`, `urn:tag:category:place:bar`, `urn:tag:category:place:night_club`).
  - Heat layer: `filter.type=urn:heatmap` with a location.
- **Not used:** `urn:entity:destination` (returns sightseeing spots, not tour cities), and `/recs`, which is unsupported.
- **Caching:** private server-side caching is allowed. Never commit Qloo response data to a public repo.
- **Code:** `src/lib/qloo.ts` (client), `src/lib/agent.ts` (agent), `src/app/api/plan/route.ts` (SSE stream).

Smoke tests: `node --env-file=.env.local scripts/qloo-smoke.mjs` and `scripts/qloo-insights.mjs "Coldplay"`.

Environment variables:

```
QLOO_API_KEY=
QLOO_BASE_URL=https://hackathon.api.qloo.com
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

Never commit `.env`. Keep `.env.example` with empty keys.

## 10. Suggested folder structure

```
headliner/
  README.md
  LICENSE
  .env.example
  package.json
  src/
    app/
      page.tsx                 landing + search
      plan/page.tsx            globe + panels
      api/plan/route.ts        agent endpoint (SSE)
    components/
      Globe.tsx                globe.gl wrapper
      AgentTrace.tsx           live step list
      StopCard.tsx             side card for a stop
      ControlsBar.tsx
      ExportButton.tsx
    lib/
      qloo.ts                  typed Qloo client + cache
      agent.ts                 OpenAI tool loop
      tools.ts                 tool definitions and handlers
      geo.ts                   city to lat/lng, great circle helpers
      types.ts
    data/
      demo-artists.json        pre-warmed results
      cities.json              city list with lat/lng
```

## 11. Build plan (10 days)

| Days | Goal | Done when |
|---|---|---|
| 1 | Setup, get key, read docs, test Qloo calls in a script | 5 artists return real data |
| 2 | `qloo.ts` client and cache. Tool functions | Each tool works from a test script |
| 3 | Agent loop with the OpenAI model. JSON plan output | CLI prints a full tour plan |
| 4 | Next.js app. Globe with spin, points, arcs | Globe renders hard coded tour |
| 5 | Connect API to globe. SSE streaming. Agent trace panel | Search draws a real tour |
| 6 | Stop cards. Heat layer. Explainability | Click a stop shows all details |
| 7 | Controls, region filter, export PDF | Full flow works |
| 8 | Polish. Animations. Loading and error states. Mobile pass | Feels like a product |
| 9 | Deploy to Vercel. Test as a stranger. Fix bugs. Pre-warm demo artists | Public URL works end to end |
| 10 | README, LICENSE, Devpost write up, 2 min demo video, submit | Submitted before deadline (aim for Oct 29) |

Submit one day early. Do not wait for the last hour.

## 12. Nice to have (only if time remains)

- **Compare mode:** two artists side by side on the globe
- **Sponsor pitch generator:** one click email to a brand with the taste match proof
- **Venue picker** with capacity fit
- **Merch ideas** per city from local taste
- **Share link** for a plan

## 13. Risks and fixes

| Risk | Fix |
|---|---|
| Qloo has thin data for some cities | Test early. Use only well covered cities. Show confidence score. |
| API rate limits | Cache hard. Pre-warm demo artists. |
| Globe heavy on phones | Lower point count. Allow a 2D fallback. |
| LLM output not valid JSON | Use tool use with schemas. Validate with zod. Retry once. |
| Looks like a demo | Spend days 7 to 8 on design and empty and error states. |
| Judges cannot run it | No login. No setup. One click to a working example. |

## 14. Devpost write up outline

1. Inspiration: touring is guesswork
2. What it does: one input, full tour plan on a globe
3. How we built it: Qloo + OpenAI agent + globe.gl
4. What makes it Qloo powered: list each Qloo call and what it drives
5. Challenges
6. What is next: B2B product for promoters and agencies, sponsor marketplace
7. Business angle: SaaS for promoters, per plan pricing, sponsor lead fees

## 15. Notes for Claude Code (start here)

When you open this folder in Claude Code:

1. Read this file fully.
2. Read the Qloo docs and fix section 9 with the real endpoints.
3. Ask me for `QLOO_API_KEY`, `OPENAI_API_KEY` and `OPENAI_MODEL` and put them in `.env.local`.
4. Scaffold Next.js with TypeScript and Tailwind in this folder.
5. Follow the build plan in section 11 in order. Start with day 1: a script that proves Qloo calls work for 5 artists.
6. Keep commits small. Add the MIT license on day 1.
7. Use short simple wording in the UI copy.

## Run, warm up and deploy

```bash
npm install
cp .env.example .env.local        # then fill in the keys
npm run dev                       # http://localhost:3000
npm run build && npm start        # production check
node scripts/warm.mjs             # pre-warm the 5 demo artists (about 4 minutes the first time)
```

- **Pre-warmed plans:** a fresh plan takes about 35 seconds. Finished plans are saved server-side and replay in about 3 seconds.
  Saved plans live in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise in `.cache/plans` (git-ignored).
  Qloo data must never be committed to a public repo.
- **Deploy to Vercel:** import the repo, add the environment variables above, deploy, then run `node scripts/warm.mjs https://your-app.vercel.app`.
  `/api/plan` is set to a 60 second limit.
- **Credits:** Earth textures by Solar System Scope (CC BY 4.0), based on NASA imagery. Stock video from Pexels.

## License

MIT
