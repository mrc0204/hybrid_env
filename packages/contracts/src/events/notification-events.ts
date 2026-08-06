import type { BaseEvent } from "./base";

/**
 * Notification events are the final, personalized delivery of AI events to a
 * specific user, plus the read/dismiss feedback that flows back for learning.
 */

export interface NotificationCreatedEvent extends BaseEvent<"notification.created"> {
  payload: {
    notificationId: string;
    userId: string;
    title: string;
    message: string;
    severity: "info" | "warning" | "critical";
    relatedRecommendationId?: string;
  };
}

export interface NotificationReadEvent extends BaseEvent<"notification.read"> {
  payload: {
    notificationId: string;
    userId: string;
  };
}

export interface NotificationDismissedEvent extends BaseEvent<"notification.dismissed"> {
  payload: {
    notificationId: string;
    userId: string;
  };
}

export type NotificationEvent =
  NotificationCreatedEvent | NotificationReadEvent | NotificationDismissedEvent;

export type NotificationEventType = NotificationEvent["type"];
