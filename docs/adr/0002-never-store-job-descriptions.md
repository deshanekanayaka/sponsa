# Never store job descriptions

Sponsa stores a listing's title, parsed locations, link and dates, then sends the reader
to the employer's own posting. It does not store or display the description text.

## Consequences

Two reasons, and either alone would be enough. The Supabase free tier allows 500 MB and
switches the database to read-only when exceeded, while a single Lever board returned
6 MB of JSON that was almost entirely description HTML. A listing without a description
is around 300 bytes, so millions fit in budget.

The second reason outlives the free tier. Job description text is the employers'
copyrighted work, and it is the one part of this pipeline Sponsa has no licence to
republish. The register is Open Government Licence v3.0 and the listing metadata is
factual, but the prose is not.

So this decision stands even after a move to a paid plan, and a future reader should not
treat it as a storage workaround.
