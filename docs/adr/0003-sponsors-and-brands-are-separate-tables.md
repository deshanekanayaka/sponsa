# Model sponsors and brands as separate tables joined by a match

A licence belongs to a registered legal entity and a job board belongs to a public brand.
Sponsa keeps `sponsors` as a faithful mirror of the register, `brands` as one row per
discovered board, and a `matches` table linking them.

## Consequences

The relationship is genuinely many to many. One brand can cover several register rows, a
group can hold one licence while subsidiaries post separately, and most sponsors will
never have a board at all. A single table would force Sponsa either to discard the
unmatched majority of the register or to invent a brand for every one of them.

Each match records how it was decided, by slug probe or by a person. Without that column
a wrong automatic match is indistinguishable from a human-confirmed one, and the data
stops being auditable within weeks.
