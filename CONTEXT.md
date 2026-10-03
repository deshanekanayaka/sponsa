# Sponsa

Sponsa helps a job seeker in London find software roles at UK employers who hold a
licence to sponsor a work visa. It joins the Home Office register of licensed
sponsors to live vacancies read from employers' own job boards.

## Language

### The register

**Sponsor**:
A legal entity that holds a Home Office licence to sponsor workers, exactly as the
register names it. `Monzo Bank Limited` is a sponsor.
_Avoid_: Company, employer, organisation

**Route**:
The visa category a sponsor is licensed for, such as Skilled Worker or Scale-up. One
sponsor holds one or more routes.
_Avoid_: Visa type, tier, category

**Rating**:
The Home Office grade attached to a sponsor's licence for a route, such as `Worker (A)`.
_Avoid_: Grade, status, level

**Unlisted**:
The state of a sponsor whose row was present in yesterday's register and absent from
today's. Sponsa infers this from absence, because the register publishes no event.
_Avoid_: Revoked, removed, deleted, expired

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
A recorded link between a sponsor and a brand, carrying how it was decided: by slug
probe, or by a person.
_Avoid_: Mapping, association, join

**Candidate**:
A slug Sponsa guesses from a sponsor's name and then asks a provider about. A candidate
is a question, not a result.
_Avoid_: Guess, slug, handle

**Probe**:
One request asking one provider whether one candidate exists. A `200` is a hit and a
`404` is a miss.
_Avoid_: Check, lookup, test

**Discovery**:
The scheduled work of turning sponsors into matches by probing candidates.
_Avoid_: Scraping, indexing, matching

### Vacancies

**Listing**:
One open role on one board, stored as its title, locations, link and dates. Sponsa never
stores the job description.
_Avoid_: Job, vacancy, post, advert, role

**Closed**:
The state of a listing that was in its board's feed yesterday and is absent today.
_Avoid_: Expired, filled, removed, stale

**Tech verdict**:
Sponsa's own judgement that a listing is a software role, decided from its title and its
board department.
_Avoid_: Category, classification, tag

**Re-crawl**:
The nightly reading of every board behind a match, which both adds listings and closes
them.
_Avoid_: Refresh, sync, update
