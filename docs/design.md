# Design

This document records the design settled before any code existed. It covers the data
sources, the pipeline, the schema, the website, the operational limits, and the work
deliberately left out.

Read [CONTEXT.md](../CONTEXT.md) first for the vocabulary. The words sponsor, brand,
board, listing, match, candidate, probe and unlisted all have exact meanings here.

## Data sources

### The register

The Home Office publishes the Register of licensed sponsors: workers on gov.uk. The
2026-10-02 file is a 10.4 MB CSV with five columns:

```
Organisation Name, Town/City, County, Type & Rating, Route
```

Facts that shape the design:

- The file has 143,138 rows but only 127,677 unique organisation names, because each row
  is one sponsor and route pair.
- The download URL is date-stamped and changes on every release. There is no stable
  latest URL, so the ingest job must read the publication page to find the current link.
- The file updates on almost every working day.
- Fields carry leading and trailing whitespace, and some route labels are legacy
  duplicates such as `Tier 2 General`.
- The licence is Open Government Licence v3.0. Copying, adapting and republishing are all
  permitted, including commercially, and attribution is the only requirement.
- The file contains no vacancy data of any kind.

### The job boards

Three applicant tracking system providers serve a company's open roles as public JSON
with no authentication. A real company returns `200` with the roles. A company that does
not exist returns a clean `404`. That difference is what makes discovery possible.

```
Greenhouse  https://boards-api.greenhouse.io/v1/boards/<slug>/jobs
Lever       https://api.lever.co/v0/postings/<slug>?mode=json
Ashby       https://api.ashbyhq.com/posting-api/job-board/<slug>
```

A Greenhouse listing supplies the title, the location string, `absolute_url`,
`first_published` and `updated_at`. That is everything a listing needs.

Job board APIs were considered and rejected. See
[ADR 0001](./adr/0001-crawl-employer-job-boards-not-job-board-apis.md).

## The pipeline

Three jobs run on three different schedules as separate GitHub Actions workflows.

### Register ingest, daily

1. Read the gov.uk publication page and extract the current CSV link.
2. Download the CSV and trim the whitespace from every field.
3. Compare the row count against the last successful run. If the file has lost more than
   a small fraction of yesterday's rows, stop and alert. Do not process it.
4. Insert new sponsors and update `last_seen` on the ones still present.
5. Set `unlisted_at` on any sponsor absent from today's file.

Step 3 is the guard that matters. A truncated download would otherwise mark thousands of
sponsors as unlisted in one run.

### Discovery, weekly over a rotating slice

Discovery turns sponsors into matches. For each sponsor it builds three candidate slugs
from the name, then probes the providers.

`Monzo Bank Limited` produces `monzobank`, then `monzo-bank`, then `monzo`.

The rules:

- Strip the legal suffix, then join the remaining words with nothing, then with a hyphen,
  then take the first word alone.
- Stop at the first hit per provider. Do not probe the remaining candidates.
- Record `last_probed_at` and the result on every candidate, so no run repeats work.

Three tiers decide who gets probed, and `last_probed_at` makes all three one query:

1. A sponsor that appeared in the register for the first time is probed within a day,
   because a newly licensed employer is actively hiring.
2. A confirmed miss is retried on a slow rotation, roughly one slice each week, so every
   name comes round a few times a year.
3. A confirmed hit is never probed again. Its board is re-crawled instead.

One candidate per sponsor across three providers is about 380,000 requests. Three
candidates is about 1.5 million, which is why the first hit stops the rest, and why
discovery runs over a slice rather than the whole register.

### Re-crawl, nightly

For every brand with a match, read the complete board.

1. Insert listings that are new.
2. Close listings that are absent, by setting `closed_at`.
3. Update `last_ok_at` and `listings_at_last_ok` on the brand.

Reading the complete board is what makes closure accurate. A listing that vanishes is
genuinely gone, so Sponsa knows a real closure date. Large job boards do not.

One guard protects this. If a board returns zero listings where it returned many at the
last successful crawl, treat the response as a fetch failure and close nothing. That
shape is almost always an outage, not many simultaneous closures.

## Schema

```
sponsors          id, name, town, county, first_seen, last_seen, unlisted_at
sponsor_routes    sponsor_id, route, rating
candidates        sponsor_id, provider, slug, last_probed_at, result
brands            id, provider, slug, last_crawled_at, last_ok_at, listings_at_last_ok
matches           sponsor_id, brand_id, decided_by, decided_at
listings          id, brand_id, external_id, title, url, first_published,
                  updated_at, first_seen, closed_at, is_tech
listing_locations listing_id, raw, city, is_remote
crawl_runs        id, kind, started_at, ended_at, boards_touched,
                  listings_added, listings_closed, error_count
```

Why each table exists:

- `sponsors` and `brands` are separate because a licence belongs to a legal entity and a
  board belongs to a public brand. See
  [ADR 0003](./adr/0003-sponsors-and-brands-are-separate-tables.md).
- `matches.decided_by` records whether a slug probe or a person made the link. Without it
  a wrong automatic match is indistinguishable from a confirmed one.
- `candidates` exists so the three discovery tiers are one query over `last_probed_at`.
- `listing_locations` exists because one listing genuinely has several locations.
- `brands.listings_at_last_ok` is the outage guard described above.
- `listings` holds no description column. See
  [ADR 0002](./adr/0002-never-store-job-descriptions.md).

Every schema change is a numbered migration file in git. Never change the schema by hand
in the Supabase dashboard.

## Filtering

### Tech roles

Filtering happens at the listing level, never the sponsor level. The register has no
industry field, and a sponsor outside the technology sector still posts engineering roles
worth keeping.

The verdict comes from a keyword list matched against the listing title, with the board
department as a secondary signal where the provider supplies one. The keyword list lives
in the repository as a TypeScript constant, not in a database table, so it gets code
review, version history and tests.

Occupation code mapping is out of scope. It is the feature the paid services call a
sponsorship score, and getting it wrong tells somebody a role is eligible when it is not.

### London

The filter applies to the listing location, not to the sponsor's registered town. Those
two sets overlap far less than expected. A bank registered in London posts Manchester
roles, and an employer registered in Leeds posts London roles. The user is choosing where
the job is.

Provider location strings are free text and often hold several places at once. A real
Greenhouse listing carried `Cardiff, London or Remote (UK)` in a single field. The parser
therefore produces a list, so that listing counts as London, as Cardiff, and as remote.

Remote listings stay visible with a clear remote tag. Excluding them would hide the roles
a London job seeker most wants.

## Website

Search traffic is the only channel that compounds without a budget, so the URL structure
is a product decision.

- `/company/<slug>` is server-rendered per sponsor, with the register facts in the
  visible text.
- `/jobs/<category>` is server-rendered per role category.
- The filtered search page is separate, and search engines are told not to index it.

That gives roughly a thousand indexable pages from the first day. Each one answers a query
people really type, which is a company name followed by the words visa sponsorship.

An unlisted sponsor keeps its company page and loses its listings from search. Somebody
part way through an application needs exactly that page.

There are no accounts in version one. Nothing is stored per person, so there is nothing to
protect and no sign-up between a stranger and the product. Accounts arrive with email
alerts, in version two.

## Abuse and cost

Nothing here is worth stealing. The register is openly licensed and the listings come
from public endpoints any scraper can read directly. There are no accounts, no writes and
no uploads. The thing under protection is the bill and the uptime, not the data.

In order of how much work each one does:

1. Cache every page at the edge. The data changes once a night, so a scraper costs a CDN
   request instead of a database query.
2. Cap the inputs. A maximum page size and page depth mean no single request can ask for
   the whole corpus.
3. Publish a nightly data dump of the corpus. This turns the most expensive visitor into
   one cheap file download, and no competing service offers it.
4. Use the Vercel firewall, which is free on the Hobby plan and includes Attack Challenge
   Mode, three custom rules, one rate limit rule and a bot ruleset. Requests blocked by
   Attack Mode do not count against the usage quota.

Do not put Cloudflare in front of Vercel. Vercel advises against a reverse proxy, and its
own bot protection stops working behind one. Pick one layer.

There is no public JSON API in version one. An API is the surface people script against,
and it buys nothing while there are no API users.

The free tier limits and the accepted failure mode are recorded in
[ADR 0004](./adr/0004-free-tiers-only-and-the-accepted-failure-mode.md).

## Engineering practices

- The repository is public. Private repositories do not get free unlimited Actions
  minutes, and a public repository is the portfolio artefact.
- Every schema change is a numbered migration file in git.
- CI runs type checking, linting and tests on every pull request.
- Work merges by pull request. Nothing is pushed straight to `main`.
- Decisions go in `docs/adr/`. Vocabulary goes in `CONTEXT.md`.
- The crawler writes one row per run into `crawl_runs`, and a failure alerts by email.
- Sentry's free tier collects errors.
- No Docker and no Kubernetes. There are no servers to containerise.

A nightly schedule has one useful side effect. It keeps the Supabase free project active,
which otherwise pauses after a week without use.

## Testing

The website is not the risky code. Three pure functions in the crawler are:

1. Normalising a sponsor name into candidate slugs.
2. Parsing a free-text location into a list of places.
3. Deciding that a listing has closed.

Each gets unit tests with real examples. The third is the dangerous one, because a wrong
rule silently closes live listings.

Record genuine provider responses as JSON fixtures, so the crawler is tested without
touching the network. There are no end-to-end browser tests in version one.

## Out of scope

These are deliberate exclusions, not gaps:

- Providers beyond Greenhouse, Lever and Ashby. Workable serves its board at a different
  URL shape and needs separate work.
- Occupation code sponsorship scoring.
- Email alerts and user accounts.
- Sectors other than technology.
- Locations outside London.
- A custom domain. The site lives at `sponsa.vercel.app`.
- Any form of payment, advertising or monetisation. The Vercel Hobby terms restrict the
  plan to non-commercial personal use. Donations are permitted and advertising is not.

## Launch

Post where the problem is felt rather than where developers gather. The UK immigration
and job hunting communities, and a personal network that already knows the problem, reach
people who need this. The strongest message is that there is no paywall and that the
nightly data dump is public.

Expect the first public thread to find real faults in the matching. That is the purpose of
posting it.
