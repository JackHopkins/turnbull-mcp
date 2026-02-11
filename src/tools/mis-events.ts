import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getEventsList,
  getEventRegistrations,
  getCustomerEvents,
  getEventRewards,
  getEventRedemptions,
} from "../queries/mis/events.js";
import type { ToolDefinition } from "./index.js";

const MIS_EVENTS_TTL = 300_000;

export const misEventsTools: ToolDefinition[] = [
  {
    name: "mis_events_list",
    description:
      "Get promotional events with dates, type, and registration counts.",
    inputSchema: z.object({
      includeArchived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include archived/past events"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { includeArchived, limit } = params as {
        includeArchived: boolean;
        limit: number;
      };
      return withCache(
        "mis_events_list",
        { includeArchived, limit },
        MIS_EVENTS_TTL,
        () => getEventsList(includeArchived, limit)
      );
    },
  },
  {
    name: "mis_event_registrations",
    description:
      "Get registrations for a specific event with contact details and linked customer accounts.",
    inputSchema: z.object({
      eventId: z.number().describe("Event ID"),
      includeTargets: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include target/invited registrations"),
    }),
    handler: async (params) => {
      const { eventId, includeTargets } = params as {
        eventId: number;
        includeTargets: boolean;
      };
      return withCache(
        "mis_event_registrations",
        { eventId, includeTargets },
        MIS_EVENTS_TTL,
        () => getEventRegistrations(eventId, includeTargets)
      );
    },
  },
  {
    name: "mis_customer_events",
    description:
      "Get event participation history for a customer across all events.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "mis_customer_events",
        { accountNumber },
        MIS_EVENTS_TTL,
        () => getCustomerEvents(accountNumber)
      );
    },
  },
  {
    name: "mis_event_rewards",
    description:
      "Get reward calculations and payment status for an event. Filter by status (pending, paid, all).",
    inputSchema: z.object({
      eventId: z.number().describe("Event ID"),
      status: z
        .string()
        .optional()
        .default("all")
        .describe("Filter by reward status: pending, paid, or all"),
    }),
    handler: async (params) => {
      const { eventId, status } = params as {
        eventId: number;
        status: string;
      };
      return withCache(
        "mis_event_rewards",
        { eventId, status },
        MIS_EVENTS_TTL,
        () => getEventRewards(eventId, status)
      );
    },
  },
  {
    name: "mis_event_redemptions",
    description:
      "Get reward redemption records for accounting and audit. Filter by event, contact, or date range.",
    inputSchema: z.object({
      eventId: z.number().optional().describe("Filter by event ID"),
      contactId: z.number().optional().describe("Filter by contact ID"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { eventId, contactId, startDate, endDate } = params as {
        eventId?: number;
        contactId?: number;
        startDate?: string;
        endDate?: string;
      };
      return withCache(
        "mis_event_redemptions",
        { eventId, contactId, startDate, endDate },
        MIS_EVENTS_TTL,
        () => getEventRedemptions(eventId, contactId, startDate, endDate)
      );
    },
  },
];
