/**
 * Brazilian Phone Number Utilities
 *
 * Handles E.164 phone number normalization for Brazilian numbers.
 * Brazilian mobile numbers are 13 digits: 55 + DDD (2) + 9 + subscriber (8)
 */

/**
 * Error thrown when phone number is invalid
 */
export class InvalidPhoneError extends Error {
  constructor(
    public readonly phone: string,
    message: string
  ) {
    super(message);
    this.name = 'InvalidPhoneError';
  }
}

/**
 * Extract only digits from a string
 */
function extractDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Normalize a Brazilian phone number to E.164 format (13 digits)
 *
 * Handles various input formats:
 * - "73 98111-2636" -> "5573981112636"
 * - "+55 73 981112636" -> "5573981112636"
 * - "5573981112636" -> "5573981112636"
 * - "73 81112636" (8-digit subscriber) -> "5573981112636"
 *
 * @param raw - Raw phone number input
 * @returns Normalized E.164 phone number (13 digits for Brazil)
 * @throws InvalidPhoneError if the input cannot be normalized
 */
export function normalizeBrazilianPhone(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new InvalidPhoneError(raw, 'Phone number is required');
  }

  const digits = extractDigits(raw);

  if (digits.length < 8) {
    throw new InvalidPhoneError(raw, 'Phone number too short');
  }

  // Case 1: Already 13 digits with 55 prefix
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits;
  }

  // Case 2: 12 digits with 55 prefix (missing 9)
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const subscriber = digits.slice(4);
    // Add '9' prefix if subscriber is 8 digits
    if (subscriber.length === 8) {
      return `55${ddd}9${subscriber}`;
    }
    throw new InvalidPhoneError(raw, 'Invalid phone number format');
  }

  // Case 3: 11 digits (DDD + 9 + subscriber, no country code)
  if (digits.length === 11) {
    return `55${digits}`;
  }

  // Case 4: 10 digits (DDD + subscriber, no country code, no 9)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const subscriber = digits.slice(2);
    return `55${ddd}9${subscriber}`;
  }

  // Case 5: 9 digits (9 + subscriber, DDD is missing - invalid)
  if (digits.length === 9) {
    throw new InvalidPhoneError(raw, 'Phone number missing DDD (area code)');
  }

  // Case 6: 8 digits (subscriber only - invalid, need DDD)
  if (digits.length === 8) {
    throw new InvalidPhoneError(raw, 'Phone number missing DDD (area code)');
  }

  throw new InvalidPhoneError(raw, `Invalid phone number format: ${digits.length} digits`);
}

/**
 * Extract phone number from WPP-Connect ID format
 *
 * @param wppId - WPP-Connect format like "5573981112636@c.us" or "5573981112636@g.us"
 * @returns Phone number digits only
 */
export function extractPhoneFromWppId(wppId: string): string {
  if (!wppId || typeof wppId !== 'string') {
    throw new InvalidPhoneError(wppId, 'WPP ID is required');
  }

  const parts = wppId.split('@');
  if (parts.length !== 2 || parts[0] === undefined) {
    throw new InvalidPhoneError(wppId, 'Invalid WPP ID format');
  }

  const digits = extractDigits(parts[0]);
  if (digits.length < 10) {
    throw new InvalidPhoneError(wppId, 'Invalid phone number in WPP ID');
  }

  return digits;
}

/**
 * Validate if a phone number is in valid Brazilian E.164 format
 *
 * @param phone - Phone number to validate
 * @returns true if valid Brazilian E.164 format
 */
export function isValidBrazilianPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  const digits = extractDigits(phone);

  // Brazilian mobile: 55 + DDD (2) + 9 + subscriber (8) = 13 digits
  if (digits.length !== 13) {
    return false;
  }

  // Must start with 55 (Brazil country code)
  if (!digits.startsWith('55')) {
    return false;
  }

  // DDD must be valid (11-99)
  const ddd = parseInt(digits.slice(2, 4), 10);
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Mobile numbers should start with 9 after DDD
  if (digits[4] !== '9') {
    return false;
  }

  return true;
}

/**
 * Check if a phone number is in the admin whitelist
 *
 * @param phone - Phone number to check (any format)
 * @param whitelist - Array of whitelisted phone numbers (should be normalized)
 * @returns true if phone is whitelisted
 */
export function isWhitelistedAdmin(phone: string, whitelist: string[]): boolean {
  if (phone === '' || whitelist.length === 0) {
    return false;
  }

  try {
    // Try to normalize the input phone
    const normalized = normalizeBrazilianPhone(phone);
    return whitelist.some((w) => {
      try {
        const normalizedWhitelist = normalizeBrazilianPhone(w);
        return normalized === normalizedWhitelist;
      } catch {
        // If whitelist entry is invalid, try direct comparison
        return normalized === extractDigits(w);
      }
    });
  } catch {
    // If normalization fails, try direct digit comparison
    const digits = extractDigits(phone);
    return whitelist.some((w) => extractDigits(w) === digits);
  }
}

/**
 * Format phone number for display (masked)
 *
 * @param phone - Phone number in E.164 format
 * @returns Masked phone number like "+55 ** ****-2636"
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = extractDigits(phone);

  if (digits.length >= 4) {
    const lastFour = digits.slice(-4);
    return `****-${lastFour}`;
  }

  return '****';
}
