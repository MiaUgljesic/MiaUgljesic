import fs from "node:fs";
import https from "node:https";

export const USERNAME = process.env.GH_USERNAME || "MiaUgljesic";
export const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

const QUERY = `
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          description
          url
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
        }
      }
    }
  }
}
`;

const THEME = {
  bg: "#1A0B14",
  border: "#4A1F38",
  cardBg: "#12060D",
  textPink: "#F9A8D4",
  textDim: "#B4849C",
  valuePink: "#F472B6",
  white: "#FFFFFF",
};

function fetchPinnedRepos() {
  return new Promise((resolve, reject) => {
    if (!TOKEN) {
      return reject(new Error("Missing GH_TOKEN or GITHUB_TOKEN environment variable."));
    }

    const reqData = JSON.stringify({
      query: QUERY,
      variables: { login: USERNAME },
    });

    const options = {
      hostname: "api.github.com",
      path: "/graphql",
      method: "POST",
      headers: {
        "User-Agent": "Node-GraphQL-Script",
        Authorization: `bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(reqData),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GraphQL API returned status code ${res.statusCode}: ${body}`));
        }
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            return reject(new Error(`GraphQL Errors: ${JSON.stringify(parsed.errors)}`));
          }
          resolve(parsed.data.user.pinnedItems.nodes);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.write(reqData);
    req.end();
  });
}

const WIDTH = 1000;
const CARD_H = 96;
const CARD_GAP = 14;
const PADDING_X = 30;
const PADDING_TOP = 66;
const PADDING_BOTTOM = 30;

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
}

function buildProjectCard(repo, index) {
  const y = PADDING_TOP + index * (CARD_H + CARD_GAP);
  const name = escapeXml(repo.name);
  const desc = escapeXml(truncate(repo.description, 88));
  const lang = repo.primaryLanguage?.name ?? "N/A";
  const langColor = repo.primaryLanguage?.color ?? THEME.textDim;
  const stars = repo.stargazerCount ?? 0;
  const forks = repo.forkCount ?? 0;

  return `
  <a href="${repo.url}" target="_blank" rel="noopener noreferrer">
    <rect x="${PADDING_X}" y="${y}" width="${WIDTH - PADDING_X * 2}" height="${CARD_H}" rx="8" class="project-card" />
    <rect x="${PADDING_X}" y="${y}" width="4" height="${CARD_H}" rx="2" fill="${THEME.valuePink}" />

    <text x="${PADDING_X + 22}" y="${y + 26}" class="project-name">${name}</text>
    <text x="${PADDING_X + 22}" y="${y + 47}" class="project-desc">${desc}</text>

    <circle cx="${PADDING_X + 26}" cy="${y + 68}" r="4" fill="${langColor}" />
    <text x="${PADDING_X + 36}" y="${y + 72}" class="project-meta">${escapeXml(lang)}</text>

    <text x="${PADDING_X + 160}" y="${y + 72}" class="project-meta">★ ${stars}</text>
    <text x="${PADDING_X + 230}" y="${y + 72}" class="project-meta">⑂ ${forks}</text>
  </a>`;
}

function buildSvg(repos) {
  const items = repos.filter(Boolean);
  const HEIGHT = PADDING_TOP + items.length * (CARD_H + CARD_GAP) - CARD_GAP + PADDING_BOTTOM;

  const cardsSvg = items.map((repo, i) => buildProjectCard(repo, i)).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&amp;display=swap');
      text { font-family: 'Share Tech Mono', monospace, 'Courier New', sans-serif; }

      .bg { fill: ${THEME.bg}; }
      .border { stroke: ${THEME.border}; stroke-width: 1.5; fill: none; }

      .hud-title { font-size: 14px; font-weight: bold; fill: #ffffff; letter-spacing: 1.5px; }
      .hud-sub { font-size: 11px; fill: ${THEME.textDim}; letter-spacing: 1px; }

      .project-card { fill: ${THEME.cardBg}; stroke: ${THEME.border}; stroke-width: 1; }
      .project-name { font-size: 15px; font-weight: bold; fill: ${THEME.white}; }
      .project-desc { font-size: 11px; fill: ${THEME.textDim}; }
      .project-meta { font-size: 11px; fill: ${THEME.textPink}; }

      a { cursor: pointer; }
    </style>

    <pattern id="starGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.8" fill="#ffffff" opacity="0.10" />
      <circle cx="30" cy="25" r="0.6" fill="#F9A8D4" opacity="0.18" />
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" class="bg" />
  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="url(#starGrid)" />
  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="9" class="border" />

  <text x="30" y="32" class="hud-title">PINNED PROJECTS</text>
  <text x="30" y="48" class="hud-sub">LIVE FROM GITHUB // USER: ${USERNAME.toUpperCase()}</text>
  <line x1="30" y1="56" x2="${WIDTH - 30}" y2="56" stroke="${THEME.border}" stroke-width="1" />

  ${cardsSvg}
</svg>
`;
}

async function run() {
  try {
    console.log(`Fetching pinned repositories for user: ${USERNAME}...`);
    const repos = await fetchPinnedRepos();
    console.log(`Data received! Found ${repos.length} pinned repositories.`);

    const svgContent = buildSvg(repos);
    fs.writeFileSync("github-projects.svg", svgContent, "utf8");
    console.log("Successfully generated 'github-projects.svg'!");
  } catch (err) {
    console.error("Error generating SVG:", err);
    process.exit(1);
  }
}

run();
