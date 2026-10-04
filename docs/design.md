# Design

This document records the design settled before any code existed. It covers the data
sources, the pipeline, the schema, the website, the operational limits, and the work
deliberately left out.

Read [CONTEXT.md](../CONTEXT.md) first for the vocabulary. The words sponsor, brand,
board, listing, match, weak match, candidate, probe, blocked, slice, bootstrap, dump and
unlisted all have exact meanings here.

## Data sources

### The register

The Home Office publishes the Register of licensed sponsors: workers on gov.uk. The
2026-10-02 file is a 10.4 MB CSV with five columns:

```
Organisation Name, Town/City, County, Type & Rating, Route
```

Facts that shape the design:

- The 2026-10-02 file has 143,138 rows, because each row is one sponsor and route pair.
  After trimming it holds 127,606 unique organisation names and 127,930 unique name and
  town pairs, so 324 names sit in more than one town.
- It holds 128,062 unique name, town and county triples, which is more than the 127,930
  pairs. 132 name and town pairs carry two different counties in the same file, such as
  an empty county against `Scotland`, and `West Yorkshire` against `West yorkshire`. The
  county is therefore unreliable and it is data, never part of a key.
- Normalising the case, the punctuation and the legal suffix reduces the 127,930 pairs to
  127,395. The 534 merges are the same entity written two ways, such as
  `C. BECHSTEIN HALL LIMITED` and `C. Bechstein Hall LIMITED`.
- The download URL is date-stamped and changes on every release. There is no stable
  latest URL. The ingest job reads the current link from the gov.uk content API. See
  [ADR 0008](./adr/0008-read-the-csv-link-from-the-govuk-content-api.md).
- The file updates on almost every working day.
- 17,552 fields carry leading or trailing whitespace. Organisation names often start
  with a space, and route labels often end with one. Some route labels are retired, such
  as `Tier 2 General`, `Intra-company Routes` and `Intra Company Transfers (ICT)`.
- There is no identifier column. A sponsor's identity has to be derived. See
  [ADR 0005](./adr/0005-sponsor-identity-is-not-the-register-name.md).
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

Every request Sponsa sends to a provider carries a `User-Agent` naming the project, the
repository URL and an email address. If a provider asks Sponsa to stop, Sponsa drops that
provider the same day, keeps its sponsors and deletes its brands. Coverage therefore
rests on the goodwill of three companies that never agreed to serve this traffic, and
that is an accepted risk rather than an oversight.

## The pipeline

Three jobs run in one nightly chain, in this order, as sequential jobs in a single
GitHub Actions workflow. Each one is a separate script that also runs alone from the
command line, so a rerun of one job never needs the others.

Order matters. The urgent probe tier depends on knowing which sponsors arrived today, and
the re-crawl depends on which matches a person confirmed today. Independent schedules can
overlap or invert, because GitHub cron fires late under load.

### Register ingest

1. Read the gov.uk content API and take the CSV link from `details.attachments`.
2. Download the CSV and trim the whitespace from every field.
3. Compare the row count against the last successful run. If the file has lost more than
   a small fraction of yesterday's rows, stop and alert. Do not process it.
4. Insert new sponsors, and update `last_seen` on the ones still present.
5. Pair renames. Set `unlisted_at` on any sponsor still absent.

Step 3 is the guard that matters. A truncated download would otherwise mark thousands of
sponsors as unlisted in one run.

Step 5 needs a rule, because the register publishes no rename event. Sponsa pairs a
disappeared sponsor with a new sponsor only when both share a town and the names are
close above a high similarity threshold. The rule ignores the county, because the county
is empty on 66 percent of the rows and it disagrees with itself on 132 name and town
pairs. If two or more candidates compete,
Sponsa pairs nothing and writes the case to the review queue. Below the threshold, Sponsa
records one unlisted sponsor and one new sponsor, which is the honest reading.

The first ingest is a bootstrap, and `crawl_runs` records it as one. Every sponsor is new
in a bootstrap, so a sponsor first seen in one is never urgent.

### Discovery

Discovery turns sponsors into matches. For each sponsor it builds three candidate slugs
from the name, then probes the providers.

`Monzo Bank Limited` produces `monzobank`, then `monzo-bank`, then `monzo`.

The rules:

- Strip the legal suffix, then join the remaining words with nothing, then with a hyphen,
  then take the first word alone.
- Stop at the first hit per provider. Do not probe the remaining candidates.
- Record `last_probed_at` and the result on every candidate, so no run repeats work.
- A `200` is a hit. A clean `404` is a miss. Every other answer is blocked.

A blocked probe is never a miss. A provider is free to answer with `429`, `403`, a
challenge page, or `200` holding HTML, and a block read as a miss writes false misses
across a whole slice. The slow retry rotation would then hide the damage for months. The
run stops after a small number of consecutive blocks.

A hit does not publish on its own. A candidate built from the full name is strong enough.
A first-word hit becomes a weak match and waits for a person. See
[ADR 0006](./adr/0006-a-weak-match-never-reaches-a-reader.md).

On any hit, Sponsa reads the board once and stores three counts on the brand: total
listings, tech listings and London tech listings. It stores no listings for a weak match.
Those counts are what rank the review queue.

Three tiers decide who gets probed, and `last_probed_at` makes all three one query:

1. A sponsor that appeared in the register for the first time outside a bootstrap is
   probed within a day, because a newly licensed employer is actively hiring.
2. A confirmed miss is retried on a slow rotation, so every name comes round a few times
   a year.
3. A confirmed hit is never probed again. Its board is re-crawled instead.

A slice is capped by wall clock and not by a row count, because a blocked provider and a
slow night both change how long one row takes, and the re-crawl waits behind it. The
sweep order is urgent sponsors, then sponsors holding Scale-up, then sponsors registered
in London, then the rest by id. Scale-up comes early because that route is almost
entirely technology employers, and because it holds only 93 rows.

One candidate per sponsor across three providers is about 380,000 requests. At a
conservative rate inside a nightly budget, full coverage of the register takes about a
year, not a week. That is the real schedule.

### Re-crawl

For every brand with a confirmed match, read the complete board. Every such board is read
every night. This is a requirement and not a schedule, because the closure rule counts
consecutive crawls. If the board count ever outgrows the window, split the work by
provider across parallel jobs in the same chain, and never by rotation across nights.

1. Insert listings that are new.
2. Mark listings that are absent, and close the ones absent twice in a row.
3. Update `last_ok_at` and `listings_at_last_ok` on the brand.

Reading the complete board is what makes closure accurate. A listing that vanishes is
genuinely gone, so Sponsa knows a real closure date. Large job boards do not.

Two guards protect that. The first is a partial read. If today's count is under a set
fraction of `listings_at_last_ok`, and the last count was above a small floor, close
nothing, write the run as an error and alert. Under the floor, trust the zero, because a
board with four listings can genuinely close all four. A zero check alone fails on the
dangerous shape, which is four hundred listings answering as twelve.

The second guard is the two crawl rule. A listing closes only after two consecutive
successful re-crawls do not find it. That costs one day of accuracy and removes the whole
single-run failure mode.

### Reviews

A weak match waits for a person. There is no admin page and there are no accounts.
Decisions live in `data/match-decisions.csv` in this repository, and the nightly chain
applies the file before discovery runs.

One line is one decision: the provider, the slug, the sponsor name as the register
spelled it, a verdict of `yes` or `no`, and a short reason. A pull request is the review
and git is the audit trail.

The sponsor name is part of the key, not a comment. The job resolves it through
`sponsor_names`, so a decision written last year still finds its sponsor after a rename.
A line that resolves to no sponsor fails the run loudly, because a silent skip would
quietly undo the work.

A verdict of `yes` confirms the match and the board enters the nightly re-crawl. A
verdict of `no` rejects it, and the ranking never offers it again.

The queue is ranked by London tech listings per board, and one person reviews the top of
it. Most weak matches stay unreviewed. That is a deliberate loss and it is recorded under
Out of scope.

## Schema

```
sponsors          id, name, slug, town, county, identity_key, first_seen, last_seen,
                  unlisted_at
sponsor_names     sponsor_id, name, first_seen
sponsor_routes    sponsor_id, route, rating
candidates        sponsor_id, provider, slug, last_probed_at, result
brands            id, provider, slug, last_crawled_at, last_ok_at, listings_at_last_ok,
                  listing_count, tech_count, london_tech_count
matches           sponsor_id, brand_id, state, decided_by, decided_at, decided_reason
listings          id, brand_id, external_id, title, url, first_published, updated_at,
                  first_seen, missing_since, closed_at, is_tech, tech_list_version
listing_locations listing_id, raw, city, is_remote
crawl_runs        id, kind, started_at, ended_at, is_bootstrap, boards_touched,
                  listings_added, listings_closed, parse_failures, error_count
```

Why each table and column exists:

- `sponsors.identity_key` is the normalised name joined to the normalised town. It omits
  the county on the evidence above.
- `sponsors` and `brands` are separate because a licence belongs to a legal entity and a
  board belongs to a public brand. See
  [ADR 0003](./adr/0003-sponsors-and-brands-are-separate-tables.md).
- `sponsors.slug` is stored because it is minted once and never changes. A collision
  between two sponsors of the same name adds the town.
- `sponsor_names` carries every name a sponsor has held. It makes renames detectable and
  it makes a hand written decision survive one. It holds no `last_seen`, because a former
  name ends where the next name's `first_seen` begins, and a nightly `last_seen` write
  would rewrite all 127,410 rows to record nothing.
- `sponsors` is created with `fillfactor = 80`. The nightly run updates `last_seen` on
  every present sponsor, and the spare page space lets Postgres update the row in place
  without rewriting five index entries. Measured, this cut the statement from 21 seconds
  to 7 and stopped the index bloat.
- The index on `sponsors.unlisted_at` is partial, over the non-null rows only. Almost
  every sponsor is listed, so the full index indexed 127,410 nulls to find a handful of
  rows.
- `sponsor_routes` is reconciled, not replaced. The nightly run inserts the routes that
  are new and deletes the ones that are gone. Replacing the table rewrote 141,958 rows
  every night to change nothing.
- `candidates.result` holds hit, miss or blocked, and the three discovery tiers are one
  query over `last_probed_at`.
- `brands.listings_at_last_ok` is the partial read guard. The three count columns rank the
  review queue.
- `matches.state` holds weak, confirmed or rejected. `decided_by` records whether a probe
  or a person decided, because a wrong automatic match must be distinguishable from a
  confirmed one.
- `listings.missing_since` is what the two crawl closure rule reads.
- `listings.tech_list_version` records which keyword list produced the verdict.
- `listing_locations` exists because one listing genuinely has several locations.
- `crawl_runs.parse_failures` counts the location strings the parser did not recognise.
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

The list carries a version number, and every listing stores the version that produced its
verdict. When the list changes, the next re-crawl recomputes the verdict for every open
listing. A closed listing keeps the verdict it was given, because rewriting history
removes the only record of what the site showed a reader.

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

Sponsa always stores the raw string. A string the parser does not recognise, such as
`EMEA`, leaves `city` empty and adds one to `parse_failures`. An unparsed listing appears
on its company page and on no London page, so a parser gap is visible in the run row and
never silently deletes a London role.

Remote listings stay visible with a clear remote tag. A remote UK listing appears on the
London page, in a separate group below the London ones. Excluding them would hide the
roles a London job seeker most wants.

## Website

Search traffic is the only channel that compounds without a budget, so the URL structure
is a product decision.

- `/company/<slug>` is built for every sponsor, with the register facts in the visible
  text.
- `/jobs/<category>` is built for every role category.
- The filtered search page is separate, and search engines are told not to index it.

Every sponsor gets a page, including the large majority that have no board. Such a page
says plainly that the employer holds a licence and that Sponsa found no job board for it,
which is a true and useful answer to the query people really type, which is a company
name followed by the words visa sponsorship.

The sitemap is not the same set. Only sponsors with a confirmed match enter it, so a
hundred thousand thin pages stay reachable and indexable without being submitted. The
nightly build writes the sitemap, split into files under the fifty thousand URL limit.

### What the site claims

A licence says that an employer can sponsor somebody, in some role, on some route. It
never says that this London software listing comes with sponsorship. A reader arriving
from a search reads the two facts as one claim, so the licence claim is written once, in
a shared component, and appears in the visible text of every listing and every company
page.

The claim names the route and the rating, and states that the role itself carries no
guarantee of sponsorship. Every route and rating the register gives is shown, with
Skilled Worker first when the sponsor holds it. A retired label such as `Tier 2 General`
is shown beside its current name, mapped by a TypeScript constant. No route is ever
dropped, because an absent route reads as a licence the sponsor does not hold.

An unlisted sponsor keeps its company page and its listings, and the licence claim is
replaced by a line giving the date the sponsor left the register. The sponsor leaves
every search page, every category page and the dump on that day. Somebody part way
through an application needs exactly that page. Sponsa keeps re-crawling the board,
because a brand can serve more than one sponsor, and because a relisted sponsor must not
start from an empty page.

### Reporting a wrong match

Every company page carries a link that opens a prefilled GitHub issue, with the sponsor,
the provider and the slug already in the body. GitHub holds the queue, the repository is
already public, and nothing is built. A fix is one line in `data/match-decisions.csv`,
which the next nightly chain applies.

### Serving

The website never queries Postgres. Sponsa builds the site once a night and ships the
open London tech listings as one static file the browser filters. See
[ADR 0007](./adr/0007-the-website-never-queries-the-database.md).

The chain calls a Vercel deploy hook as its last step, after the re-crawl writes its run
row and the dump is published. A failed job stops the chain before the rebuild, so a bad
night leaves yesterday's site up, which is the correct failure.

There are no accounts in version one. Nothing is stored per person, so there is nothing
to protect and no sign-up between a stranger and the product. Accounts arrive with email
alerts, in version two.

Vercel Web Analytics is on, which is free on the Hobby plan, sets no cookies and needs no
banner. Two numbers matter: the company pages that earn search traffic, and the share of
visits that reach a listing link.

## Abuse and cost

Nothing here is worth stealing. The register is openly licensed and the listings come
from public endpoints any scraper can read directly. There are no accounts, no writes and
no uploads. The thing under protection is the bill and the uptime, not the data.

In order of how much work each one does:

1. Serve no database query from the website at all. A scraper then costs a CDN request,
   and the expensive visitor has nothing left to be expensive against.
2. Cache every page at the edge. The data changes once a night.
3. Cap the inputs. A maximum page size and page depth mean no single request can ask for
   the whole corpus.
4. Publish a nightly dump. This turns the most expensive visitor into one cheap file
   download, and no competing service offers it.
5. Use the Vercel firewall, which is free on the Hobby plan and includes Attack Challenge
   Mode, three custom rules, one rate limit rule and a bot ruleset. Requests blocked by
   Attack Mode do not count against the usage quota.

Do not put Cloudflare in front of Vercel. Vercel advises against a reverse proxy, and its
own bot protection stops working behind one. Pick one layer.

There is no public JSON API in version one. An API is the surface people script against,
and the dump already answers the only real demand for one.

The free tier limits and the accepted failure mode are recorded in
[ADR 0004](./adr/0004-free-tiers-only-and-the-accepted-failure-mode.md).

## The dump

The dump is the cost defence and the launch argument, so it is also the backup.

- It holds sponsors, names, routes, confirmed matches, open listings and their locations.
  It excludes weak matches, rejected matches and candidates, because a wrong link handed
  to a stranger cannot be recalled.
- It holds unlisted sponsors and closed listings, because that history exists nowhere
  else and cannot be rebuilt from today's register.
- One gzipped file per table, as newline delimited JSON, plus a text file carrying the
  licence claim and the Open Government Licence attribution, so the warning travels with
  the data.
- It is published as an asset on a GitHub release by the nightly chain. GitHub serves it,
  so it costs no Vercel bandwidth and no Supabase egress.
- Each day's raw register CSV goes on the same release.
- The job keeps the last thirty releases and deletes the older ones.

A restore means replaying the newest dump. The confirmed matches rebuild from
`data/match-decisions.csv` in git, which is why that file is the record and the database
is not.

## Engineering practices

- The repository is public. Private repositories do not get free unlimited Actions
  minutes, and a public repository is the portfolio artefact.
- Every schema change is a numbered migration file in git.
- CI runs type checking, linting and tests on every pull request.
- Work merges by pull request. Nothing is pushed straight to `main`.
- Decisions go in `docs/adr/`. Vocabulary goes in `CONTEXT.md`.
- Each job in the chain writes one row into `crawl_runs`.
- A guard trip writes the error into `crawl_runs` and exits the job with a failure.
  GitHub emails the owner when a scheduled workflow fails, so there is nothing to build.
  One blocked probe is data. A run that stopped on consecutive blocks is an alert.
- Sentry's free tier collects website errors.
- No Docker and no Kubernetes. There are no servers to containerise.

A nightly schedule has one useful side effect. It keeps the Supabase free project active,
which otherwise pauses after a week without use.

## Testing

The website is not the risky code. Four parts of the crawler are:

1. Normalising a sponsor name into candidate slugs.
2. Pairing a rename against a disappeared sponsor.
3. Parsing a free-text location into a list of places.
4. Deciding that a listing has closed.

Each gets unit tests with real examples. The fourth is the dangerous one, because a wrong
rule silently closes live listings. The second is next, because a wrong pair moves a
licence onto the wrong legal entity.

The tech verdict gets a fixture of real listing titles labelled by hand, as yes and no,
including the hard ones such as `Technical Account Manager` and `Sales Engineer`. CI
asserts the verdict against it, so a change in the counted result is a test failure and
not a silent diff.

Record genuine provider responses as JSON fixtures, so the crawler is tested without
touching the network. There are no end-to-end browser tests in version one.

## Out of scope

These are deliberate exclusions, not gaps:

- Reviewing the whole weak match queue. One person reviews the top of the ranking, and
  most weak matches stay invisible forever. This is a known loss of coverage.
- Providers beyond Greenhouse, Lever and Ashby. Workable serves its board at a different
  URL shape and needs separate work.
- Occupation code sponsorship scoring.
- Email alerts and user accounts.
- Sectors other than technology.
- Locations outside London, except remote UK roles.
- A custom domain. The site lives at `sponsa.vercel.app`.
- Any form of payment, advertising or monetisation. The Vercel Hobby terms restrict the
  plan to non-commercial personal use. Donations are permitted and advertising is not.

## The first pull request

One branch, and the register ingest alone:

- The migration for `sponsors`, `sponsor_names` and `sponsor_routes`.
- The content API reader and the CSV parse with whitespace trimming.
- The row count guard.
- The rename pairing rule and the slug minting.
- The `crawl_runs` row, with the bootstrap marker.
- Unit tests on the name normaliser and the rename pairing, against a recorded CSV
  fixture.

No discovery, no re-crawl and no website in that branch.

## Launch

Post where the problem is felt rather than where developers gather. The UK immigration
and job hunting communities, and a personal network that already knows the problem, reach
people who need this. The strongest message is that there is no paywall and that the
nightly dump is public.

Expect the first public thread to find real faults in the matching. That is the purpose of
posting it.
