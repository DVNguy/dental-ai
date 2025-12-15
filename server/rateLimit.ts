import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Rate Limiting Configuration for AI Endpoints
 * 
 * DEFAULTS:
 * - Authenticated users: 30 requests per minute (per userId)
 * - Unauthenticated/Anonymous: 10 requests per minute (per IP)
 * 
 * These limits apply to:
 * - /api/ai/* (all AI endpoints)
 * - /api/v1/rag/query (RAG query endpoint)
 * 
 * Rate-Key Strategy:
 * - If session.userId exists → use userId as key (more generous limit)
 * - Otherwise → use IP address as key (stricter limit)
 */

const AUTHENTICATED_LIMIT = 30; // requests per minute for logged-in users
const ANONYMOUS_LIMIT = 10;     // requests per minute for anonymous/IP-based
const WINDOW_MS = 60 * 1000;    // 1 minute window

function getKeyGenerator(req: Request): string {
  if (req.session?.userId) {
    return `user:${req.session.userId}`;
  }
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return `ip:${ip}`;
}

function getMaxRequests(req: Request): number {
  return req.session?.userId ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;
}

export const aiRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: getMaxRequests,
  keyGenerator: getKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: Request, res: Response) => {
    const isAuthenticated = !!req.session?.userId;
    const limit = isAuthenticated ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;
    return {
      error: "Too many requests",
      message: `Rate limit exceeded. Max ${limit} requests per minute.`,
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    };
  },
  handler: (req: Request, res: Response) => {
    const isAuthenticated = !!req.session?.userId;
    const limit = isAuthenticated ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;
    res.status(429).json({
      error: "Too many requests",
      message: `Rate limit exceeded. Max ${limit} requests per minute.`,
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    });
  },
});

/**
 * Simple in-memory AI Budget Guard per Practice
 * 
 * DEFAULTS:
 * - Max 100 AI calls per practice per day
 * - Resets daily at midnight UTC
 * 
 * This is a simple implementation using in-memory storage.
 * For production, consider using Redis or database storage.
 */

const DAILY_AI_BUDGET_PER_PRACTICE = 100;

interface BudgetEntry {
  count: number;
  resetAt: number;
}

const practiceAiBudgets = new Map<string, BudgetEntry>();

function getResetTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

export function checkAiBudget(practiceId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = practiceAiBudgets.get(practiceId);
  
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: getResetTimestamp() };
    practiceAiBudgets.set(practiceId, entry);
  }
  
  const remaining = DAILY_AI_BUDGET_PER_PRACTICE - entry.count;
  
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt: entry.resetAt,
  };
}

export function incrementAiBudget(practiceId: string): void {
  const now = Date.now();
  let entry = practiceAiBudgets.get(practiceId);
  
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: getResetTimestamp() };
  } else {
    entry.count++;
  }
  
  practiceAiBudgets.set(practiceId, entry);
}

export function aiBudgetGuard(req: Request, res: Response, next: Function): void {
  const practiceId = req.session?.practiceId;
  
  if (!practiceId) {
    return next();
  }
  
  const budget = checkAiBudget(practiceId);
  
  if (!budget.allowed) {
    res.status(429).json({
      error: "Daily AI budget exceeded",
      message: `Your practice has reached the daily limit of ${DAILY_AI_BUDGET_PER_PRACTICE} AI calls.`,
      remaining: 0,
      resetAt: new Date(budget.resetAt).toISOString(),
    });
    return;
  }
  
  incrementAiBudget(practiceId);
  
  res.setHeader("X-AI-Budget-Remaining", budget.remaining - 1);
  res.setHeader("X-AI-Budget-Reset", new Date(budget.resetAt).toISOString());
  
  next();
}

export const RATE_LIMIT_CONFIG = {
  authenticatedLimit: AUTHENTICATED_LIMIT,
  anonymousLimit: ANONYMOUS_LIMIT,
  windowMs: WINDOW_MS,
  dailyAiBudget: DAILY_AI_BUDGET_PER_PRACTICE,
};
