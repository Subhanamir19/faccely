import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import http from "node:http";
import WebSocket from "ws";

const ROOT = resolve(new URL("..", import.meta.url).pathname.slice(1));
const VIDEO_DIR = join(ROOT, "assets", "new-exercises-videos");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = join(ROOT, ".tmp", "chrome-video-thumbs", String(process.pid));

const JOBS = [
  ["alternating-cheek-puffs", "alternating-cheek-puffs-.mp4", "alternating-cheek-puffs-pose2.png"],
  ["chi-ball-training", "chi-ball-training.mp4", "chi-ball-training-pose2.png"],
  ["chin-forcing-while-laying-down", "chin-forcing-while-laying-down .mp4", "chin-forcing-while-laying-down-pose2.png"],
  ["chin-massage", "chin-massage.mp4", "chin-massage-pose2.png"],
  ["downward-chin-forcing", "downward-chin-forcing.mp4", "downward-chin-forcing-pose2.png"],
  ["eyebrows-lifting", "eyebrows-lifting.mp4", "eyebrows-lifting-pose2.png"],
  ["forward-pulling-neck", "forward-pulling-neck.mp4", "forward-pulling-neck-pose2.png"],
  ["jaw-forcing", "jaw-forcing.mp4", "jaw-forcing-pose2.png"],
  ["neck-massage", "neck-massage.mp4", "neck-massage-pose2.png"],
  ["neck-pull", "neck-pull.mp4", "neck-pull-pose2.png"],
  ["orbicularis-muscles-eye", "orbicularis-muscles-eye.mp4", "orbicularis-muscles-eye-pose2.png"],
  ["side-tongue", "side-tongue.mp4", "side-tongue-pose2.png"],
  ["slim-nose-side", "slim-nose-side.mp4", "slim-nose-side-pose2.png"],
  ["slim-nose1", "slim-nose1.mp4", "slim-nose1-pose2.png"],
  ["slim-nose2", "slim-nose2.mp4", "slim-nose2-pose2.png"],
  ["tongue-nose-touching", "tongue-nose-touching.mp4", "tongue-nose-touching-pose2.png"],
  ["upward-chin-stretch", "upward-chin-stretch .mp4", "upward-chin-stretch-pose2.png"],
];

function contentType(file) {
  if (extname(file).toLowerCase() === ".mp4") return "video/mp4";
  return "text/html; charset=utf-8";
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><meta charset='utf-8'><title>Facely thumbnail extractor</title>");
      return;
    }

    if (!url.pathname.startsWith("/video/")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const fileName = decodeURIComponent(url.pathname.slice("/video/".length));
    const filePath = join(VIDEO_DIR, fileName);
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Missing video");
      return;
    }

    const stat = statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416);
        res.end();
        return;
      }

      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      res.writeHead(206, {
        "content-type": contentType(filePath),
        "content-length": end - start + 1,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "content-type": contentType(filePath),
      "content-length": stat.size,
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  });
}

async function listen(server) {
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return server.address().port;
}

async function waitForChrome(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  for (let i = 0; i < 80; i += 1) {
    try {
      const targets = await fetch(endpoint).then((res) => res.json());
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 125));
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (!msg.id) return;
    const resolver = pending.get(msg.id);
    if (!resolver) return;
    pending.delete(msg.id);
    if (msg.error) resolver.reject(new Error(JSON.stringify(msg.error)));
    else resolver.resolve(msg.result);
  });

  return new Promise((resolveOpen, rejectOpen) => {
    ws.once("open", () => {
      resolveOpen({
        send(method, params = {}, timeoutMs = 30000) {
          const id = ++seq;
          const payload = JSON.stringify({ id, method, params });
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              reject(new Error(`Timed out waiting for CDP ${method}`));
            }, timeoutMs);
            pending.set(id, {
              resolve(value) {
                clearTimeout(timeout);
                resolve(value);
              },
              reject(error) {
                clearTimeout(timeout);
                reject(error);
              },
            });
            ws.send(payload);
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.once("error", rejectOpen);
  });
}

async function main() {
  if (!existsSync(CHROME)) throw new Error(`Chrome was not found at ${CHROME}`);
  mkdirSync(PROFILE_DIR, { recursive: true });

  const missing = JOBS.filter(([, input]) => !existsSync(join(VIDEO_DIR, input)));
  if (missing.length > 0) {
    throw new Error(`Missing input videos: ${missing.map(([id]) => id).join(", ")}`);
  }

  const server = createServer();
  const assetPort = await listen(server);
  const cdpPort = 9222 + Math.floor(Math.random() * 1000);
  console.log(`Serving videos on ${assetPort}; launching Chrome DevTools on ${cdpPort}`);
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${PROFILE_DIR}`,
    `http://127.0.0.1:${assetPort}/`,
  ], { stdio: "ignore" });

  try {
    const wsUrl = await waitForChrome(cdpPort);
    console.log("Chrome DevTools ready");
    const cdp = await createCdp(wsUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    async function extractJob(job) {
      const expression = `
      (async () => {
        const job = ${JSON.stringify(job)};
        const waitFor = (target, event, test) => new Promise((resolve, reject) => {
          if (test && test()) {
            resolve();
            return;
          }
          const timeout = setTimeout(() => reject(new Error('Timed out waiting for ' + event + ' on ' + job.input)), 15000);
          target.addEventListener(event, () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          target.addEventListener('error', () => {
            clearTimeout(timeout);
            reject(new Error('Video decode failed for ' + job.input));
          }, { once: true });
        });

        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        video.playsInline = true;
        video.src = '/video/' + encodeURIComponent(job.input);
        document.body.appendChild(video);
        video.load();
        await waitFor(video, 'loadedmetadata', () => video.readyState >= 1);

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        const targetTime = Math.max(0, Math.min(duration - 0.05, duration * 0.72));
        video.currentTime = targetTime;
        await waitFor(video, 'seeked', () => Math.abs(video.currentTime - targetTime) < 0.04 && video.readyState >= 2);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        video.remove();

        return {
          id: job.id,
          input: job.input,
          output: job.output,
          duration,
          time: video.currentTime,
          width: canvas.width,
          height: canvas.height,
          dataUrl,
        };
      })()
    `;

      const result = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });

      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text ?? `Failed to extract ${job.input}`);
      }
      return result.result.value;
    }

    for (const [id, input, output] of JOBS) {
      console.log(`Extracting ${id} from ${input}`);
      const frame = await extractJob({ id, input, output });
      const base64 = frame.dataUrl.replace(/^data:image\/png;base64,/, "");
      writeFileSync(join(VIDEO_DIR, frame.output), Buffer.from(base64, "base64"));
      console.log(`${frame.output} <- ${frame.input} @ ${frame.time.toFixed(2)}s / ${frame.duration.toFixed(2)}s (${frame.width}x${frame.height})`);
        }

    cdp.close();
  } finally {
    chrome.kill();
    server.close();
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch {
      // Temporary profile cleanup is best-effort.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
