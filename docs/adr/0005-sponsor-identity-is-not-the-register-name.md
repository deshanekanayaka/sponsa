# A sponsor's identity is not its register name

The register publishes a snapshot with no identifier column, so the name is the only
thing resembling a key. Sponsa gives every sponsor a surrogate `id`, keys its identity on
the normalised name joined to the normalised town, and records every name it has ever
carried in `sponsor_names`. The county is data and never part of the key.

## Considered options

Keying on the name with the town and the county was the first design. The 2026-10-02
file rules it out. The county is empty on 94,940 of the 143,138 rows, and 132 name and
town pairs carry two different counties inside that one file, such as an empty county
against `Scotland`, and `West Yorkshire` against `West yorkshire`. A key built on that
column renames a sponsor every time gov.uk edits a typo.

Keying on the name alone is simpler and wrong in two ways. A sponsor that renames itself
reads as one unlisted sponsor plus one new sponsor, so it loses its `first_seen` date, it
loses its company page, and the discovery tiers then probe it as newly licensed. Two
legal entities that share a name in different towns collapse into one row.

## Consequences

A rename is a state Sponsa detects rather than a fact the register supplies. Sponsa pairs
a disappeared sponsor with a new one only when both sit in the same town and the names
are close above a high similarity threshold. The town therefore carries the weight the
county was meant to share, and the tie rule below carries the rest. If two or more candidates compete,
Sponsa pairs nothing and asks a person, because a wrong pair moves a licence onto the
wrong legal entity.

The name history is not only for renames. It is what lets a decision written by hand in
the confirmation file survive a rename, which is the subject of
[ADR 0006](./0006-a-weak-match-never-reaches-a-reader.md).

The slug in `/company/<slug>` is minted once, when Sponsa first sees the sponsor, and
never changes. A rename changes the page title and the visible text and not the URL,
because the indexed page is the product.
