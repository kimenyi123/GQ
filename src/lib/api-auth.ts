import { getBearerUser, issueJwt, verifyOAuthClientSecret, type JwtClaims } from "./auth";
import { jsonErr } from "./api";
import { prisma } from "./prisma";

export type AuthResult =
  | { user: JwtClaims; response: null }
  | { user: null; response: Response };

export async function readBearerUser(request: Request) {
  try {
    return await getBearerUser(request);
  } catch {
    return null;
  }
}

export async function requireAnyRole(
  request: Request,
  allowedRoles: readonly string[],
): Promise<AuthResult> {
  const user = await readBearerUser(request);

  if (!user) {
    return { user: null, response: jsonErr("Unauthorized", 401) };
  }

  if (!allowedRoles.includes(String(user.role))) {
    return { user: null, response: jsonErr("Forbidden", 403) };
  }

  return { user, response: null };
}

export async function requireSellerForTin(request: Request, tin: string) {
  const result = await requireAnyRole(request, ["seller", "admin", "GQ_ADMIN"]);

  if (result.response) {
    return result;
  }

  if (result.user.role === "seller" && result.user.tin !== tin) {
    return { user: null, response: jsonErr("Forbidden", 403) } as AuthResult;
  }

  return result;
}

export async function authenticateVendorRequest(request: Request, body?: Record<string, unknown>) {
  const bearer = await readBearerUser(request);

  if (bearer && ["vendor", "admin", "GQ_ADMIN"].includes(String(bearer.role))) {
    return bearer;
  }

  const clientId =
    request.headers.get("x-gq-client-id") ??
    (typeof body?.client_id === "string" ? body.client_id : undefined);
  const clientSecret =
    request.headers.get("x-gq-client-secret") ??
    (typeof body?.client_secret === "string" ? body.client_secret : undefined);

  if (!clientId || !clientSecret) {
    return null;
  }

  const vendor = await prisma.vendor.findFirst({
    where: { oauthClientId: clientId },
  });

  if (!vendor?.oauthClientSecretHash) {
    return null;
  }

  const valid = await verifyOAuthClientSecret(clientSecret, vendor.oauthClientSecretHash);

  if (!valid) {
    return null;
  }

  return {
    sub: vendor.vendorId,
    role: "vendor",
    vendorId: vendor.vendorId,
  };
}

export async function issueVendorJwt(vendorId: string) {
  return issueJwt({ sub: vendorId, role: "vendor", vendorId });
}
