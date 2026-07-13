import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import {
  generateOAuthClientId,
  generateOAuthClientSecret,
} from "./ids";

export const roles = [
  "citizen",
  "seller",
  "vendor",
  "agent",
  "admin",
  "rra",
] as const;

export type Role = (typeof roles)[number];

export type JwtClaims = {
  sub: string;
  role: Role | string;
  tin?: string;
  vendorId?: string;
};

function jwtSecret() {
  const secret = process.env.GQ_JWT_SECRET;

  if (!secret) {
    throw new Error("GQ_JWT_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

function otpPepper() {
  return process.env.GQ_OTP_PEPPER ?? "";
}

export async function hashOtp(code: string) {
  return bcrypt.hash(`${code}:${otpPepper()}`, 10);
}

export async function verifyOtp(code: string, codeHash: string) {
  return bcrypt.compare(`${code}:${otpPepper()}`, codeHash);
}

export async function issueJwt(claims: JwtClaims) {
  return new SignJWT({
    role: claims.role,
    tin: claims.tin,
    vendorId: claims.vendorId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret());
}

export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret());

  return {
    sub: payload.sub,
    role: payload.role,
    tin: payload.tin,
    vendorId: payload.vendorId,
  } as JwtClaims;
}

export async function issueOAuthClientCredentials() {
  const clientId = generateOAuthClientId();
  const clientSecret = generateOAuthClientSecret();
  const clientSecretHash = await bcrypt.hash(clientSecret, 12);

  return { clientId, clientSecret, clientSecretHash };
}

export async function verifyOAuthClientSecret(
  clientSecret: string,
  clientSecretHash: string,
) {
  return bcrypt.compare(clientSecret, clientSecretHash);
}

export async function getBearerUser(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return verifyJwt(authorization.slice("Bearer ".length));
}
