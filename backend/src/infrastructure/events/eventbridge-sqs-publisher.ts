/**
 * EventBridge/SQS Event Publisher
 *
 * Publishes outbox events to AWS EventBridge (and optionally SQS), while still
 * supporting in-process subscriptions for local handlers (e.g., WhatsApp).
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { IEventPublisher, EventHandler } from './event-publisher.interface.js';
import { InMemoryEventPublisher } from './inmemory-event-publisher.js';
import type { OutboxEvent } from '../../domain/entities/event.entity.js';

export interface EventBridgeSQSPublisherConfig {
  region?: string | undefined;
  endpoint?: string | undefined; // LocalStack endpoint override

  publishToEventBridge?: boolean | undefined;
  eventBusName?: string | undefined;
  eventSource?: string | undefined;

  publishToSqs?: boolean | undefined;
  sqsQueueUrl?: string | undefined;

  /**
   * Strict mode: external publish failures throw.
   * Best-effort mode: external publish failures are logged and ignored.
   */
  strict?: boolean | undefined;
}

type AwsClientConfig = {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

type NormalizedConfig = {
  region?: string | undefined;
  endpoint?: string | undefined;
  publishToEventBridge: boolean;
  eventBusName: string;
  eventSource: string;
  publishToSqs: boolean;
  sqsQueueUrl?: string | undefined;
  strict: boolean;
};

function buildAwsClientConfig(config: NormalizedConfig): AwsClientConfig {
  const region = config.region ?? process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = config.endpoint ?? process.env.AWS_ENDPOINT_URL;

  const clientConfig: AwsClientConfig = { region };

  if (endpoint !== undefined && endpoint !== '') {
    clientConfig.endpoint = endpoint;
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
    };
  }

  return clientConfig;
}

export class EventBridgeSQSPublisher implements IEventPublisher {
  private readonly inProcess: InMemoryEventPublisher;
  private readonly eventBridgeClient: EventBridgeClient | null;
  private readonly sqsClient: SQSClient | null;
  private readonly config: NormalizedConfig;

  constructor(config: EventBridgeSQSPublisherConfig = {}) {
    this.inProcess = new InMemoryEventPublisher();

    this.config = {
      region: config.region,
      endpoint: config.endpoint,
      publishToEventBridge: config.publishToEventBridge ?? true,
      eventBusName:
        config.eventBusName ?? process.env.EVENTBRIDGE_BUS_NAME ?? 'tazco-financial-events',
      eventSource: config.eventSource ?? process.env.EVENT_SOURCE ?? 'tazco.financial-api',
      publishToSqs: config.publishToSqs ?? false,
      sqsQueueUrl: config.sqsQueueUrl ?? process.env.SQS_QUEUE_URL,
      strict: config.strict ?? process.env.EVENT_PUBLISH_STRICT === 'true',
    };

    const awsConfig = buildAwsClientConfig(this.config);

    this.eventBridgeClient = this.config.publishToEventBridge
      ? new EventBridgeClient(awsConfig)
      : null;
    this.sqsClient = this.config.publishToSqs ? new SQSClient(awsConfig) : null;
  }

  async publish(event: OutboxEvent): Promise<void> {
    if (this.config.strict) {
      await this.publishExternally(event);
      await this.inProcess.publish(event);
      return;
    }

    await this.inProcess.publish(event);

    try {
      await this.publishExternally(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`External publish failed for event ${event.eventId}: ${message}`);
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    this.inProcess.subscribe(eventType, handler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.inProcess.unsubscribe(eventType, handler);
  }

  private async publishExternally(event: OutboxEvent): Promise<void> {
    const payload = JSON.stringify(event);

    if (this.eventBridgeClient) {
      const command = new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.config.eventBusName,
            Source: this.config.eventSource,
            DetailType: event.eventType,
            Detail: payload,
            Time: event.createdAt,
          },
        ],
      });

      const result = await this.eventBridgeClient.send(command);
      const entry = result.Entries?.[0];
      if (entry?.ErrorCode !== undefined && entry.ErrorCode !== '') {
        throw new Error(
          `EventBridge publish failed: ${entry.ErrorCode}${
            entry.ErrorMessage !== undefined && entry.ErrorMessage !== ''
              ? ` (${entry.ErrorMessage})`
              : ''
          }`
        );
      }
    }

    if (this.sqsClient) {
      const queueUrl = this.config.sqsQueueUrl;
      if (queueUrl === undefined || queueUrl === '') {
        throw new Error('SQS_QUEUE_URL is required when publishToSqs is enabled');
      }

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: payload,
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: event.eventType },
          eventId: { DataType: 'String', StringValue: event.eventId },
          ecosystemId: { DataType: 'String', StringValue: event.ecosystemId },
        },
      });

      await this.sqsClient.send(command);
    }
  }
}
