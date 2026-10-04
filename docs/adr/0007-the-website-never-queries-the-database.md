# The website never queries the database

Sponsa builds the website once a night and ships the open London tech listings as one
static file the browser filters. No page and no route queries Postgres at request time.

## Considered options

Querying Postgres for the filtered search page is the normal choice. On the Supabase free
plan it is also the one visitor that can take the site down, because a crawler walking
filter combinations spends request quota that no edge cache can protect, and
[ADR 0004](./0004-free-tiers-only-and-the-accepted-failure-mode.md) accepts a thirty day
outage as the overload behaviour. Rate limiting narrows that risk. Removing the query
removes the class.

## Consequences

The data changes once a night, so the site has nothing to gain from a live query. A
listing without a description is around 300 bytes, so a few thousand of them compress to
a small download, and filtering in the browser is faster than any round trip.

The nightly chain owns the rebuild. It runs the ingest, then discovery, then the
re-crawl, then publishes the dump, and calls a Vercel deploy hook as its last step. A
failed job stops the chain before the rebuild, so a bad night leaves yesterday's site up.

Two things follow. There is no path for a reader to see data newer than last night, which
is correct for a corpus that changes nightly and would be wrong for anything live. And
the free tier stops being a risk Sponsa manages, because the database serves one build a
day and nothing else.
