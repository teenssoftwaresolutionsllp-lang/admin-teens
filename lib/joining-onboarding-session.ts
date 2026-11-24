import { createHmac, timingSafeEqual } from "node:crypto";

export const ONBOARDING_SESSION_COOKIE =
  "candidate_onboarding_session";

export interface OnboardingSession {
  candidateId: string;
  submissionId: string;
  tokenId: string;
  expiresAt: string;
}

function getSessionSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Server session signing configuration is missing."
    );
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createOnboardingSession(
  session: OnboardingSession
): string {
  const payload = Buffer.from(
    JSON.stringify(session)
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyOnboardingSession(
  value: string | undefined
): OnboardingSession | null {
  if (
    !value ||
    value.length > 4096
  ) {
    return null;
  }

  try {
    const parts = value.split(".");

    if (parts.length !== 2) return null;

    const [payload, suppliedSignature] = parts;

    // SHA-256 base64url signatures are exactly 43 characters.
    if (
      !/^[A-Za-z0-9_-]+$/.test(payload) ||
      !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)
    ) {
      return null;
    }

    const expectedSignature = sign(payload);

    const suppliedBuffer = Buffer.from(
      suppliedSignature,
      "base64url"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "base64url"
    );

    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(
        suppliedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const parsed: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const session = parsed as Record<string, unknown>;

    if (
      typeof session.candidateId !== "string" ||
      typeof session.submissionId !== "string" ||
      typeof session.tokenId !== "string" ||
      typeof session.expiresAt !== "string"
    ) {
      return null;
    }

    // These IDs must be valid UUIDs.
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      !uuidPattern.test(session.candidateId) ||
      !uuidPattern.test(session.submissionId) ||
      !uuidPattern.test(session.tokenId)
    ) {
      return null;
    }

    const expiry = Date.parse(session.expiresAt);

    if (
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      return null;
    }

    return {
      candidateId: session.candidateId,
      submissionId: session.submissionId,
      tokenId: session.tokenId,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}