# Read the CSV link from the gov.uk content API

The register's download URL is date-stamped and changes on every release, so the ingest
job has to discover the current link. Sponsa reads it from the gov.uk content API, at
`https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers`,
under `details.attachments`.

## Considered options

Parsing the HTML publication page was the original design. It works today and it breaks
on the next page redesign, without warning and in a way no test catches. gov.uk ships no
stable latest URL, so a hardcoded link is not an option either.

## Consequences

The job reads one JSON field instead of a page of markup. On 2026-10-04 the call returned
one attachment, titled `Register of Worker and Temporary Worker licensed sponsors`,
pointing at the 2026-10-02 CSV.

The job fails loudly when the API returns no attachment, or more than one. A second
attachment means gov.uk changed the publication's shape, and guessing which file is the
register is worse than stopping.
