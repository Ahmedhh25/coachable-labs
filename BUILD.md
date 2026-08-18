# Building this site

The site is plain static HTML. Hosting serves the files at the repo root directly
and never runs a build. Editing goes through `build.js`.

```
node build.js
```

That reads `src/` and writes `index.html` plus one `index.html` per route
directory. Commit the output along with the source.

Nothing is installed and there are no dependencies.

## Where things live

```
src/site.json          site-wide values, and the flags below
src/layout.html        the <html> document every page is poured into
src/partials/          shared components — header, footer, cards, CTA block
src/pages/             one file per route: JSON front matter, then the body
```

**Edit `src/`, never the generated files.** A generated file is overwritten on the
next build.

Template syntax inside pages and partials:

```
{{key}}                        value from front matter, falling back to site.json
{{> track-card name="…" …}}    include a partial with parameters
{{#if key}}…{{else}}…{{/if}}   conditional block
```

## Local preview

Links are root-relative (`/coaching/marriage/`), so `file://` will not work. Serve
the directory:

```
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## What the build checks

Every run fails loudly on a page with more or fewer than one `<h1>`, on an
unresolved `{{token}}`, and on a shipped `href="#"`.

## Flags in src/site.json

Three switches hold back content that does not exist yet. `build.js` prints a
reminder for each one that is still false.

| Flag                | Effect while false                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `coachesReady`      | `/about/` is built but nothing links to it, and the coach block on the home page is hidden |
| `testimonialsReady` | Testimonial slots on the home page and the service pages render nothing                    |
| `bookingEmbed`      | `/book-a-call/` shows the email and phone fallback instead of a scheduler                  |

Flip a flag only once the real material is in place.

## Still outstanding

- **[COACH PHOTOS]** — real photographs, credentials and backgrounds, and
  confirmation of which people deliver sessions. See the comment at the top of
  `src/pages/about.html`.
- **[TESTIMONIALS]** — quotes from the twelve programme graduates. Nothing is
  written until they exist.
- **[BOOKING TOOL]** — which scheduler powers `/book-a-call/`.
- **Session counts** for the Career and Leaders tracks, bracketed in
  `src/pages/coaching/index.html`, `career.html` and `leaders.html`.
- **A page-specific `og:image`** for the home page at 1200×630. It currently
  falls back to the shared `assets/images/og-image.png`.
