/**
 * Users DTOs
 *
 * User registration and response shapes.
 */

/**
 * Create user request body
 */
export interface CreateUserRequest {
  email?: string;
}

/**
 * Create user response
 */
export interface CreateUserResponse {
  created: boolean;
  user: {
    ecosystemId: string;
    firebaseUid: string;
    email: string;
    role: 'user' | 'admin';
    status: 'active' | 'disabled';
    currentScore: number;
    tier: 'high' | 'medium' | 'low';
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string;
  };
}
