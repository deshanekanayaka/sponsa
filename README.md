# Sponsa

Sponsa finds London software roles at UK employers who hold a licence to sponsor a work
visa. It is free to use, with no paywall and no account.

**Status: design complete, no code yet.** This repository currently holds the domain
model, the architecture decisions, and the design. The first task is the register ingest.

## The problem

The Home Office publishes a register of every organisation licensed to sponsor workers.
The register names 127,677 organisations and contains no vacancies at all. Large job
boards do the opposite: they show vacancies and never tell you whether the employer holds
a licence. Many licensed sponsors never post to those boards, because they post only to
their own careers page.

Sponsa joins the two halves. It reads the register to learn which employers can sponsor,
then reads those employers' own job boards to learn what they are hiring for.

Several services already do something similar. Every one of them caps the free tier and
charges to see the rest. Sponsa does not.

## How it works

One nightly chain runs four steps in order.

1. An ingest step downloads the register from gov.uk and updates the `sponsors` table.
2. A discovery step guesses job board addresses from sponsor names and probes three
   providers to find which ones exist. A weak guess waits for a person to confirm it.
3. A re-crawl step reads every confirmed job board and records the open roles.
4. A publish step writes the nightly public dump and rebuilds the website.

The website reads no database at request time. It is built once a night.

Read [docs/design.md](./docs/design.md) for the detail.

## Stack

Every part has a free tier, and nothing in this stack can produce a bill.

- Supabase Postgres for the database
- GitHub Actions for the three scheduled jobs
- Next.js on Vercel for the website
- TypeScript for both the website and the crawler

## Repository layout

```
CONTEXT.md                 the project vocabulary. Read this before writing code
docs/design.md             the settled design
docs/adr/                  architecture decisions, numbered, with the reasoning
data/match-decisions.csv   every sponsor to job board link a person decided by hand
```

## Attribution

Sponsor data contains public sector information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
