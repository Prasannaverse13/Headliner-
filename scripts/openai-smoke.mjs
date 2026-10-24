const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL;
console.log("model:", model);
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({ model, messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }], response_format: { type: "json_object" } }),
});
const t = await res.text();
console.log("status:", res.status);
console.log(t.slice(0, 600));
