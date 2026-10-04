# The rename similarity threshold is 0.85, measured from the register

Sponsa pairs a disappeared sponsor with a new one when the trigram similarity of their
normalised names reaches 0.85 and both sit in the same town. The number comes from a
measurement, not from taste.

## The problem with the first number

The design named a high threshold and the first code used 0.9. At 0.9 the rule is dead
code. `pg_trgm` scores a one-letter rename, `bright futures nursery` against
`bright future nursery`, at 0.875. It scores `beta foods` against `beta foods uk` at
0.786. Two normalised names that score above 0.9 in the same town already share an
identity key, so they are the same sponsor and not a rename at all.

## The measurement

The question a threshold has to answer is how similar two genuinely different sponsors
in one town get. A 1,200 sponsor sample of the 2026-10-02 register, each compared
against every other sponsor in its town, gives the answer.

```
p50  0.300
p90  0.550
p95  0.594
p99  0.733
max  0.808
```

Nothing reached 0.85. The worst false pair was `tm management services` against
`tfl management services` in London, at 0.808.

The measurement is deliberately pessimistic. It compares every sponsor against every
other sponsor in its town. The real rule compares only the sponsors that disappeared
against the sponsors that appeared, which is a far smaller set on any normal day.

0.85 therefore sits above the measured false-pair ceiling and below a one-letter rename.

## Consequences

The rule catches a typo and a small edit. It does not catch
`Beta Foods Ltd` becoming `Beta Foods Group Ltd`, which scores 0.647. That case is
recorded as one unlisted sponsor and one new sponsor, which the design calls the honest
reading.

A single threshold is not the only guard. A pair is accepted only when the match is
unique in both directions. One absent sponsor matching two new names pairs nothing, and
so does one new name matching two absent sponsors.

The reproduction lives in the pull request that added this file. The Python
implementation of `pg_trgm` similarity was checked against Postgres on eight pairs and
agreed on all eight to three decimal places.
