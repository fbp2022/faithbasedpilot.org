// netlify/functions/contact.js
import fetch from "node-fetch";

export const handler = async (event) => {
  try {
    // Accept both JSON and URL-encoded form posts
    const isJson = (event.headers["content-type"] || "").includes("application/json");
    const body = isJson
      ? JSON.parse(event.body || "{}")
      : Object.fromEntries(new URLSearchParams(event.body || ""));

    const token  = body["g-recaptcha-response"];
    const action = "contact";

    // --- Verify with reCAPTCHA Enterprise ---
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.PROJECT_ID}/assessments?key=${process.env.API_KEY}`;
    const verify = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: { token, siteKey: process.env.SITE_KEY, expectedAction: action }
      })
    }).then(r => r.json());

    const valid   = verify?.tokenProperties?.valid === true;
    const matches = verify?.tokenProperties?.action === action;
    const score   = verify?.riskAnalysis?.score ?? 0;

    if (!valid || !matches || score < 0.5) {
      return { statusCode: 400, body: JSON.stringify({ error: "captcha_failed", score }) };
    }

    // --- Forward to Formspree (replace with your own mailer if you prefer) ---
    const resp = await fetch(`https://formspree.io/f/${process.env.YOUR_FORMSPREE_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        name: body.name,
        _replyto: body._replyto || body.email,
        message: body.message
      })
    });

    if (!resp.ok) return { statusCode: 502, body: "forward_failed" };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "server_error" };
  }
};
