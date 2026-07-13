import { getBearerUser, Role } from "./auth";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data }, init);
}

export function jsonErr(
  message: string,
  status = 400,
  details?: Record<string, unknown>,
) {
  return Response.json(
    { ok: false, error: { message, details } },
    { status },
  );
}

export async function requireRole(request: Request, allowedRoles: Role[]) {
  const user = await getBearerUser(request);

  if (!user) {
    return { user: null, response: jsonErr("Unauthorized", 401) };
  }

  if (!allowedRoles.includes(user.role as Role)) {
    return { user: null, response: jsonErr("Forbidden", 403) };
  }

  return { user, response: null };
}

export function rateLimitStub(key: string) {
  void key;
  return { allowed: true, remaining: 100, resetAt: new Date(Date.now() + 60000) };
}
