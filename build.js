#!/usr/bin/env node
/* ==========================================================================
   Coachable Labs — static site build.

   Usage:  node build.js

   No dependencies, no install step. Reads src/ and writes plain HTML into the
   route directories at the repo root. Hosting serves those files directly and
   never runs this script — only editing goes through it.

     src/site.json        site-wide data and the "not ready yet" flags
     src/layout.html      the one <html> document every page is poured into
     src/partials/*.html  shared components (§3.1) — header, footer, cards
     src/pages/**.html    one file per route, JSON front matter + body

   Template syntax:
     {{key}}                        value from front matter, then site.json
     {{> name key="value"}}         include a partial, with parameters
     {{#if key}}…{{else}}…{{/if}}   conditional block
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const PAGES_DIR = path.join(SRC, "pages");
const PARTIALS_DIR = path.join(SRC, "partials");

const site = JSON.parse(fs.readFileSync(path.join(SRC, "site.json"), "utf8"));
const layout = fs.readFileSync(path.join(SRC, "layout.html"), "utf8");

const warnings = [];
const partialCache = {};

/* ---------- template engine ---------- */

function lookup(data, key) {
  return key.split(".").reduce(function (acc, part) {
    return acc == null ? undefined : acc[part];
  }, data);
}

function partial(name) {
  if (!partialCache[name]) {
    const file = path.join(PARTIALS_DIR, name + ".html");
    if (!fs.existsSync(file)) throw new Error("No such partial: " + name);
    partialCache[name] = fs.readFileSync(file, "utf8");
  }
  return partialCache[name];
}

// Resolves innermost-first so nested blocks work without a real parser.
function resolveConditionals(str, data) {
  const re = /\{\{#if\s+([\w.]+)\s*\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/;
  let match;
  let guard = 0;
  while ((match = re.exec(str)) && guard++ < 2000) {
    const branches = match[2].split(/\{\{else\}\}/);
    const value = lookup(data, match[1]);
    const chosen = value ? branches[0] : branches[1] || "";
    str = str.slice(0, match.index) + chosen + str.slice(match.index + match[0].length);
  }
  return str;
}

function render(template, data, depth) {
  depth = depth || 0;
  if (depth > 12) throw new Error("Include depth exceeded — partial including itself?");

  let out = template.replace(
    /\{\{>\s*([\w-]+)((?:\s+\w+="[^"]*")*)\s*\}\}/g,
    function (_, name, attrs) {
      const params = {};
      attrs.replace(/(\w+)="([^"]*)"/g, function (__, key, value) {
        params[key] = value;
        return "";
      });
      return render(partial(name), Object.assign({}, data, params), depth + 1);
    }
  );

  out = resolveConditionals(out, data);

  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_, key) {
    const value = lookup(data, key);
    return value == null ? "" : String(value);
  });

  return out;
}

/* ---------- pages ---------- */

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce(function (files, entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files.concat(walk(full));
    if (entry.name.endsWith(".html")) files.push(full);
    return files;
  }, []);
}

function parsePage(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^\s*<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!match) throw new Error("Missing JSON front matter: " + path.relative(ROOT, file));
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error("Bad front matter in " + path.relative(ROOT, file) + " — " + err.message);
  }
  return { meta: meta, body: raw.slice(match[0].length) };
}

function outputPath(route) {
  if (!route.startsWith("/") || !route.endsWith("/")) {
    if (route !== "/") throw new Error('Route must start and end with "/": ' + route);
  }
  const clean = route.replace(/^\/|\/$/g, "");
  return clean ? path.join(ROOT, clean, "index.html") : path.join(ROOT, "index.html");
}

function navFlags(active) {
  // The header marks the current section; every other item renders bare.
  const keys = ["coaching", "how", "approach", "about", "start"];
  return keys.reduce(function (acc, key) {
    acc["nav_" + key] = key === active ? 'aria-current="page" class="nav-link is-current"' : 'class="nav-link"';
    return acc;
  }, {});
}

function schemaBlocks(schema) {
  if (!schema) return "";
  const list = Array.isArray(schema) ? schema : [schema];
  return list
    .map(function (block) {
      return '<script type="application/ld+json">\n' + JSON.stringify(block, null, 2) + "\n</script>";
    })
    .join("\n");
}

function checkOutput(html, route) {
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) {
    warnings.push(route + " — has " + h1s.length + " <h1> elements (§0.6 requires exactly one)");
  }
  const leftovers = html.match(/\{\{[^}]*\}\}/g);
  if (leftovers) {
    warnings.push(route + " — unresolved template tokens: " + leftovers.join(", "));
  }
  if (/href="#"/.test(html)) {
    warnings.push(route + ' — ships href="#" (§2.3 forbids it)');
  }
}

function build() {
  const files = walk(PAGES_DIR);
  const routes = [];

  files.forEach(function (file) {
    const page = parsePage(file);
    const meta = page.meta;

    const data = Object.assign({}, site, meta, navFlags(meta.nav), {
      schemaBlocks: schemaBlocks(meta.schema),
      ogImage: meta.ogImage || site.ogImage,
      canonical: meta.canonical || site.origin + meta.route,
      bodyClass: meta.bodyClass || "",
      robots: meta.noindex ? '<meta name="robots" content="noindex">' : ""
    });

    data.content = render(page.body, data);
    const html = render(layout, data);
    checkOutput(html, meta.route);

    const dest = outputPath(meta.route);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html, "utf8");
    routes.push(meta.route);
  });

  routes.sort().forEach(function (route) {
    console.log("  built  " + route);
  });
  console.log("\n" + routes.length + " pages written.");

  // Content that is deliberately withheld until real material lands (§0.3).
  const pending = [];
  if (!site.coachesReady) {
    pending.push("coachesReady=false — /about/ is built but held out of the nav, and the");
    pending.push("                    coach block on / is suppressed. [COACH PHOTOS] outstanding.");
  }
  if (!site.testimonialsReady) {
    pending.push("testimonialsReady=false — testimonial slots on / and the service pages are");
    pending.push("                          empty. Real quotes from the twelve graduates needed.");
  }
  if (!site.priceReady) {
    pending.push("priceReady=false - no fee is published anywhere: not on /how-it-works/, not in");
    pending.push("                  the FAQ, not in the LocalBusiness schema. The $500-$1,500 range");
    pending.push("                  in the brief was wrong and was removed. [PRICING] outstanding.");
  }
  if (!site.bookingEmbed) {
    pending.push("bookingEmbed unset — /book-a-call/ shows the email fallback, not a scheduler.");
    pending.push("                     [BOOKING TOOL] outstanding.");
  }
  if (pending.length) {
    console.log("\nPENDING — this site is not finished:");
    pending.forEach(function (line) {
      console.log("  " + line);
    });
  }

  if (warnings.length) {
    console.log("\nWARNINGS:");
    warnings.forEach(function (line) {
      console.log("  " + line);
    });
    process.exitCode = 1;
  }
}

build();
