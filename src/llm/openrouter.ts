import { getConfig, hasOpenRouterConfig } from "../config.js";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4.1-mini";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const TURNBULL_SYSTEM_PROMPT = `You are a financial analyst assistant for Turnbull, a building materials distributor. You analyze customer risk data and provide clear, actionable insights.

Risk Rating Scale:
- Rating 1 (A): Lowest risk - reliable customer, pays on time
- Rating 2 (B): Low risk - generally good payment behavior
- Rating 3 (C): Moderate risk - some late payments or minor concerns
- Rating 4 (D): Elevated risk - pattern of late payments or credit issues
- Rating 5 (E): High risk - significant overdue amounts or credit breaches
- Rating 6 (F): Critical risk - severe financial distress indicators

Key Metrics:
- running_balance: Current outstanding balance
- days_beyond_terms: How many days past agreed payment terms
- credit_usage: Percentage of credit limit used
- risk_score: ML model output (0-1, higher = riskier)
- insurance_limit: Trade credit insurance coverage amount

Always be specific with numbers and dates. Flag any critical concerns prominently.`;

export async function llmAnalyze(
  userPrompt: string,
  systemPromptOverride?: string
): Promise<string> {
  if (!hasOpenRouterConfig()) {
    return "OpenRouter API key not configured. LLM analysis unavailable.";
  }

  const config = getConfig();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPromptOverride || TURNBULL_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const response = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "No response generated.";
}
