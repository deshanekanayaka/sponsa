# Sponsa

Sponsa helps a job seeker in London find software roles at UK employers who hold a
licence to sponsor a work visa. It joins the Home Office register of licensed
sponsors to live vacancies read from employers' own job boards.

## Language

### The register

**Sponsor**:
A legal entity that holds a Home Office licence to sponsor workers, exactly as the
register names it. One sponsor keeps one identity across releases of the register, even
when its name changes. `Monzo Bank Limited` is a sponsor.
_Avoid_: Company, employer, organisation

**Route**:
The visa category a sponsor is licensed for, such as Skilled Worker or Scale-up. One
sponsor holds one or more routes. The register also carries retired labels such as
`Tier 2 General`, and Sponsa shows a retired label beside its current name.
_Avoid_: Visa type, tier, category

**Rating**:
The Home Office grade attached to a sponsor's licence for a route, such as `Worker (A)`.
_Avoid_: Grade, status, level

**Unlisted**:
The state of a sponsor whose row was present in yesterday's register and absent from
today's. Sponsa infers this from absence, because the register publishes no event. A
rename is not an unlisted sponsor.
_Avoid_: Revoked, removed, deleted, expired

**Rename**:
The state of a sponsor whose register name changed while its identity stayed the same.
Sponsa records a rename as one sponsor, never as one unlisted sponsor plus one new one.
_Avoid_: Name change, alias, duplicate

**Licence claim**:
The sentence Sponsa shows beside a listing and on a company page. It names the sponsor's
route and rating, and it states that the role carries no guarantee of sponsorship.
_Avoid_: Disclaimer, badge, score, guarantee

### The crawl

**Brand**:
The public identity that owns a job board, named by the slug in its board URL. `monzo`
is a brand. A brand is not a sponsor, and the two names rarely match.
_Avoid_: Company, account, tenant

**Board**:
One applicant tracking system job board belonging to one brand, readable as public JSON.
_Avoid_: Careers page, feed, site

**Provider**:
The applicant tracking system that hosts boards. Greenhouse, Lever and Ashby are
providers.
_Avoid_: ATS, platform, vendor

**Match**:
A recorded link between a sponsor and a brand, carrying how it was decided and how
strongly. Every match is weak, confirmed or rejected.
_Avoid_: Mapping, association, join

**Weak match**:
A match that rests on a probe proving only that a board exists, not whose board it is.
Sponsa keeps a weak match out of the website and out of the dump.
_Avoid_: Unverified, low confidence, guess

**Confirmed**:
The state of a match that a person approved, or that a probe of the sponsor's full name
decided. Only a confirmed match reaches a reader.
_Avoid_: Verified, validated, approved

**Rejected**:
The state of a weak match that a person refused. Sponsa never shows it to a reader and
never offers it for review again.
_Avoid_: Declined, dismissed, deleted

**Review**:
The work of a person reading a board and deciding one weak match, with a yes or a no.
_Avoid_: Approval, triage, moderation

**Candidate**:
A slug Sponsa guesses from a sponsor's name and then asks a provider about. A candidate
is a question, not a result.
_Avoid_: Guess, slug, handle

**Probe**:
One request asking one provider whether one candidate exists. A `200` is a hit, a clean
`404` is a miss, and every other answer is blocked.
_Avoid_: Check, lookup, test

**Blocked**:
The result of a probe the provider refused to answer, such as a `429`, a `403` or a
challenge page. Sponsa never reads a blocked probe as a miss.
_Avoid_: Error, failure, throttled

**Discovery**:
The scheduled work of turning sponsors into matches by probing candidates.
_Avoid_: Scraping, indexing, matching

**Slice**:
The set of sponsors one discovery run reaches before its time budget ends.
_Avoid_: Batch, page, chunk

**Bootstrap**:
The first ingest of the register, in which every sponsor is new. A sponsor first seen in
a bootstrap is not urgent.
_Avoid_: Seed, initial load, backfill

### Vacancies

**Listing**:
One open role on one board, stored as its title, locations, link and dates. Sponsa never
stores the job description.
_Avoid_: Job, vacancy, post, advert, role

**Closed**:
The state of a listing that two consecutive successful re-crawls did not find in its
board's feed.
_Avoid_: Expired, filled, removed, stale

**Partial read**:
A re-crawl answer holding far fewer listings than the last successful one. Sponsa treats
a partial read as a failure, and closes nothing.
_Avoid_: Outage, empty response, bad data

**Tech verdict**:
Sponsa's own judgement that a listing is a software role, decided from its title and its
board department.
_Avoid_: Category, classification, tag

**Re-crawl**:
The nightly reading of every board behind a confirmed match, which both adds listings and
closes them.
_Avoid_: Refresh, sync, update

**Dump**:
The nightly public file holding every table Sponsa shows, published beside the licence
and the attribution.
_Avoid_: Export, backup, feed, API
