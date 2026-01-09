/**
 * DynamoDB Client Configuration
 *
 * Initializes the DynamoDB client with support for LocalStack endpoint override.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let dynamoDBClient: DynamoDBClient | null = null;
let documentClient: DynamoDBDocumentClient | null = null;

/**
 * Configuration for DynamoDB client
 */
export interface DynamoDBConfig {
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Get or create the DynamoDB client singleton
 */
export function getDynamoDBClient(config?: DynamoDBConfig): DynamoDBClient {
  if (dynamoDBClient) {
    return dynamoDBClient;
  }

  const clientConfig: DynamoDBConfig = {
    region: config?.region ?? process.env.AWS_REGION ?? 'us-east-1',
  };

  // Support LocalStack endpoint override
  const endpoint = config?.endpoint ?? process.env.AWS_ENDPOINT_URL;
  if (endpoint !== undefined && endpoint !== '') {
    clientConfig.endpoint = endpoint;
  }

  // Use provided credentials or environment defaults
  const accessKeyId = config?.credentials?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? 'test';
  const secretAccessKey =
    config?.credentials?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? 'test';

  clientConfig.credentials = { accessKeyId, secretAccessKey };

  dynamoDBClient = new DynamoDBClient(clientConfig);
  return dynamoDBClient;
}

/**
 * Get or create the DynamoDB DocumentClient singleton
 *
 * The DocumentClient provides a simpler API for working with items,
 * automatically marshalling and unmarshalling JavaScript types to DynamoDB types.
 */
export function getDocumentClient(config?: DynamoDBConfig): DynamoDBDocumentClient {
  if (documentClient) {
    return documentClient;
  }

  const client = getDynamoDBClient(config);

  documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      // Remove undefined values from items
      removeUndefinedValues: true,
      // Convert empty strings to null (DynamoDB doesn't support empty strings)
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      // Don't wrap numbers in NumberValue objects
      wrapNumbers: false,
    },
  });

  return documentClient;
}

/**
 * Reset the DynamoDB clients (useful for testing)
 */
export function resetDynamoDBClients(): void {
  if (dynamoDBClient) {
    dynamoDBClient.destroy();
    dynamoDBClient = null;
  }
  documentClient = null;
}

/**
 * Check if running against LocalStack
 */
export function isLocalStack(): boolean {
  const endpoint = process.env.AWS_ENDPOINT_URL ?? '';
  return endpoint.includes('localhost') || endpoint.includes('localstack');
}
