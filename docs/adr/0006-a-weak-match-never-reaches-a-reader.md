# A weak match never reaches a reader

Discovery proves that a board exists at a guessed slug. It never proves whose board it
is. A candidate built from the sponsor's full name is strong enough to publish on its
own, and a candidate that is the first word of the name is not, so a first-word hit is
recorded as a weak match and stays invisible until a person confirms it.

## Considered options

Publishing every hit is the obvious path and it tells lies. The sponsor
`Apple Care Limited` produces the candidate `apple`, which returns `200`, and every
listing on that board would then appear on that sponsor's company page beside a route and
a rating. That is the same harm the design refuses in the occupation code section, where
a wrong answer tells somebody a role is eligible when it is not.

## Consequences

Precision costs coverage, and coverage is what [ADR 0001](./0001-crawl-employer-job-boards-not-job-board-apis.md)
says Sponsa exists to buy. The loss is deliberate and it is large. The weak queue is
ranked by the number of London tech listings on each board, one person reviews the top of
it, and most weak matches stay unreviewed forever. A queue that is never emptied is
honest here, and pretending otherwise would be the real failure.

Ranking needs numbers from a board nobody has read yet, so discovery reads a board once
on a hit and stores three counts on the brand: total listings, tech listings and London
tech listings. It stores no listings and no titles for a weak match.

Reviews are recorded in a file in the repository, not in the database and not in a
dashboard. A pull request is the review, git is the audit trail, and `decided_by` becomes
provable. The file must outlive the database, so a line names the provider, the slug and
the sponsor name as the register spelled it, resolved through `sponsor_names`. Every line
carries a verdict of `yes` or `no`, because a weak match with no reject state returns to
the top of the ranking every week.
