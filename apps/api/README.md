# Alibhai Points API Documentation

## Overview

The Alibhai Points API is a RESTful API for managing customer loyalty points. It provides endpoints for:
- Customer registration and authentication
- Purchase recording and point calculation
- Point redemption requests
- Admin dashboard and management
- Reporting and audit logging

**Base URL**: `http://localhost:5000/api` (development)

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-supabase-access-token>
```

Tokens are obtained via Supabase Auth (OTP login) on the mobile app.

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

## Endpoints

### System

#### Health Check
```
GET /api/health
```

Check if the API is running.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-10-01T12:00:00Z",
    "service": "Alibhai Points API",
    "version": "2.0.0"
  }
}
```

---

### Authentication

#### Get Current User Profile
```
GET /api/me
```

Returns the authenticated user's profile and role.

**Response:**
```json
{
  "success": true,
  "data": {
    "registered": true,
    "role": "customer",
    "profile": {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+255712000001",
      "role": "customer",
      "is_active": true,
      "created_at": "2024-10-01T10:00:00Z"
    },
    "customer": {
      "id": "uuid",
      "customer_code": "JD01",
      "initials": "JD",
      "sequence_number": 1,
      "status": "active",
      "points_balance": 1000,
      "last_transaction_at": "2024-10-01T11:00:00Z"
    }
  }
}
```

#### Complete Registration
```
POST /api/auth/complete-registration
```

Completes registration after OTP verification.

**Request Body:**
```json
{
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": true,
    "customer_id": "uuid",
    "customer_code": "JD01"
  }
}
```

---

### Customer Endpoints

#### Create Redemption Request
```
POST /api/customer/redemptions
```

Customer requests to redeem points.

**Request Body:**
```json
{
  "points": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redemption_id": "uuid",
    "reference": "RDM-241001-ABC123",
    "status": "pending",
    "points": 50
  }
}
```

#### Get Customer Purchases
```
GET /api/customer/purchases?page=1&limit=20
```

Returns paginated list of customer's purchases.

**Response:**
```json
{
  "success": true,
  "data": {
    "purchases": [
      {
        "id": "uuid",
        "transaction_reference": "TXN-241001-XYZ789",
        "purchase_amount": 50000,
        "points_earned": 50,
        "amount_per_point_used": 1000,
        "status": "completed",
        "purchased_at": "2024-10-01T12:00:00Z",
        "created_at": "2024-10-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Get Points Summary
```
GET /api/customer/points/summary
```

Returns customer's points breakdown.

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_code": "JD01",
    "status": "active",
    "total_points": 1000,
    "redeemable_points": 50,
    "waiting_points": 950,
    "requested_points": 0,
    "redeemed_points": 0,
    "expired_points": 0,
    "next_unlock_at": "2024-12-30T00:00:00Z",
    "activity_deadline": "2024-10-26T00:00:00Z",
    "days_left": 25
  }
}
```

---

### Admin Endpoints

#### Dashboard Metrics
```
GET /api/admin/dashboard
```

Returns comprehensive statistics for admin dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": {
      "total": 150,
      "active": 145,
      "inactive": 5,
      "near_deadline": 10
    },
    "points": {
      "total_issued": 75000,
      "redeemable": 12000,
      "waiting": 63000,
      "redeemed": 0,
      "expired": 0
    },
    "purchases": {
      "total_value": 75000000,
      "today": {
        "count": 10,
        "value": 500000
      },
      "this_month": {
        "count": 300,
        "value": 15000000
      }
    },
    "redemptions": {
      "pending_count": 5
    }
  }
}
```

#### Preview Purchase
```
POST /api/admin/purchases/preview
```

Preview points calculation without recording purchase.

**Request Body:**
```json
{
  "customer_code": "JD01",
  "purchase_amount": 50000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_name": "John Doe",
    "customer_status": "active",
    "points_earned": 50,
    "amount_per_point": 1000
  }
}
```

#### Record Purchase
```
POST /api/admin/purchases
```

Record a purchase for a customer and award points.

**Request Body:**
```json
{
  "customer_code": "JD01",
  "purchase_amount": 50000,
  "idempotency_key": "uuid-v4-string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "TXN-241001-ABC123",
    "points_earned": 50,
    "new_balance": 1050,
    "customer_status": "active",
    "duplicate": false,
    "purchase_id": "uuid"
  }
}
```

**Idempotency:** If the same `idempotency_key` is sent twice, the existing purchase is returned instead of creating a duplicate.

#### List Purchases
```
GET /api/admin/purchases?customer=JD01&start_date=2024-10-01&end_date=2024-10-31&page=1&limit=20
```

List all purchases with optional filters.

**Response:**
```json
{
  "success": true,
  "data": {
    "purchases": [
      {
        "id": "uuid",
        "transaction_reference": "TXN-241001-ABC123",
        "purchase_amount": 50000,
        "points_earned": 50,
        "amount_per_point_used": 1000,
        "status": "completed",
        "purchased_at": "2024-10-01T12:00:00Z",
        "created_at": "2024-10-01T12:00:00Z",
        "customers": {
          "customer_code": "JD01",
          "initials": "JD"
        },
        "profiles": {
          "full_name": "John Doe"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Void Purchase
```
POST /api/admin/purchases/{id}/void
```

Void a mistaken purchase (only if points are unused).

**Request Body:**
```json
{
  "reason": "Incorrect amount entered"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Purchase voided successfully",
    "status": "voided"
  }
}
```

**Error Response (if points already used):**
```json
{
  "success": false,
  "error": {
    "code": "POINTS_ALREADY_USED",
    "message": "Cannot void purchase: points have already been redeemed"
  }
}
```

#### List Customers
```
GET /api/admin/customers?search=John&status=active&near_deadline=true&page=1&limit=20
```

List customers with search, status filter, and pagination.

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "uuid",
        "customer_code": "JD01",
        "initials": "JD",
        "sequence_number": 1,
        "status": "active",
        "points_balance": 1000,
        "last_transaction_at": "2024-10-01T12:00:00Z",
        "created_at": "2024-10-01T10:00:00Z",
        "updated_at": "2024-10-01T12:00:00Z",
        "profiles": {
          "id": "uuid",
          "full_name": "John Doe",
          "phone": "+255712000001",
          "is_active": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Get Customer Details
```
GET /api/admin/customers/{customerCode}
```

Get details for a specific customer.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customer_code": "JD01",
    "initials": "JD",
    "sequence_number": 1,
    "status": "active",
    "points_balance": 1000,
    "last_transaction_at": "2024-10-01T12:00:00Z",
    "created_at": "2024-10-01T10:00:00Z",
    "updated_at": "2024-10-01T12:00:00Z",
    "profiles": {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+255712000001",
      "is_active": true
    }
  }
}
```

#### Update Customer Status
```
PATCH /api/admin/customers/{customerCode}
```

Enable or disable a customer account.

**Request Body:**
```json
{
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Customer status updated successfully",
    "customer_code": "JD01",
    "is_active": false
  }
}
```

**Note:** Disabled users cannot log in to the API.

#### Get Customer Purchases
```
GET /api/admin/customers/{customerCode}/purchases?page=1&limit=20
```

Get purchase history for a specific customer.

**Response:** Same as `/api/admin/purchases`

#### Direct Redemption (Admin)
```
POST /api/admin/customers/{customerCode}/redeem
```

Admin directly redeems points for a customer.

**Request Body:**
```json
{
  "points": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redemption_id": "uuid",
    "reference": "RDM-241001-XYZ789",
    "status": "completed",
    "points": 50
  }
}
```

#### Reset Customer PIN
```
POST /api/admin/customers/{customerCode}/reset-pin
```

Reset a customer's 6-digit PIN (Supabase Auth password).

**Request Body:**
```json
{
  "new_pin": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "PIN reset successfully",
    "customer_code": "JD01"
  }
}
```

**Note:** This action is audit-logged. The PIN is never stored in logs.

#### List Redemptions
```
GET /api/admin/redemptions?status=pending&page=1&limit=20
```

List redemptions with status filter and pagination.

**Response:**
```json
{
  "success": true,
  "data": {
    "redemptions": [
      {
        "id": "uuid",
        "customer_id": "uuid",
        "points_redeemed": 50,
        "redemption_reference": "RDM-241001-ABC123",
        "source": "customer_request",
        "status": "pending",
        "processed_by": null,
        "completed_at": null,
        "cancelled_by": null,
        "cancelled_at": null,
        "cancel_reason": null,
        "redeemed_at": "2024-10-01T12:00:00Z",
        "created_at": "2024-10-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Get Redemption Details
```
GET /api/admin/redemptions/{id}
```

Get details for a specific redemption.

**Response:** Same as `/api/admin/redemptions` (single item)

#### Complete Redemption
```
POST /api/admin/redemptions/{id}/complete
```

Admin approves a customer's redemption request.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "reference": "RDM-241001-ABC123"
  }
}
```

#### Cancel Redemption
```
POST /api/admin/redemptions/{id}/cancel
```

Cancel a redemption (pending or completed) and return points.

**Request Body:**
```json
{
  "reason": "Customer changed mind"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "cancelled"
  }
}
```

#### Summary Report
```
GET /api/admin/reports/summary?from=2024-10-01&to=2024-10-31
```

Returns summary statistics for a date range with per-day breakdown.

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2024-10-01",
      "to": "2024-10-31"
    },
    "summary": {
      "purchases": {
        "count": 300,
        "value": 15000000
      },
      "points": {
        "issued": 15000,
        "redeemed": 0,
        "expired": 0
      }
    },
    "daily_series": [
      {
        "date": "2024-10-01",
        "purchases": 10,
        "value": 500000,
        "points_issued": 500
      }
    ]
  }
}
```

#### Get Current Point Rules
```
GET /api/admin/rules
```

Returns the currently active point configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Default Rule",
    "amount_per_point": 1000,
    "redemption_wait_days": 90,
    "inactivity_days": 25,
    "is_active": true,
    "created_at": "2024-10-01T10:00:00Z",
    "updated_at": "2024-10-01T10:00:00Z"
  }
}
```

#### Update Point Rules
```
PUT /api/admin/rules
```

Update point rules for FUTURE purchases only. Old purchases keep their original values.

**Request Body:**
```json
{
  "amount_per_point": 1000,
  "redemption_wait_days": 90,
  "inactivity_days": 25
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Point rules updated successfully",
    "rule": {
      "id": "uuid",
      "amount_per_point": 1000,
      "redemption_wait_days": 90,
      "inactivity_days": 25,
      "is_active": true
    }
  }
}
```

#### Get Audit Logs
```
GET /api/admin/audit-logs?admin=admin-id&action=UPDATE_CUSTOMER_STATUS&from=2024-10-01&to=2024-10-31&page=1&page_size=20
```

Retrieve audit logs with filters and pagination.

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "admin_id": "uuid",
        "action": "UPDATE_CUSTOMER_STATUS",
        "entity_type": "customer",
        "entity_id": "uuid",
        "description": "Disabled customer account JD01",
        "metadata": {
          "customer_code": "JD01",
          "previous_status": "active",
          "new_status": "inactive"
        },
        "created_at": "2024-10-01T12:00:00Z",
        "profiles": {
          "full_name": "Admin User",
          "phone": "+255712000001"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

## Business Rules

### Point Calculation
- **Rule**: TZS 1,000 = 1 point
- **Example**: TZS 50,000 purchase = 50 points

### Point Maturity
- **Rule**: Points become redeemable after 90 days
- **Example**: Points earned on 2024-10-01 become redeemable on 2024-12-30

### Customer Inactivity
- **Rule**: Customer becomes inactive after 25 days without a purchase
- **Consequence**: All pending points are expired
- **Reactivation**: A new purchase reactivates the customer

### FIFO Redemption
- **Rule**: Points are redeemed from the oldest eligible lots first
- **Prevents**: Cherry-picking the most valuable points

### Idempotency
- **Rule**: Duplicate purchase requests with the same idempotency key return the existing purchase
- **Prevents**: Double-spending due to network retries

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| INVALID_TOKEN | 401 | Token expired or malformed |
| ACCOUNT_DISABLED | 403 | User account has been deactivated |
| NOT_ADMIN | 403 | User is not an administrator |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_NAME | 400 | Invalid customer name format |
| CUSTOMER_NOT_FOUND | 404 | Customer does not exist |
| INSUFFICIENT_REDEEMABLE_POINTS | 400 | Not enough redeemable points |
| POINTS_ALREADY_USED | 400 | Cannot void purchase - points already redeemed |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| TOO_MANY_ATTEMPTS | 429 | Too many authentication attempts |
| INTERNAL_SERVER_ERROR | 500 | Unexpected server error |

---

## Rate Limiting

- **Standard API**: 100 requests per 15 minutes per IP
- **Authentication**: 10 attempts per 15 minutes per IP
- **Admin Write Operations**: 20 requests per 15 minutes per IP

Rate limit responses:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later."
  }
}
```

---

## Pagination

All list endpoints support pagination:

- `page` (default: 1)
- `limit` or `page_size` (default: 20, max: 100)

Pagination response includes:
- `page`: Current page number
- `page_size`: Items per page
- `total`: Total number of items
- `total_pages`: Total number of pages
- `has_next`: Whether there is a next page
- `has_prev`: Whether there is a previous page
