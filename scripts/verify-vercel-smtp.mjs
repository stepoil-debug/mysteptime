import nodemailer from "nodemailer";
const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
const [host, port, user, pass] = keys.map(k => process.env[k]);
const provider = /office365|outlook|microsoft/i.test(host || "") ? "Microsoft" : /gmail|google/i.test(host || "") ? "Google" : "outro";
const missing = keys.filter(k => !process.env[k]);
if (missing.length) {
  console.log("[MYSTEPTIME_SMTP_VERIFY]", JSON.stringify({ missing }));
} else {
  const transport = nodemailer.createTransport({ host, port: Number(port), secure: Number(port) === 465, auth: { user, pass }, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 7000, debug: false, logger: false });
  try {
    await transport.verify();
    console.log("[MYSTEPTIME_SMTP_VERIFY]", JSON.stringify({ provider, verified: true }));
  } catch (error) {
    console.log("[MYSTEPTIME_SMTP_VERIFY]", JSON.stringify({ provider, verified: false, code: error.code, status: error.responseCode, phase: error.command, disabled: /disabled/i.test(error.response || ""), blocked: /blocked/i.test(error.response || "") }));
  } finally {
    transport.close();
  }
}
