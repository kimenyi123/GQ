import fs from "fs";
import path from "path";

const html = fs.readFileSync("C:/Users/kimai/Downloads/ebm_rw.html", "utf8");
const re = /src="(data:image\/png;base64,[^"]+)"[^>]*alt="([^"]*)"/g;
const outDir = path.resolve("public/brand");
fs.mkdirSync(outDir, { recursive: true });

let match;
let i = 0;
while ((match = re.exec(html))) {
  const alt = match[2].toLowerCase();
  let name = `asset${i}`;
  if (alt.includes("rwanda revenue")) name = "rra-logo";
  else if (alt.includes("kinyarwanda")) name = "flag-rw";
  else if (alt.includes("english")) name = "flag-en";
  else if (alt.includes("francais") || alt.includes("français")) name = "flag-fr";
  else if (alt.includes("kiswahili")) name = "flag-sw";

  const b64 = match[1].replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(outDir, `${name}.png`), buf);
  console.log(name, buf.length);
  i += 1;
}
