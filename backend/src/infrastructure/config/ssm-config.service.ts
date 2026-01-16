/**
 * SSM Config Service
 *
 * Loads configuration values from AWS SSM Parameter Store.
 * Intended for AWS mode (LocalStack or real AWS) and designed to
 * fall back to defaults when parameters are missing.
 */

import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import type {
  RemoteConfig,
  TierLimitsConfig,
  ApprovalConfig,
  WhatsAppFeatureConfig,
  ScoringConfig,
} from './remote-config.types.js';
import { DEFAULT_CONFIG } from './remote-config.defaults.js';

export interface SSMConfigServiceOptions {
  region?: string | undefined;
  endpoint?: string | undefined; // LocalStack endpoint override
  basePath?: string | undefined; // default: /acme/financial-api
}

export type RemoteConfigPatch = {
  limits?: Partial<TierLimitsConfig> | undefined;
  approval?: Partial<ApprovalConfig> | undefined;
  whatsapp?: Partial<WhatsAppFeatureConfig> | undefined;
  scoring?: Partial<ScoringConfig> | undefined;
};

type AwsClientConfig = {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

function buildAwsClientConfig(options: SSMConfigServiceOptions): AwsClientConfig {
  const region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = options.endpoint ?? process.env.AWS_ENDPOINT_URL;

  const config: AwsClientConfig = { region };

  if (endpoint !== undefined && endpoint !== '') {
    config.endpoint = endpoint;
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
    };
  }

  return config;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export class SSMConfigService {
  private readonly client: SSMClient;
  private readonly basePath: string;

  constructor(options: SSMConfigServiceOptions = {}) {
    this.basePath = options.basePath ?? '/acme/financial-api';
    this.client = new SSMClient(buildAwsClientConfig(options));
  }

  async loadConfigWithDefaults(defaults: RemoteConfig = DEFAULT_CONFIG): Promise<RemoteConfig> {
    const partial = await this.loadPartialConfig();

    return {
      limits: { ...defaults.limits, ...(partial.limits ?? {}) },
      approval: { ...defaults.approval, ...(partial.approval ?? {}) },
      whatsapp: { ...defaults.whatsapp, ...(partial.whatsapp ?? {}) },
      scoring: { ...defaults.scoring, ...(partial.scoring ?? {}) },
    };
  }

  async loadPartialConfig(): Promise<RemoteConfigPatch> {
    const names = [
      // Limits
      `${this.basePath}/limits/lowTier`,
      `${this.basePath}/limits/mediumTier`,
      `${this.basePath}/limits/highTier`,
      // Approval
      `${this.basePath}/approval/autoApproveThreshold`,
      // WhatsApp
      `${this.basePath}/whatsapp/notificationsEnabled`,
      `${this.basePath}/whatsapp/approvalExpiryHours`,
      // Scoring
      `${this.basePath}/scoring/paymentBonusMax`,
      `${this.basePath}/scoring/paymentBonusMin`,
      `${this.basePath}/scoring/latePenaltyMild`,
      `${this.basePath}/scoring/latePenaltyModerate`,
      `${this.basePath}/scoring/latePenaltySevere`,
    ];

    const result = await this.client.send(
      new GetParametersCommand({
        Names: names,
        WithDecryption: true,
      })
    );

    const parametersByName = new Map<string, string>();
    for (const parameter of result.Parameters ?? []) {
      if (parameter.Name !== undefined && parameter.Value !== undefined) {
        parametersByName.set(parameter.Name, parameter.Value);
      }
    }

    const lowTier = parseNumber(parametersByName.get(`${this.basePath}/limits/lowTier`));
    const mediumTier = parseNumber(parametersByName.get(`${this.basePath}/limits/mediumTier`));
    const highTier = parseNumber(parametersByName.get(`${this.basePath}/limits/highTier`));

    const autoApproveThreshold = parseNumber(
      parametersByName.get(`${this.basePath}/approval/autoApproveThreshold`)
    );

    const notificationsEnabled = parseBoolean(
      parametersByName.get(`${this.basePath}/whatsapp/notificationsEnabled`)
    );
    const approvalExpiryHours = parseNumber(
      parametersByName.get(`${this.basePath}/whatsapp/approvalExpiryHours`)
    );

    const paymentBonusMax = parseNumber(
      parametersByName.get(`${this.basePath}/scoring/paymentBonusMax`)
    );
    const paymentBonusMin = parseNumber(
      parametersByName.get(`${this.basePath}/scoring/paymentBonusMin`)
    );
    const latePenaltyMild = parseNumber(
      parametersByName.get(`${this.basePath}/scoring/latePenaltyMild`)
    );
    const latePenaltyModerate = parseNumber(
      parametersByName.get(`${this.basePath}/scoring/latePenaltyModerate`)
    );
    const latePenaltySevere = parseNumber(
      parametersByName.get(`${this.basePath}/scoring/latePenaltySevere`)
    );

    const partial: RemoteConfigPatch = {};

    if (lowTier !== undefined || mediumTier !== undefined || highTier !== undefined) {
      partial.limits = {
        ...(lowTier !== undefined ? { lowTier } : {}),
        ...(mediumTier !== undefined ? { mediumTier } : {}),
        ...(highTier !== undefined ? { highTier } : {}),
      };
    }

    if (autoApproveThreshold !== undefined) {
      partial.approval = { autoApproveThreshold };
    }

    if (notificationsEnabled !== undefined || approvalExpiryHours !== undefined) {
      partial.whatsapp = {
        ...(notificationsEnabled !== undefined ? { notificationsEnabled } : {}),
        ...(approvalExpiryHours !== undefined ? { approvalExpiryHours } : {}),
      };
    }

    if (
      paymentBonusMax !== undefined ||
      paymentBonusMin !== undefined ||
      latePenaltyMild !== undefined ||
      latePenaltyModerate !== undefined ||
      latePenaltySevere !== undefined
    ) {
      partial.scoring = {
        ...(paymentBonusMax !== undefined ? { paymentBonusMax } : {}),
        ...(paymentBonusMin !== undefined ? { paymentBonusMin } : {}),
        ...(latePenaltyMild !== undefined ? { latePenaltyMild } : {}),
        ...(latePenaltyModerate !== undefined ? { latePenaltyModerate } : {}),
        ...(latePenaltySevere !== undefined ? { latePenaltySevere } : {}),
      };
    }

    return partial;
  }
}
