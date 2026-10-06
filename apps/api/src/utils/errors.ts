export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const DB_ERROR_MAP: Record<string, { status: number; message: string }> = {
  // Input / validation / business errors
  INVALID_NAME: {
    status: 400,
    message: "Full name must be at least 2 characters long.",
  },
  INVALID_PHONE: {
    status: 400,
    message: "Invalid phone number format. Please provide a valid Tanzanian phone number.",
  },
  INVALID_AMOUNT: {
    status: 400,
    message: "Purchase amount must be greater than zero.",
  },
  INVALID_POINTS: {
    status: 400,
    message: "Points must be greater than zero.",
  },
  REASON_REQUIRED: {
    status: 400,
    message: "A reason is required to void this transaction.",
  },
  CUSTOMER_INACTIVE: {
    status: 400,
    message: "Customer is inactive due to past deadline.",
  },
  INSUFFICIENT_REDEEMABLE_POINTS: {
    status: 400,
    message: "Insufficient redeemable points available.",
  },
  PENDING_REQUEST_EXISTS: {
    status: 400,
    message: "A pending redemption request already exists for this customer.",
  },
  REDEMPTION_ALREADY_CANCELLED: {
    status: 400,
    message: "This redemption has already been cancelled.",
  },
  REDEMPTION_NOT_PENDING: {
    status: 400,
    message: "This redemption request is not pending.",
  },
  POINTS_ALREADY_USED_OR_EXPIRED: {
    status: 400,
    message: "Cannot void: points from this purchase have already been used or expired.",
  },
  ALREADY_VOIDED: {
    status: 400,
    message: "This purchase has already been voided.",
  },

  // Auth / Permissions
  NOT_ADMIN: {
    status: 403,
    message: "Access denied. Administrator privileges required.",
  },
  CUSTOMER_DISABLED: {
    status: 403,
    message: "Customer profile is deactivated.",
  },
  ACCOUNT_DISABLED: {
    status: 403,
    message: "Your account has been deactivated. Please contact support.",
  },
  FORBIDDEN: {
    status: 403,
    message: "You do not have permission to access this resource.",
  },
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication token missing or invalid.",
  },
  INVALID_TOKEN: {
    status: 401,
    message: "Your session token is invalid or has expired.",
  },
  REGISTRATION_REQUIRED: {
    status: 403,
    message: "Registration is incomplete. Please complete your registration.",
  },

  // Not Found
  CUSTOMER_NOT_FOUND: {
    status: 404,
    message: "Customer not found.",
  },
  REDEMPTION_NOT_FOUND: {
    status: 404,
    message: "Redemption record not found.",
  },
  PURCHASE_NOT_FOUND: {
    status: 404,
    message: "Purchase record not found.",
  },
  NO_ACTIVE_RULE: {
    status: 500,
    message: "System configuration error: No active points rule is set.",
  },
};

export function mapDbCodeToHttp(code: string): { status: number; message: string } {
  if (DB_ERROR_MAP[code]) {
    return DB_ERROR_MAP[code];
  }
  return {
    status: 400,
    message: code.replace(/_/g, " ").toLowerCase(),
  };
}
