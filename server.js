import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

async function fetchCSRNG() {
  try {
    const res = await fetch("https://csrng.net/csrng/csrng.php?min=0&max=9");
    const data = await res.json();
    return data[0].random;
  } catch {
    return null;
  }
}

async function fetchQRNG() {
  try {
    const res = await fetch("https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint8");
    const data = await res.json();
    return data.data[0] % 10;
  } catch {
    return null;
  }
}

async function fetchRandomOrg() {
  try {
    const apiKey = process.env.RANDOM_ORG_API_KEY;
    const res = await fetch("https://api.random.org/json-rpc/4/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "generateIntegers",
        params: { apiKey, n: 1, min: 0, max: 9 },
        id: 42
      })
    });
    const data = await res.json();
    return data.result.random.data[0];
  } catch {
    return null;
  }
}

function getFinalResult(nums) {
  const counts = {};
  nums.forEach(n => {
    counts[n] = (counts[n] || 0) + 1;
  });

  let maxFreq = 0;
  let candidates = [];
  for (let [num, freq] of Object.entries(counts)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      candidates = [parseInt(num)];
    } else if (freq === maxFreq) {
      candidates.push(parseInt(num));
    }
  }

  if (candidates.length === 1) return candidates[0];

  const big = candidates.filter(n => n >= 5);
  const small = candidates.filter(n => n <= 4);
  if (big.length > small.length) return big[0];
  else return small[0];
}

let lastResult = null;

app.get("/result", async (req, res) => {
  const csrng = await fetchCSRNG();
  const qrng = await fetchQRNG();
  const randomOrg = await fetchRandomOrg();

  const nums = [csrng, qrng, randomOrg].filter(n => n !== null);
  const final = getFinalResult(nums);

  const response = {
    sources: { csrng, qrng, randomOrg },
    final,
    previous: lastResult
  };
  lastResult = final;

  res.json(response);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
