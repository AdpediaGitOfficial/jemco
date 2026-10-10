/* A tiny OpenID Connect provider for tests: discovery, authorize (auto-consents as the chosen user), token, jwks. */
import http from "http";
import { SignJWT, generateKeyPair, exportJWK } from "jose";

export async function startMockIdp(port: number) {
  const ISS = `http://localhost:${port}`;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", use: "sig", alg: "RS256" };
  const codes = new Map<string, { nonce: string; client: string; email: string }>();
  const users: Record<string, { name: string; email_verified: boolean }> = {
    "sales@jemco.local": { name: "Sales Rep", email_verified: true }, "new.person@jemco.local": { name: "New Person", email_verified: true },
    "intruder@gmail.com": { name: "Intruder", email_verified: true }, "unverified@jemco.local": { name: "Unverified", email_verified: false },
  };
  let who = "sales@jemco.local";
  const json = (res: http.ServerResponse, o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url!, ISS);
    if (u.pathname === "/.well-known/openid-configuration") return json(res, { issuer: ISS, authorization_endpoint: `${ISS}/authorize`, token_endpoint: `${ISS}/token`, jwks_uri: `${ISS}/jwks`, response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"] });
    if (u.pathname === "/jwks") return json(res, { keys: [jwk] });
    if (u.pathname === "/as") { who = u.searchParams.get("email")!; return json(res, { who }); }
    if (u.pathname === "/authorize") {
      const code = Math.random().toString(36).slice(2);
      codes.set(code, { nonce: u.searchParams.get("nonce")!, client: u.searchParams.get("client_id")!, email: who });
      const back = new URL(u.searchParams.get("redirect_uri")!); back.searchParams.set("code", code); back.searchParams.set("state", u.searchParams.get("state")!);
      res.writeHead(302, { location: back.href }); return res.end();
    }
    if (u.pathname === "/token") {
      let body = ""; for await (const c of req) body += c; const p = new URLSearchParams(body);
      const auth = req.headers.authorization ? Buffer.from(req.headers.authorization.split(" ")[1], "base64").toString() : `${p.get("client_id")}:${p.get("client_secret")}`;
      if (auth !== "jemco-ncr:s3cret") return json(res, { error: "invalid_client" }, 401);
      const c = codes.get(p.get("code")!); if (!c) return json(res, { error: "invalid_grant" }, 400); codes.delete(p.get("code")!);
      const prof = users[c.email];
      const id_token = await new SignJWT({ nonce: c.nonce, email: c.email, email_verified: prof.email_verified, name: prof.name }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(ISS).setAudience(c.client).setSubject(c.email).setIssuedAt().setExpirationTime("5m").sign(privateKey);
      return json(res, { access_token: "at", token_type: "Bearer", expires_in: 300, id_token });
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(port, r));
  return { close: () => server.close() };
}
