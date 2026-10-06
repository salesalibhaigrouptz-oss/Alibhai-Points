// Mock data for admin dashboard

export interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
  redeemablePoints: number;
  pendingPoints: number;
  status: 'active' | 'inactive';
  lastTransaction: string;
  activityDeadline: string;
}

export interface Purchase {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  points: number;
  date: string;
  recordedBy: string;
}

export interface Redemption {
  id: string;
  customerId: string;
  customerName: string;
  points: number;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  processedBy: string | null;
}

export interface AuditLog {
  id: string;
  admin: string;
  action: string;
  customer: string;
  description: string;
  date: string;
}

export interface PointRules {
  tzsPerPoint: number;
  redemptionWaitDays: number;
  activityPeriodDays: number;
}

export const mockCustomers: Customer[] = [
  {
    id: 'IS01',
    name: 'Ibrahim Alibhai',
    phone: '+255 754 123 456',
    points: 850,
    redeemablePoints: 500,
    pendingPoints: 350,
    status: 'active',
    lastTransaction: '2026-10-05',
    activityDeadline: '2026-10-17',
  },
  {
    id: 'IS02',
    name: 'Fatma Mohamed',
    phone: '+255 754 234 567',
    points: 320,
    redeemablePoints: 320,
    pendingPoints: 0,
    status: 'active',
    lastTransaction: '2026-10-03',
    activityDeadline: '2026-10-28',
  },
  {
    id: 'IS03',
    name: 'Ali Hassan',
    phone: '+255 754 345 678',
    points: 1200,
    redeemablePoints: 800,
    pendingPoints: 400,
    status: 'active',
    lastTransaction: '2026-10-04',
    activityDeadline: '2026-10-29',
  },
  {
    id: 'IS04',
    name: 'Zainab Khamis',
    phone: '+255 754 456 789',
    points: 150,
    redeemablePoints: 0,
    pendingPoints: 150,
    status: 'inactive',
    lastTransaction: '2026-09-15',
    activityDeadline: '2026-09-30',
  },
  {
    id: 'IS05',
    name: 'Yusuf Said',
    phone: '+255 754 567 890',
    points: 560,
    redeemablePoints: 560,
    pendingPoints: 0,
    status: 'active',
    lastTransaction: '2026-10-02',
    activityDeadline: '2026-10-27',
  },
];

export const mockPurchases: Purchase[] = [
  {
    id: 'P001',
    customerId: 'IS01',
    customerName: 'Ibrahim Alibhai',
    amount: 50000,
    points: 50,
    date: '2026-10-05',
    recordedBy: 'admin',
  },
  {
    id: 'P002',
    customerId: 'IS02',
    customerName: 'Fatma Mohamed',
    amount: 75000,
    points: 75,
    date: '2026-10-04',
    recordedBy: 'admin',
  },
  {
    id: 'P003',
    customerId: 'IS03',
    customerName: 'Ali Hassan',
    amount: 120000,
    points: 120,
    date: '2026-10-04',
    recordedBy: 'admin',
  },
  {
    id: 'P004',
    customerId: 'IS01',
    customerName: 'Ibrahim Alibhai',
    amount: 30000,
    points: 30,
    date: '2026-10-03',
    recordedBy: 'admin',
  },
  {
    id: 'P005',
    customerId: 'IS05',
    customerName: 'Yusuf Said',
    amount: 45000,
    points: 45,
    date: '2026-10-02',
    recordedBy: 'admin',
  },
];

export const mockRedemptions: Redemption[] = [
  {
    id: 'R001',
    customerId: 'IS03',
    customerName: 'Ali Hassan',
    points: 100,
    reference: 'REF-001',
    status: 'approved',
    date: '2026-10-04',
    processedBy: 'admin',
  },
  {
    id: 'R002',
    customerId: 'IS01',
    customerName: 'Ibrahim Alibhai',
    points: 200,
    reference: 'REF-002',
    status: 'pending',
    date: '2026-10-05',
    processedBy: null,
  },
  {
    id: 'R003',
    customerId: 'IS02',
    customerName: 'Fatma Mohamed',
    points: 50,
    reference: 'REF-003',
    status: 'approved',
    date: '2026-10-03',
    processedBy: 'admin',
  },
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'A001',
    admin: 'admin',
    action: 'RECORD_PURCHASE',
    customer: 'IS01 - Ibrahim Alibhai',
    description: 'Recorded purchase of TZS 50,000',
    date: '2026-10-05 10:30',
  },
  {
    id: 'A002',
    admin: 'admin',
    action: 'APPROVE_REDEMPTION',
    customer: 'IS03 - Ali Hassan',
    description: 'Approved redemption of 100 points',
    date: '2026-10-04 15:45',
  },
  {
    id: 'A003',
    admin: 'admin',
    action: 'UPDATE_POINT_RULES',
    customer: 'N/A',
    description: 'Updated point rules: TZS 1,000 = 1 point',
    date: '2026-10-01 09:00',
  },
];

export const mockPointRules: PointRules = {
  tzsPerPoint: 1000,
  redemptionWaitDays: 90,
  activityPeriodDays: 25,
};

export const dashboardMetrics = {
  totalCustomers: mockCustomers.length,
  activeCustomers: mockCustomers.filter(c => c.status === 'active').length,
  inactiveCustomers: mockCustomers.filter(c => c.status === 'inactive').length,
  pointsIssued: mockPurchases.reduce((sum, p) => sum + p.points, 0),
  redeemablePoints: mockCustomers.reduce((sum, c) => sum + c.redeemablePoints, 0),
  redeemedPoints: mockRedemptions.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.points, 0),
  todayTransactions: mockPurchases.filter(p => p.date === '2026-10-05').length,
  todayPurchaseValue: mockPurchases.filter(p => p.date === '2026-10-05').reduce((sum, p) => sum + p.amount, 0),
};
