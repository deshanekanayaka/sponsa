# Stay on free tiers, and accept a hard stop as the overload behaviour

Sponsa runs on the Vercel Hobby plan, the Supabase free plan, and GitHub Actions on a
public repository. Nothing in the stack can bill us, and that is the point.

## Consequences

Neither platform charges on overage, so both degrade instead. Exceeding a Vercel Hobby
quota can mean waiting up to thirty days before that feature works again. Exceeding the
Supabase free limits switches the database to read-only or returns `402` on every
request. A reader should not mistake this for an oversight: a thirty-day outage is the
known and accepted overload behaviour, chosen over any possibility of a bill.

The mitigations are therefore architectural rather than financial. Cache every page at
the edge, since the data changes once a night, so a scraper costs a CDN request and not a
database query. Store no job descriptions, which keeps the database far below the 500 MB
read-only threshold. Publish a nightly data dump, which converts the most expensive
visitor into one cheap file download. Use the Vercel firewall rather than putting
Cloudflare in front, because Vercel advises against a reverse proxy and its own bot
protection stops working behind one.

Two constraints follow and are easy to trip over later. The Vercel Hobby terms restrict
it to non-commercial personal use, which rules out advertising and any paid work on the
deployment, though donations are allowed. A public repository is required, not merely
preferred, because private repositories do not get free unlimited Actions minutes.
