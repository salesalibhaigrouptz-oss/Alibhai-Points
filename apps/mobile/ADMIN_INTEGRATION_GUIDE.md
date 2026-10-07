# Admin Screens Integration - Update Guide

## Completed Updates

### 1. ✅ Dashboard (`app/admin/dashboard.tsx`)
- Replaced manual state management with `useDashboardMetrics` hook
- Added pull-to-refresh
- Added error state with retry
- Removed manual `useEffect` and state
- Now uses TanStack Query for data fetching

### 2. ✅ Customers List (`app/admin/customers.tsx`)
- Replaced manual state with `useCustomers` hook
- Search and filter now passed as params to the hook
- Added pull-to-refresh
- Added error state with retry
- Removed manual `useEffect` and state
- Backend handles search/filter automatically

### 3. ✅ Record Purchase (`app/admin/record-purchase.tsx`)
- Added `usePointRules`, `usePreviewPurchase`, `useRecordPurchase` hooks
- Added idempotency key generation and reuse
- Uses hooks instead of direct API calls
- Better error handling with `apiErrorMessage`
- Points calculated by backend preview endpoint

## Remaining Admin Screens to Update

### 4. Customer Details (`app/admin/customer-details.tsx`)
**Changes needed:**
- Use `useCustomer(customerCode)` for customer data
- Use `useCustomerPurchases(customerCode)` for purchases
- Use `useUpdateCustomerStatus` for enable/disable
- Use `useDirectRedeem` for deduct points
- Use `useResetCustomerPin` for PIN reset
- Add confirmation dialogs for all actions

### 5. Purchases (`app/admin/purchases.tsx`)
**Changes needed:**
- Use `usePurchases` with filters
- Use `useVoidPurchase` for voiding
- Add confirmation dialog before void
- Show reason input field

### 6. Redemptions (`app/admin/redemptions.tsx`)
**Changes needed:**
- Use `useRedemptions` with status filter
- Use `useCompleteRedemption` for completing
- Use `useCancelRedemption` for cancelling
- Add confirmation dialogs for both actions
- Show reason input for cancellation

### 7. Point Rules (`app/admin/point-rules.tsx`)
**Changes needed:**
- Use `usePointRules` for current rules
- Use `useUpdatePointRules` for updating
- Add confirmation dialog before update
- Show note that changes apply to future purchases only

### 8. Audit Logs (`app/admin/audit-logs.tsx`)
**Changes needed:**
- Use `useAuditLogs` with filters
- Add date range picker
- Add action filter
- Add admin filter

## Import Statement Pattern

Replace:
```typescript
import { getCustomers } from '@/services/api';
```

With:
```typescript
import { useCustomers } from '@/services/hooks';
```

## Hook Usage Pattern

Replace manual state/async calls:
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getCustomers();
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

With TanStack Query hook:
```typescript
const { data, isLoading, error, refetch } = useCustomers(params);
```

## Confirmation Dialog Pattern

For actions that change points:
```typescript
const handleAction = () => {
  Alert.alert(
    'Confirm Action',
    'Are you sure you want to do this?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await mutation.mutateAsync(params);
        },
      },
    ]
  );
};
```

## Error Handling Pattern

Use `apiErrorMessage` for user-friendly errors:
```typescript
try {
  await mutation.mutateAsync(params);
} catch (error) {
  Alert.alert('Error', apiErrorMessage(error));
}
```

## Pull-to-Refresh Pattern

Add to ScrollView or FlatList:
```typescript
<ScrollView refreshControl={
  <RefreshControl refreshing={isLoading} onRefresh={refetch} />
}>
```

## Idempotency Key Pattern (Record Purchase)

Generate and reuse key:
```typescript
const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

const generateKey = () => `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// On submit
const key = idempotencyKey || generateKey();
setIdempotencyKey(key);
await recordMutation.mutateAsync({ ..., idempotencyKey: key });
```

## Testing Checklist

After updating each screen:
- [ ] Screen loads data from backend
- [ ] Pull-to-refresh works
- [ ] Error state shows retry button
- [ ] Actions trigger confirmation dialogs
- [ ] Mutations invalidate related queries
- [ ] Loading states show during mutations
- [ ] Empty states show when no data
