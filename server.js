const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

let previousResult = null;
let finalResult = null;
let frozenData = null; // 25s पर freeze data

// Random.org API key (अपनी key डालना)
const RANDOM_ORG_API_KEY = "YOUR_RANDOM_ORG_API_KEY";

// ===== APIs =====
async function getCSRNG() {
  try {
    const res = await fetch("https://csrng.net/csrng/csrng.php?min=0&max=9");
    const data = await res.json();
    return data[0].random;
  } catch {
    return Math.floor(Math.random() * 10);
  }
}

async function getQRNG() {
  try {
    const res = await fetch("https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint8");
    const data = await res.json();
    return data.data[0] % 10;
  } catch {
    return Math.floor(Math.random() * 10);
  }
}

async function getRandomOrg() {
  try {
    const res = await fetch("https://api.random.org/json-rpc/4/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "generateIntegers",
        params: {
          apiKey: RANDOM_ORG_API_KEY,
          n: 1,
          min: 0,
          max: 9,
          replacement: true
        },
        id: 42
      })
    });
    const data = await res.json();
    return data.result.random.data[0];
  } catch {
    return Math.floor(Math.random() * 10);
  }
}

// ===== Frequency + Big/Small Tie Breaker =====
function decideResult(numbers) {
  const freq = {};
  numbers.forEach(n => freq[n] = (freq[n] || 0) + 1);

  let maxFreq = Math.max(...Object.values(freq));
  let candidates = Object.keys(freq).filter(n => freq[n] === maxFreq).map(Number);

  if (candidates.length === 1) return candidates[0];

  // Tie → Big/Small Rule
  let big = candidates.filter(n => n >= 5);
  let small = candidates.filter(n => n <= 4);

  if (big.length > small.length) return big[0];
  if (small.length > big.length) return small[0];

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===== Timer (हर सेकंड चेक) =====
setInterval(async () => {
  let sec = new Date().getSeconds();

  if (sec === 25) {
    // Freeze at 25s
    let csrng = await getCSRNG();
    let qrng = await getQRNG();
    let randomOrg = await getRandomOrg();

    frozenData = { csrng, qrng, randomOrg };
    console.log("Frozen at 25s:", frozenData);
  }

  if (sec === 30 && frozenData) {
    // Finalize at 30s
    let nums = [frozenData.csrng, frozenData.qrng, frozenData.randomOrg];
    finalResult = decideResult(nums);
    previousResult = finalResult;

    console.log("Final Result:", finalResult);
    frozenData = null; // reset
  }
}, 1000);

// ===== API for frontend =====
app.get("/result", (req, res) => {
  res.json({
    previous: previousResult,
    final: finalResult,
    csrng: frozenData ? frozenData.csrng : null,
    qrng: frozenData ? frozenData.qrng : null,
    randomOrg: frozenData ? frozenData.randomOrg : null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
