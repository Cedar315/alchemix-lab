import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db/prisma";

const COOKIE_NAME = "alchemix_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV !== "production") {
    return "alchemix-development-only-session-secret";
  }
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }
  return value;
}

function sign(userId: string) {
  return createHmac("sha256", secret()).update(userId).digest("base64url");
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => Boolean(key && value))
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
}

function verifiedUserId(request: Request) {
  const value = parseCookies(request)[COOKIE_NAME];
  if (!value) return null;
  const [userId, signature] = value.split(".");
  if (!userId || !signature) return null;

  const expected = Buffer.from(sign(userId));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return userId;
}

export async function getOrCreateSessionUser(request: Request) {
  const existingId = verifiedUserId(request);
  const userId = existingId ?? randomUUID();

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `anonymous-${userId}@alchemix.invalid`,
      nickname: "Anonymous Mixologist",
    },
  });

  return { userId, isNew: !existingId };
}

export function attachSessionCookie(response: Response, userId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(`${userId}.${sign(userId)}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`,
  );
  return response;
}

export function sessionResponse(response: Response, session: { userId: string; isNew: boolean }) {
  return session.isNew ? attachSessionCookie(response, session.userId) : response;
}
