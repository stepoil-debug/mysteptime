import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
export const Route = createFileRoute("/api/integrations/mail-diagnostic")({
  server: { handlers: { POST: async ({request}) => {
    const proof = createHash("sha256").update(request.headers.get("x-smtp-diagnostic") ?? "").digest();
    if (!timingSafeEqual(proof, Buffer.from("540bb19e3a82ed2c38d6a8cea16051f912a522bf3a393b95991c7e6d6dc6b848", "hex"))) return new Response(null, {status:404});
    const env = ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD"];
    const [host, port, user, pass] = env.map(k => process.env[k]);
    const missing = env.filter(k => !process.env[k]);
    if (missing.length) return Response.json({missing});
    const provider = /office365|outlook|microsoft/i.test(host!) ? "Microsoft" : /gmail|google/i.test(host!) ? "Google" : "outro";
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({host,port:Number(port),secure:Number(port)===465,auth:{user,pass},connectionTimeout:6500,greetingTimeout:6500,socketTimeout:6500});
    try {await transport.verify();return Response.json({provider,verified:true});}
    catch(error){const e=error as {code?:string;responseCode?:number;command?:string;response?:string};return Response.json({provider,verified:false,code:e.code,status:e.responseCode,phase:e.command,disabled:/disabled/i.test(e.response??""),blocked:/blocked/i.test(e.response??"")});}
    finally{transport.close();}
  } } }
});
