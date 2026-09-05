const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const decisionSchema = z.object({
  failureCategory: z
    .enum([
      "insufficient_funds",
      "card_declined",
      "otp_timeout",
      "bank_server_issue",
      "network_drop",
      "checkout_abandoned",
      "suspected_fraud",
      "other",
    ])
    .describe("Best-fit category for why this payment failed or was abandoned"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident the model is in this classification, 0 to 1"),
  suggestedAction: z
    .enum([
      "retry_payment_link",
      "send_discount_nudge",
      "send_reminder",
      "escalate_manual",
      "no_action_low_value",
    ])
    .describe("The recovery action the model believes fits best, before business guardrails are applied"),
  reasoning: z
    .string()
    .describe("One or two sentence explanation a human reviewer can audit, referencing specifics of the failure text"),
});

async function classifyTransaction({ amount, method, failureReasonRaw, eventType }) {
  const prompt = `You are a payments recovery analyst. Classify why this transaction failed and suggest a recovery action.

Transaction details:
- Amount: ₹${amount}
- Payment method: ${method || "unknown"}
- Event type: ${eventType}
- Raw failure/drop-off message from the payment gateway: "${failureReasonRaw || "no message provided"}"

Guidance:
- "insufficient_funds" and "card_declined" are usually worth a retry link.
- "otp_timeout" and "network_drop" are transient — a retry or reminder often works.
- "bank_server_issue" is transient and outside the customer's control — a gentle reminder is safer than pushing a retry immediately.
- "checkout_abandoned" (no payment attempt was made) often responds to a small discount nudge.
- "suspected_fraud" or anything mentioning manual verification must be escalated to a human, never auto-retried.
- If the message is unclear, garbled, or you are not confident, say so honestly with low confidence and suggest escalate_manual — do not guess.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToJsonSchema(decisionSchema),
    },
  });

  const parsed = JSON.parse(response.text);
  return decisionSchema.parse(parsed); // throws if Gemini's output doesn't match the schema — caught by the caller
}

module.exports = { classifyTransaction, decisionSchema };
