import fs from "node:fs";
import https from "node:https";

export const USERNAME = process.env.GH_USERNAME || "MiaUgljesic";
export const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
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
  gridBg: "#12060D",
  textPink: "#F9A8D4",
  textDim: "#B4849C",
  valuePink: "#F472B6",
  palette: ["#1F0E18", "#7A1C4D", "#C2255C", "#EC4899", "#F9A8D4"],
};

function fetchContributions() {
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
          resolve(parsed.data.user.contributionsCollection.contributionCalendar);
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

const HEIGHT = 300;
const PADDING_X = 52;   
const PADDING_Y = 92;   
const CELL = 14;
const GAP = 4;
const STEP = CELL + GAP;
const RIGHT_MARGIN = 30;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = { 1: "Mon", 3: "Wed", 5: "Fri" }; // row index -> label (0 = Sunday)


function getLevelColor(count, maxCount) {
  if (count <= 0 || maxCount <= 0) return THEME.palette[0];
  const ratio = count / maxCount;
  if (ratio > 0.75) return THEME.palette[4];
  if (ratio > 0.5) return THEME.palette[3];
  if (ratio > 0.25) return THEME.palette[2];
  return THEME.palette[1];
}

function buildSvg(calendar) {
  const total = calendar.totalContributions;
  const weeks = calendar.weeks;
  const weekCount = weeks.length;

  const gridWidth = (weekCount - 1) * STEP + CELL;
  const WIDTH = PADDING_X + gridWidth + RIGHT_MARGIN;

  const maxCount = weeks.reduce((max, w) => {
    const weekMax = w.contributionDays.reduce((m, d) => Math.max(m, d.contributionCount), 0);
    return Math.max(max, weekMax);
  }, 0);

  let cellsSvg = "";
  let monthLabelsSvg = "";
  let lastMonth = null;
  let lastLabelCol = -3;

  weeks.forEach((w, colIdx) => {
    w.contributionDays.forEach((d, rowIdx) => {
      const x = PADDING_X + colIdx * STEP;
      const y = PADDING_Y + rowIdx * STEP;
      const color = getLevelColor(d.contributionCount, maxCount);

      cellsSvg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${color}" data-count="${d.contributionCount}" data-date="${d.date}">
        <title>${d.contributionCount} contributions on ${d.date}</title>
      </rect>\n`;

      if (rowIdx === 0) {
        const month = new Date(d.date).getUTCMonth();
        if (month !== lastMonth && colIdx - lastLabelCol >= 3) {
          monthLabelsSvg += `<text x="${x}" y="${PADDING_Y - 10}" class="hud-sub">${MONTH_NAMES[month]}</text>\n`;
          lastMonth = month;
          lastLabelCol = colIdx;
        }
      }
    });
  });

  let dayLabelsSvg = "";
  for (const [rowIdx, label] of Object.entries(DAY_LABELS)) {
    const y = PADDING_Y + Number(rowIdx) * STEP + CELL - 3;
    dayLabelsSvg += `<text x="${PADDING_X - 10}" y="${y}" text-anchor="end" class="hud-sub">${label}</text>\n`;
  }

  const legendY = PADDING_Y + 7 * STEP + 4 + 22;
  const legendSquareSize = 11;
  const legendGap = 3;
  let legendSquaresSvg = "";
  THEME.palette.forEach((color, i) => {
    const lx = PADDING_X + 34 + i * (legendSquareSize + legendGap);
    legendSquaresSvg += `<rect x="${lx}" y="${legendY - legendSquareSize + 2}" width="${legendSquareSize}" height="${legendSquareSize}" rx="2" ry="2" fill="${color}" />\n`;
  });
  const legendMoreX = PADDING_X + 34 + THEME.palette.length * (legendSquareSize + legendGap) + 6;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&amp;display=swap');
      text { font-family: 'Share Tech Mono', monospace, 'Courier New', sans-serif; }

      .bg { fill: ${THEME.bg}; }
      .border { stroke: ${THEME.border}; stroke-width: 1.5; fill: none; }
      .grid-bg { fill: ${THEME.gridBg}; stroke: ${THEME.border}; stroke-width: 1; }

      .hud-title { font-size: 14px; font-weight: bold; fill: #ffffff; letter-spacing: 1.5px; }
      .hud-sub { font-size: 11px; fill: ${THEME.textDim}; letter-spacing: 1px; }
      .hud-val-pink { font-size: 12px; fill: ${THEME.valuePink}; font-weight: bold; }
      .hud-label-pink { font-size: 11px; fill: ${THEME.textPink}; opacity: 0.8; }

      @keyframes scanline {
        0% { transform: translateY(0); }
        100% { transform: translateY(${HEIGHT}px); }
      }
      .scanline {
        width: 100%;
        height: 2px;
        background: linear-gradient(to bottom, transparent, rgba(249, 168, 212, 0.15), transparent);
        animation: scanline 8s linear infinite;
      }
    </style>

    <pattern id="starGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.8" fill="#ffffff" opacity="0.12" />
      <circle cx="30" cy="25" r="0.6" fill="#F9A8D4" opacity="0.2" />
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" class="bg" />
  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="url(#starGrid)" />
  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="9" class="border" />

  <g transform="translate(0, 0)">
    <text x="30" y="32" class="hud-title">GITHUB ACTIVITY</text>
    <text x="30" y="48" class="hud-sub">CONTRIBUTIONS // LAST 12 MONTHS</text>

    <text x="${WIDTH - 30}" y="32" text-anchor="end"><tspan class="hud-label-pink">TOTAL CONTRIBUTIONS: </tspan><tspan class="hud-val-pink">${total.toLocaleString()}</tspan></text>
    <line x1="30" y1="56" x2="${WIDTH - 30}" y2="56" stroke="${THEME.border}" stroke-width="1" />
  </g>

  <g id="month-labels">
    ${monthLabelsSvg}
  </g>

  <g id="day-labels">
    ${dayLabelsSvg}
  </g>

  <g id="heatmap-grid">
    <rect x="${PADDING_X - 6}" y="${PADDING_Y - 6}" width="${gridWidth + 8}" height="${7 * STEP + 4}" rx="6" class="grid-bg" />
    ${cellsSvg}
  </g>

  <g id="legend">
    <text x="${PADDING_X}" y="${legendY}" class="hud-sub">Less</text>
    ${legendSquaresSvg}
    <text x="${legendMoreX}" y="${legendY}" class="hud-sub">More</text>
  </g>

  <g transform="translate(30, ${HEIGHT - 20})">
    <text x="0" y="0" class="hud-sub">[CONTRIBUTION GRID // USER: ${USERNAME.toUpperCase()}]</text>
    <text x="${WIDTH - 60}" y="0" text-anchor="end" class="hud-sub">REFRESH: DAILY AT 05:30 UTC</text>
  </g>
</svg>
`;
}

async function run() {
  try {
    console.log(`Fetching Github contribution data for user: ${USERNAME}...`);
    const calendar = await fetchContributions();
    console.log(`Data received! Total contributions: ${calendar.totalContributions}`);

    const svgContent = buildSvg(calendar);
    fs.writeFileSync("github-jet.svg", svgContent, "utf8");
    console.log("Successfully generated 'github-jet.svg'!");
  } catch (err) {
    console.error("Error generating SVG:", err);
    process.exit(1);
  }
}

run();
