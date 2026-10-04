import { readFile, readdir, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const files = [
  "README.md",
  ...(await readdir("docs"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `docs/${file}`),
];
const failures = [];
let checked = 0;
for (const file of files) {
  const source = await readFile(file, "utf8");
  const links = [
    ...source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g),
    ...source.matchAll(/<img[^>]*src="([^"]+)"/g),
  ];
  for (const [, link] of links) {
    if (/^[a-z]+:/i.test(link)) continue;
    const [relative, anchor] = link.split("#");
    const target = relative
      ? resolve(dirname(file), decodeURIComponent(relative))
      : resolve(file);
    try {
      await access(target);
      if (anchor && target.endsWith(".md")) {
        const text = await readFile(target, "utf8");
        const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(
          ([, heading]) =>
            heading
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s_-]/gu, "")
              .replace(/\s/g, "-"),
        );
        if (!headings.includes(anchor)) throw new Error("Missing heading");
      }
      checked++;
    } catch {
      failures.push(`${file}: ${link}`);
    }
  }
}
if (failures.length) {
  console.error("Broken local documentation links:\n" + failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Verified ${checked} local documentation links and images.`);
