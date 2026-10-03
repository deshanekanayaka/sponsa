# Read vacancies from employers' own job boards, not from job board APIs

The register of licensed sponsors contains organisations and no vacancies, so Sponsa must
get vacancies elsewhere. Sponsa reads them from employers' own applicant tracking system
boards, which Greenhouse, Lever and Ashby all expose as public unauthenticated JSON, and
finds those boards by guessing slugs from registered sponsor names.

## Considered options

Adzuna's free API allows 2,500 calls a month and only for non-commercial use. A Reed key
grants access but not the right to republish listings. Indeed closed its publisher API in
2023. The LinkedIn user agreement forbids scraping outright.

## Consequences

Sponsa owns its corpus with no licence ceiling and surfaces exactly the roles that never
reach the large job boards. The cost is coverage: only employers using one of the
supported providers can ever appear, and a sponsor whose board slug does not resemble its
registered name is missed until a person adds the match by hand.

Starting from a known sponsor and crawling outward also removes the hardest problem the
alternative carries. Sponsa never has to match a messy employer name on a listing back to
a register row, because it already knows whose board it is reading.
