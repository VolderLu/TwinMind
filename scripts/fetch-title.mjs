#!/usr/bin/env node
// Fetch the title of one or more URLs while keeping token cost near zero.
// Streams each response, extracts og:title or <title>, and aborts.
// Usage: node scripts/fetch-title.mjs <url> [url2] [url3] ...

import { get as httpsGet } from "node:https";
import { get as httpGet } from "node:http";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1048576;
const TIMEOUT_MS = 5000;

const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function extractTitle(html) {
  const t = html.match(TITLE_RE);
  if (t) return decodeTitle(t[1]);
  const og = html.match(OG_TITLE_RE);
  if (og) return decodeTitle(og[1]);
  return null;
}

function decodeTitle(raw) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .trim();
}

function fetchTitle(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      reject(new Error("Too many redirects"));
      return;
    }

    const client = url.startsWith("https") ? httpsGet : httpGet;

    const req = client(
      url,
      { headers: { "User-Agent": UA }, timeout: TIMEOUT_MS },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.destroy();
          req.destroy();
          const next = new URL(res.headers.location, url).href;
          resolve(fetchTitle(next, redirects + 1));
          return;
        }

        if (res.statusCode !== 200) {
          res.destroy();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let buf = "";
        let bytes = 0;
        let found = false;

        res.setEncoding("utf8");
        res.on("error", reject);
        res.on("data", (chunk) => {
          if (found) return;
          bytes += Buffer.byteLength(chunk);
          buf += chunk;

          const title = extractTitle(buf);
          if (title) {
            found = true;
            res.destroy();
            req.destroy();
            resolve(title);
          } else if (bytes >= MAX_BYTES) {
            res.destroy();
            req.destroy();
            reject(new Error("Title not found within first 1MB"));
          }
        });

        res.on("end", () => {
          if (found) return;
          const title = extractTitle(buf);
          if (title) resolve(title);
          else reject(new Error("No title found"));
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });

    req.on("error", reject);
  });
}

function fetchTitleWithFallback(url) {
  return fetchTitle(url).catch((primaryErr) =>
    fetchTitle(`https://web.archive.org/web/2/${url}`).catch((wbErr) => {
      throw new Error(`${primaryErr.message}; Wayback: ${wbErr.message}`);
    }),
  );
}

const urls = process.argv.slice(2);
if (urls.length === 0) {
  process.stderr.write("Usage: node scripts/fetch-title.mjs <url> [url2] ...\n");
  process.exit(1);
}

const results = await Promise.allSettled(
  urls.map((u) => fetchTitleWithFallback(u)),
);

for (let i = 0; i < urls.length; i++) {
  const r = results[i];
  if (r.status === "fulfilled") {
    process.stdout.write(r.value + "\n");
  } else {
    process.stderr.write(`${urls[i]}: ${r.reason.message}\n`);
    process.stdout.write("\n");
  }
}

if (results.every((r) => r.status === "rejected")) process.exit(1);
