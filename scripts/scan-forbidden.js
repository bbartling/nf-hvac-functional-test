'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WORD_FILE = path.join(ROOT, '.github', 'forbidden-words.txt');
const SKIP_DIRS = new Set(['node_modules', 'coverage', '.git', 'local']);
const SKIP_FILES = new Set([path.normalize(WORD_FILE)]);
const EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.md', '.yml', '.yaml', '.html', '.css', '.txt']);

const SECRET_PATTERNS = [
  { name: 'private_key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'aws_access_key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'github_token', re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'slack_token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
];

/**
 * @param {string} file
 * @returns {string[]}
 */
function loadWords(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @param {string[]} words
 * @returns {{ kind: string, detail: string }[]}
 */
function scanText(text, words) {
  /** @type {{ kind: string, detail: string }[]} */
  const hits = [];
  const lower = text.toLowerCase();
  for (const word of words) {
    if (lower.includes(word)) hits.push({ kind: 'forbidden_word', detail: word });
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(text)) hits.push({ kind: 'secret', detail: pattern.name });
  }
  return hits;
}

/**
 * @param {string} dir
 * @param {string[]} out
 */
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name)) && !SKIP_FILES.has(path.normalize(full))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} [root]
 * @param {string[]} [words]
 */
function scanRepo(root, words) {
  const base = root || ROOT;
  const list = words || loadWords(WORD_FILE);
  /** @type {{ file: string, kind: string, detail: string }[]} */
  const hits = [];
  for (const file of walk(base, [])) {
    const text = fs.readFileSync(file, 'utf8');
    for (const hit of scanText(text, list)) {
      hits.push({ file: path.relative(base, file), kind: hit.kind, detail: hit.detail });
    }
  }
  return hits;
}

function main() {
  const hits = scanRepo();
  if (hits.length === 0) {
    console.log('scan: no forbidden identifiers');
    return 0;
  }
  for (const hit of hits) console.error(`${hit.file}: ${hit.kind} ${hit.detail}`);
  return 1;
}

module.exports = { loadWords, scanText, scanRepo, SECRET_PATTERNS };

if (require.main === module) process.exit(main());
