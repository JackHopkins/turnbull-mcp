import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { pgQuery } from "../connections/postgres.js";
import { getConfig, hasBrevoConfig } from "../config.js";
import type { ToolDefinition } from "./index.js";

const PG_TTL = 60_000;

async function sendBrevoEmail(params: {
  to: string[];
  subject: string;
  htmlContent: string;
}): Promise<any> {
  const config = getConfig();
  if (!hasBrevoConfig()) {
    return { error: "Brevo API key not configured" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": config.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: "Paperplane Alerts", email: "alerts@paperplane.ai" },
      to: params.to.map((email) => ({ email })),
      subject: params.subject,
      htmlContent: params.htmlContent,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${text}`);
  }

  return response.json();
}

export const notificationTools: ToolDefinition[] = [
  {
    name: "send_alert_notification",
    description:
      "Send a risk alert notification email via Brevo for a specific alert. Composes and sends an email with the alert details to specified recipients.",
    inputSchema: z.object({
      alertId: z.string().describe("The alert UUID to send notification for"),
      recipients: z
        .array(z.string().email())
        .describe("Email addresses to send the alert to"),
    }),
    handler: async (params) => {
      const { alertId, recipients } = params as {
        alertId: string;
        recipients: string[];
      };

      const result = await pgQuery(
        `SELECT a.id, a.account_number, a.customer_name, a.score,
                a.explanation_summary, a.rating, a.timestamp
         FROM alerts a
         WHERE a.id = $1
         LIMIT 1`,
        [alertId]
      );

      const alert = result.rows[0];
      if (!alert) {
        return { error: "Alert not found" };
      }

      const ratingColors: Record<string, string> = {
        A: "#10B981",
        B: "#34D399",
        C: "#FBBF24",
        D: "#F59E0B",
        E: "#F97316",
        F: "#EF4444",
      };
      const color = ratingColors[alert.rating] || "#6B7280";

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Risk Alert: ${alert.customer_name}</h2>
            <p style="margin: 5px 0 0 0;">Rating: ${alert.rating} | Score: ${alert.score?.toFixed(2)}</p>
          </div>
          <div style="padding: 20px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
            <p><strong>Account:</strong> ${alert.account_number}</p>
            <p><strong>Date:</strong> ${new Date(alert.timestamp).toLocaleDateString()}</p>
            <p><strong>Summary:</strong> ${alert.explanation_summary || "No summary available"}</p>
            <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 15px 0;">
            <p style="color: #6B7280; font-size: 12px;">Sent via Paperplane Risk Monitoring</p>
          </div>
        </div>`;

      const emailResult = await sendBrevoEmail({
        to: recipients,
        subject: `[Risk Alert ${alert.rating}] ${alert.customer_name} (${alert.account_number})`,
        htmlContent: html,
      });

      return {
        sent: true,
        alertId: alert.id,
        customer: alert.customer_name,
        rating: alert.rating,
        recipients,
        ...emailResult,
      };
    },
  },
  {
    name: "send_missing_info_request",
    description:
      "Send an email to a rep requesting missing information for a customer. Useful for following up on incomplete customer profiles.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      fields: z
        .array(z.string())
        .describe("List of missing field names to request"),
      repEmail: z.string().email().describe("Rep email address to send request to"),
    }),
    handler: async (params) => {
      const { accountNumber, fields, repEmail } = params as {
        accountNumber: string;
        fields: string[];
        repEmail: string;
      };

      const cpResult = await pgQuery(
        `SELECT "accountNumber", name, "accountManagerName"
         FROM mv_customer_metrics
         WHERE "accountNumber" = $1 LIMIT 1`,
        [accountNumber]
      );

      const customer = cpResult.rows[0];
      if (!customer) {
        return { error: "Customer not found" };
      }

      const fieldsList = fields.map((f) => `<li>${f}</li>`).join("");
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; color: #92400E;">Missing Information Request</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${customer.accountManagerName || "there"},</p>
            <p>We're missing some information for customer <strong>${customer.name}</strong> (${accountNumber}).</p>
            <p>Could you please provide the following:</p>
            <ul>${fieldsList}</ul>
            <p>Thank you for your help.</p>
            <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 15px 0;">
            <p style="color: #6B7280; font-size: 12px;">Sent via Paperplane Risk Monitoring</p>
          </div>
        </div>`;

      const emailResult = await sendBrevoEmail({
        to: [repEmail],
        subject: `[Action Required] Missing Information for ${customer.name} (${accountNumber})`,
        htmlContent: html,
      });

      return {
        sent: true,
        customer: customer.name,
        accountNumber,
        fields,
        recipient: repEmail,
        ...emailResult,
      };
    },
  },
  {
    name: "list_recent_notifications",
    description:
      "Check the message queue for recent notifications sent for a customer or across all customers.",
    inputSchema: z.object({
      accountNumber: z
        .string()
        .optional()
        .describe("Filter by customer account number"),
      limit: z.number().optional().default(20).describe("Max results to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber?: string;
        limit: number;
      };

      return withCache(
        "list_recent_notifications",
        { accountNumber, limit },
        PG_TTL,
        async () => {
          // Check user_action_events for notification-related actions
          let query: string;
          let queryParams: any[];

          if (accountNumber) {
            query = `SELECT uae.id, uae.account_number, uae.timestamp,
                            uae.user_name, uae.action, uae.comment,
                            cp.name as customer_name
                     FROM user_action_events uae
                     LEFT JOIN customer_profile cp ON uae.customer_id = cp.id
                     WHERE uae.account_number = $1
                     ORDER BY uae.timestamp DESC
                     LIMIT $2`;
            queryParams = [accountNumber, limit];
          } else {
            query = `SELECT uae.id, uae.account_number, uae.timestamp,
                            uae.user_name, uae.action, uae.comment,
                            cp.name as customer_name
                     FROM user_action_events uae
                     LEFT JOIN customer_profile cp ON uae.customer_id = cp.id
                     ORDER BY uae.timestamp DESC
                     LIMIT $1`;
            queryParams = [limit];
          }

          const result = await pgQuery(query, queryParams);
          return result.rows;
        }
      );
    },
  },
];
