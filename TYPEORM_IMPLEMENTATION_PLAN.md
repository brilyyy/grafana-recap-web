# TypeORM Implementation Plan

## Overview
This document outlines the plan to migrate from raw SQL queries to TypeORM for better database management, proper migrations, and ORM benefits.

## Current State Analysis

### Current Database Structure
- **Connection**: MySQL2 connection pool (`src/lib/db.ts`)
- **Query Method**: Raw SQL queries using `pool.execute()`
- **Tables Identified**:
  1. `app_identifier` - Application identifiers
  2. `app_success_rate` - Transaction success rate data
  3. `response_code_dictionary` - RC mapping dictionary
  4. `unmapped_rc` - Unmapped response codes
  5. `users` - Authentication users
  6. `audit_logs` - Audit trail
  7. `rate_limit_logs` - Rate limiting logs

### Current Issues
- ❌ `restart-db` endpoint drops ALL tables (including users)
- ❌ No proper migration system
- ❌ Manual SQL schema management
- ❌ No type safety for database operations
- ❌ Difficult to maintain schema changes

## Implementation Plan

### Phase 1: Setup & Configuration

#### 1.1 Install Dependencies
```bash
npm install typeorm mysql2 reflect-metadata
npm install --save-dev @types/node
```

**Packages:**
- `typeorm` - ORM framework
- `mysql2` - MySQL driver (already installed)
- `reflect-metadata` - Required for TypeORM decorators

#### 1.2 TypeScript Configuration
Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  }
}
```

#### 1.3 Create Data Source Configuration
**File**: `src/lib/data-source.ts`

**Configuration:**
- Connection settings from environment variables
- Entity paths
- Migration paths
- Synchronization: `false` (use migrations only)
- Logging: Development only

### Phase 2: Entity Definitions

#### 2.1 Create Entity Directory Structure
```
src/entities/
  ├── AppIdentifier.ts
  ├── AppSuccessRate.ts
  ├── ResponseCodeDictionary.ts
  ├── UnmappedRc.ts
  ├── User.ts
  ├── AuditLog.ts
  ├── RateLimitLog.ts
  └── PendingAdminRequest.ts
```

#### 2.2 Entity Specifications

**AppIdentifier Entity**
- Fields: `id`, `appName`, `createdAt`, `updatedAt`
- Relations: One-to-many with `AppSuccessRate`, `ResponseCodeDictionary`, `UnmappedRc`
- Indexes: `appName` (unique)

**AppSuccessRate Entity**
- Fields: `id`, `appIdentifier`, `tanggalTransaksi`, `bulan`, `tahun`, `jenisTransaksi`, `rc`, `rcDescription`, `totalTransaksi`, `totalNominal`, `totalBiayaAdmin`, `statusTransaksi`, `errorType`, `createdAt`, `updatedAt`
- Relations: Many-to-one with `AppIdentifier`
- Indexes: `tanggalTransaksi`, `id_app_identifier`

**ResponseCodeDictionary Entity**
- Fields: `id`, `appIdentifier`, `jenisTransaksi`, `rc`, `rcDescription`, `errorType`
- Relations: Many-to-one with `AppIdentifier`
- Unique Constraint: `(appIdentifier, jenisTransaksi, rc)`

**UnmappedRc Entity**
- Fields: `id`, `appIdentifier`, `jenisTransaksi`, `rc`, `rcDescription`, `statusTransaksi`, `errorType`, `createdAt`
- Relations: Many-to-one with `AppIdentifier`
- Unique Constraint: `(appIdentifier, jenisTransaksi, rc)`

**User Entity**
- Fields: `id`, `username`, `email`, `passwordHash`, `role`, `createdAt`, `updatedAt`
- Indexes: `username` (unique), `email` (unique)
- Enum: `role` ('superadmin' | 'admin' | 'user')
- Role Hierarchy: `superadmin` > `admin` > `user`

**AuditLog Entity**
- Fields: `id`, `userId`, `username`, `action`, `resourceType`, `resourceId`, `details`, `ipAddress`, `userAgent`, `createdAt`
- Relations: Many-to-one with `User` (nullable)
- Indexes: `userId`, `action`, `resourceType`, `createdAt`

**RateLimitLog Entity**
- Fields: `id`, `ipAddress`, `endpoint`, `blockedAt`
- Indexes: `(ipAddress, endpoint)`, `blockedAt`

**PendingUserRequest Entity** (NEW)
- Fields: `id`, `username`, `email`, `passwordHash`, `requestedRole`, `requestedBy`, `status`, `approvedRole`, `approvedBy`, `rejectedBy`, `rejectionReason`, `createdAt`, `updatedAt`
- Relations: Many-to-one with `User` (requestedBy, approvedBy, rejectedBy - all nullable)
- Indexes: `username` (unique), `email` (unique), `status`, `requestedBy`
- Enum: `status` ('pending' | 'approved' | 'rejected')
- Enum: `requestedRole` ('admin' | 'user') - Role yang diminta user
- Enum: `approvedRole` ('superadmin' | 'admin' | 'user' | NULL) - Role yang ditentukan superadmin saat approve
- Purpose: Store user registration requests awaiting superadmin approval. Superadmin menentukan role final saat approve.

### Phase 3: Migration System

#### 3.1 Initial Migration
**File**: `src/migrations/0000000000001-InitialSchema.ts`

**Purpose**: Create all tables with proper schema
- Create all 8 tables (including `pending_user_requests`)
- Set up foreign keys
- Create indexes
- Set up constraints
- Update `users.role` ENUM to include 'superadmin'

**Get Timestamp**: Run node -e "console.log(Date.now())" to get current migration timestamp

#### 3.2 Seed Migration Default Apps
**File**: `src/migrations/0000000000002-SeedDefaultApps.ts`

**Purpose**: Insert default app identifiers
- Insert: 'Bale', 'CMS', 'SMS Notif', 'QRIS', 'EDC Merchant', 'EDC Agent', 'Bale Korpora'

**Get Timestamp**: Run node -e "console.log(Date.now())" to get current migration timestamp

#### 3.3 Seed Migration Super Admin
**File**: `src/migrations/0000000000003-SeedSuperAdmins.ts`

**Purpose**: Insert default Super Admin users from environment variables

**Implementation Details**:
- Read `DEFAULT_SU_USERNAME` and `DEFAULT_SU_PASSWORD` from environment variables
- Parse comma-separated values (multiple superadmin accounts supported)
- Format: `DEFAULT_SU_USERNAME=user1,user2,user3` and `DEFAULT_SU_PASSWORD=pass1,pass2,pass3`
- Validate: Username and password arrays must have same length
- Hash passwords using `bcryptjs` (12 salt rounds) before insertion
- Insert users with `role = 'superadmin'`
- Email format: Use `{username}@superadmin.local` if email not provided separately
- Handle duplicate username/email gracefully (skip if exists)

**Environment Variables Required**:
```env
DEFAULT_SU_USERNAME=superadmin1,superadmin2
DEFAULT_SU_PASSWORD=password1,password2
```

**Get Timestamp**: Run node -e "console.log(Date.now())" to get current migration timestamp

#### 3.4 Migration Commands
Create npm scripts:
```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate",
    "migration:run": "typeorm-ts-node-commonjs migration:run",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert",
    "migration:show": "typeorm-ts-node-commonjs migration:show"
  }
}
```

### Phase 4: Repository Pattern

#### 4.1 Create Repository Helper
**File**: `src/lib/repository.ts`

**Purpose**: 
- Export `AppDataSource` instance
- Helper functions to get repositories
- Connection management for Next.js

#### 4.2 Update Database Connection
**File**: `src/lib/db.ts`

**Changes**:
- Keep existing pool for backward compatibility during migration
- Add TypeORM data source initialization
- Export both pool and data source

### Phase 5: Authentication & Authorization Updates

#### 5.1 Update Auth Library
**File**: `src/lib/auth.ts`

**Changes**:
- Update `UserRole` type to include `'superadmin'`
- Update role hierarchy: `superadmin` > `admin` > `user`
- Add `requireSuperAdmin()` function
- Update `hasRole()` to handle superadmin hierarchy
- Superadmin can access all admin routes + approval routes

#### 5.2 Update Existing Auth Routes
- Remove `/api/auth/create-admin` → Replace with request system
- Remove `/api/auth/create-user` → Only superadmin can create users directly
- All user creation must go through superadmin approval (except superadmin seed)
- All auth routes should recognize superadmin role

### Phase 6: User Registration & Approval System

#### 6.1 User Registration Request System

**6.1.1 Request User Registration**
**Route**: `POST /api/auth/request-user`
- **Access**: Public (anyone can request)
- **Purpose**: Submit user registration request
- **Request Body**: `{ username, email, password, requestedRole }`
  - `requestedRole`: 'admin' | 'user' (role yang diminta user)
- **Response**: Success message with request ID
- **Behavior**:
  - Validate input (username, email, password, requestedRole)
  - Check if username/email already exists (in users or pending requests)
  - Hash password
  - Create `PendingUserRequest` with status 'pending' and `requestedRole`
  - Log audit event: `USER_REQUEST_CREATED`
  - Send notification to superadmins (optional, future enhancement)

**6.1.2 List Pending User Requests**
**Route**: `GET /api/auth/pending-user-requests`
- **Access**: Superadmin only
- **Purpose**: Get list of pending user registration requests
- **Query Params**: `?status=pending&page=1&limit=10&requestedRole=admin`
- **Response**: Paginated list of requests with user details
- **Behavior**:
  - Require superadmin authentication
  - Filter by status (pending, approved, rejected)
  - Filter by requestedRole (optional)
  - Include pagination
  - Return: id, username, email, requestedRole, requestedBy, createdAt, status

**6.1.3 Approve User Request (Superadmin Determines Role)**
**Route**: `POST /api/auth/approve-user-request/:id`
- **Access**: Superadmin only
- **Purpose**: Approve a pending user registration request
- **Request Body**: `{ approvedRole: 'superadmin' | 'admin' | 'user', notes? }`
  - **`approvedRole`**: REQUIRED - Role yang ditentukan superadmin (bisa berbeda dari requestedRole)
  - **`notes`**: Optional - Catatan dari superadmin
- **Response**: Success message
- **Behavior**:
  - Require superadmin authentication
  - Find pending request by ID
  - Validate request status is 'pending'
  - Validate `approvedRole` is valid ('superadmin' | 'admin' | 'user')
  - **Superadmin dapat menentukan role berbeda dari yang diminta user**
  - Create `User` with `role = approvedRole` (bukan requestedRole)
  - Update `PendingUserRequest` status to 'approved', set `approvedBy`, `approvedRole`
  - Keep request record for audit trail
  - Log audit event: `USER_REQUEST_APPROVED` with details (requestedRole → approvedRole)
  - Send notification to requester (optional, future enhancement)

**6.1.4 Reject User Request**
**Route**: `POST /api/auth/reject-user-request/:id`
- **Access**: Superadmin only
- **Purpose**: Reject a pending user registration request
- **Request Body**: `{ reason: string }` (required)
- **Response**: Success message
- **Behavior**:
  - Require superadmin authentication
  - Find pending request by ID
  - Validate request status is 'pending'
  - Update `PendingUserRequest` status to 'rejected', set `rejectedBy`, `rejectionReason`
  - Log audit event: `USER_REQUEST_REJECTED`
  - Send notification to requester (optional, future enhancement)

**6.1.5 Get User Request Details**
**Route**: `GET /api/auth/user-request/:id`
- **Access**: Superadmin only
- **Purpose**: Get detailed information about a specific user request
- **Response**: Full request details including requestedRole, approvedRole (if approved), history

**6.1.6 Create User Directly (Superadmin Only)**
**Route**: `POST /api/auth/create-user`
- **Access**: Superadmin only
- **Purpose**: Create user directly without approval (superadmin privilege)
- **Request Body**: `{ username, email, password, role }`
  - `role`: 'superadmin' | 'admin' | 'user' (superadmin determines)
- **Response**: Success message with user details
- **Behavior**:
  - Require superadmin authentication
  - Validate input (username, email, password, role)
  - Check if username/email already exists
  - Hash password
  - Create `User` directly with specified role
  - Log audit event: `USER_CREATED_DIRECTLY` by superadmin
  - **Use Case**: Superadmin can create users immediately without going through approval process

#### 6.2 Frontend Approval Page

**6.2.1 User Approval Page Component**
**File**: `src/app/user-approval/page.tsx`

**Features**:
- **Access Control**: Only accessible by superadmin (redirect if not)
- **Layout**: Similar to dashboard with glassmorphism design
- **Sections**:
  1. **Pending Requests List**
     - Table/card view of pending requests
     - Columns: Username, Email, Requested Role, Requested By, Request Date, Actions
     - Show requestedRole badge (admin/user)
     - Action buttons: Approve, Reject
  2. **Approve Modal**
     - Show full request information
     - **Role Selection Dropdown** (REQUIRED):
       - Options: 'superadmin', 'admin', 'user'
       - Default: Use requestedRole, but superadmin can change
       - Label: "Assign Role" (superadmin determines final role)
     - Notes input (optional)
     - Approve button
  3. **Reject Modal**
     - Show request information
     - Rejection reason input (required)
     - Reject button
  4. **History Tab**
     - Show approved/rejected requests
     - Display: requestedRole → approvedRole (if different)
     - Filter by status, requestedRole, approvedRole
     - Search functionality

**6.2.2 Create User Page (Superadmin Only)**
**File**: `src/app/create-user/page.tsx`

**Features**:
- **Access Control**: Only accessible by superadmin
- **Purpose**: Create user directly without approval
- **Form Fields**:
  - Username (required)
  - Email (required)
  - Password (required, min 8 chars)
  - **Role Selection** (required):
    - Dropdown: 'superadmin', 'admin', 'user'
    - Superadmin determines role
- **Submit**: Creates user immediately

**6.2.3 Navigation Integration**
- Add "User Approval" link in navigation (superadmin only)
- Add "Create User" link in navigation (superadmin only)
- Show badge with pending count on approval link
- Accessible from dashboard or header

**6.2.4 Request Status Component**
**File**: `src/components/UserRequestCard.tsx` (or similar)

**Purpose**: Reusable component for displaying user request cards
- Show request details
- Display requestedRole badge
- Display approvedRole badge (if approved and different)
- Approve/Reject buttons
- Status badges
- Request date and requester info

### Phase 7: API Route Migration

#### 7.1 Migration Strategy
- Migrate one route at a time
- Keep old implementation commented for reference
- Test thoroughly before removing old code

#### 7.2 Routes to Migrate (Priority Order)

**High Priority:**
1. `/api/applications` - Simple CRUD
2. `/api/db-status` - Simple query
3. `/api/auth/*` - Authentication routes (with approval system)

**Medium Priority:**
4. `/api/dictionary` - Read operations
5. `/api/unmapped-rc` - Read operations
6. `/api/no-rc-transaction` - Read operations

**Lower Priority (Complex):**
7. `/api/upload-dictionary` - Bulk operations
8. `/api/upload-success-rate` - Bulk operations
9. `/api/dictionary/update*` - Update operations
10. `/api/unmapped-rc/submit*` - Transaction operations
11. `/api/no-rc-transaction/submit*` - Transaction operations

### Phase 8: Remove Restart-DB

#### 6.1 Remove Files
- ❌ `src/app/api/restart-db/route.ts`
- ❌ `src/components/RestartDbCard.tsx`

#### 6.2 Update Dashboard
- Remove `RestartDbCard` import from `src/app/page.tsx`
- Remove card from layout (all 3 layouts: desktop, tablet, mobile)

#### 6.3 Update API Documentation
- Remove restart-db endpoint references
- Update any documentation mentioning restart-db

### Phase 9: Migration Execution

#### 7.1 Development Migration
1. Run initial migration to create schema
2. Test all endpoints
3. Verify data integrity

#### 7.2 Production Migration Strategy
1. Backup existing database
2. Run migrations in staging first
3. Test thoroughly
4. Deploy to production
5. Run migrations on production

## File Structure After Implementation

```
src/
├── lib/
│   ├── data-source.ts          # TypeORM data source config
│   ├── db.ts                   # Updated with TypeORM
│   ├── repository.ts           # Repository helpers
│   ├── auth.ts                 # Updated with superadmin support
│   └── migrations/             # Migration files
│       ├── 0000000000001-InitialSchema.ts
│       ├── 0000000000002-SeedDefaultApps.ts
│       └── 0000000000003-SeedSuperAdmins.ts
├── entities/
│   ├── AppIdentifier.ts
│   ├── AppSuccessRate.ts
│   ├── ResponseCodeDictionary.ts
│   ├── UnmappedRc.ts
│   ├── User.ts
│   ├── AuditLog.ts
│   ├── RateLimitLog.ts
│   └── PendingUserRequest.ts
├── app/
│   ├── user-approval/
│   │   └── page.tsx            # User approval page (superadmin only)
│   ├── create-user/
│   │   └── page.tsx            # Create user page (superadmin only)
│   └── api/
│       └── auth/
│           ├── request-user/
│           │   └── route.ts    # Request user registration
│           ├── pending-user-requests/
│           │   └── route.ts   # List pending requests
│           ├── approve-user-request/
│           │   └── [id]/
│           │       └── route.ts # Approve request (with role selection)
│           ├── reject-user-request/
│           │   └── [id]/
│           │       └── route.ts # Reject request
│           └── create-user/
│               └── route.ts    # Create user directly (superadmin)
└── components/
    └── UserRequestCard.tsx     # User request card component
```

## Benefits After Implementation

✅ **Proper Migration System**: Version-controlled schema changes
✅ **Type Safety**: TypeScript types for all database operations
✅ **Better Maintainability**: ORM abstractions instead of raw SQL
✅ **Data Integrity**: Foreign keys and constraints properly managed
✅ **No More Data Loss**: Migrations preserve data during schema changes
✅ **Development Experience**: Better IDE support and autocomplete

## Risks & Mitigation

### Risk 1: Breaking Changes During Migration
**Mitigation**: 
- Migrate incrementally
- Keep old code commented
- Test each route thoroughly

### Risk 2: Performance Impact
**Mitigation**:
- TypeORM is performant with proper indexing
- Can optimize queries if needed
- Monitor performance metrics

### Risk 3: Learning Curve
**Mitigation**:
- Well-documented entities
- Clear migration examples
- Code comments for complex operations

## Testing Checklist

- [ ] All entities created correctly (including PendingAdminRequest)
- [ ] All relationships working
- [ ] Migrations run successfully (including superadmin seed)
- [ ] Superadmin role hierarchy working
- [ ] User registration & approval workflow tested:
  - [ ] Request user registration with requestedRole
  - [ ] List pending requests (superadmin only)
  - [ ] Approve request with approvedRole (superadmin determines role)
  - [ ] Test role override (requestedRole != approvedRole)
  - [ ] Reject request (superadmin only)
  - [ ] User created with approvedRole (not requestedRole)
  - [ ] Direct user creation by superadmin
  - [ ] Role selection in approval modal works
  - [ ] Audit logs recorded
- [ ] Approval page accessible only by superadmin
- [ ] Create user page accessible only by superadmin
- [ ] Superadmin can assign any role (superadmin/admin/user)
- [ ] All API routes tested
- [ ] Authentication still works (all roles)
- [ ] Data integrity maintained
- [ ] Performance acceptable
- [ ] No breaking changes

## Timeline Estimate

- **Phase 1-2**: Setup & Entities (2-3 hours)
- **Phase 3**: Migrations (2-3 hours) - Includes superadmin seed
- **Phase 4**: Repository Pattern (1 hour)
- **Phase 5**: Auth & Authorization Updates (1-2 hours)
- **Phase 6**: User Registration & Approval System (4-5 hours)
  - API routes: 2-3 hours
  - Approval page: 1-2 hours
  - Create user page: 1 hour
- **Phase 7**: API Route Migration (4-6 hours)
- **Phase 8**: Remove Restart-DB (30 minutes)
- **Phase 9**: Testing & Refinement (3-4 hours)

**Total Estimated Time**: 16-23 hours

## Environment Variables for Superadmin

Add to `.env` file:
```env
# Superadmin credentials (comma-separated for multiple accounts)
DEFAULT_SU_USERNAME=superadmin1,superadmin2
DEFAULT_SU_PASSWORD=SecurePassword1,SecurePassword2

# Optional: Separate email for each superadmin (comma-separated)
# If not provided, will use {username}@superadmin.local
DEFAULT_SU_EMAIL=admin1@example.com,admin2@example.com
```

**Security Notes**:
- Passwords in .env are plaintext (will be hashed during migration)
- Change default passwords immediately after first login
- Use strong passwords in production
- Consider using secrets management for production

## Next Steps After Approval

1. Install dependencies
2. Create data source configuration
3. Define all entities (including PendingAdminRequest)
4. Update auth library with superadmin support
5. Create initial migration (with pending_admin_requests table)
6. Create superadmin seed migration
7. Implement user registration & approval API routes
8. Create user approval frontend page
9. Create direct user creation page (superadmin)
9. Migrate API routes incrementally
10. Remove restart-db functionality
11. Test thoroughly (including approval workflow)
12. Deploy

## Role-Based Access Control (RBAC) Summary

### Role Hierarchy
```
superadmin > admin > user
```

### Role Permissions

#### 1. **Superadmin** (Highest Privilege)
**Functions:**
- ✅ Approve/reject admin registration requests
- ✅ Access admin approval page (`/admin-approval`)
- ✅ All admin privileges (see below)
- ✅ Create admin users (via approval system)
- ✅ Create regular users (via `/api/auth/create-user`)
- ✅ Access all dashboard features
- ✅ View audit logs
- ✅ All read/write operations

**Restrictions:**
- ❌ Cannot restart database (will be removed anyway)

#### 2. **Admin** (Standard Admin Privilege)
**Functions:**
- ✅ Access dashboard
- ✅ Create regular users (via `/api/auth/create-user`)
- ✅ Manage applications (CRUD)
- ✅ Upload dictionary files
- ✅ Upload success rate data
- ✅ Manage dictionary entries
- ✅ Submit unmapped RC
- ✅ Submit no-RC transactions
- ✅ View all data
- ✅ All read/write operations on business data

**Restrictions:**
- ❌ Cannot approve admin requests (superadmin only)
- ❌ Cannot access admin approval page
- ❌ Cannot restart database (will be removed)

#### 3. **User** (Standard User - Lowest Privilege)
**Functions:**
- ✅ Access dashboard (read-only or limited write)
- ✅ View applications list
- ✅ View dictionary data
- ✅ View success rate data
- ✅ View unmapped RC (read-only)
- ✅ View no-RC transactions (read-only)
- ✅ Basic read operations on business data

**Restrictions:**
- ❌ Cannot create users (admin/superadmin only)
- ❌ Cannot upload files (dictionary/success rate)
- ❌ Cannot modify dictionary entries
- ❌ Cannot submit unmapped RC
- ❌ Cannot submit no-RC transactions
- ❌ Cannot manage applications (add/edit/delete)
- ❌ Cannot access admin approval page
- ❌ Cannot restart database

**Note:** Role 'user' is designed for **viewers/readers** who need to access the dashboard to view data but don't need to modify or manage it. This is useful for:
- Business analysts who need to view reports
- Stakeholders who need read-only access
- Team members who need to monitor data but not make changes

### Permission Matrix

| Feature | User | Admin | Superadmin |
|---------|------|-------|------------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Applications | ✅ | ✅ | ✅ |
| Create/Edit Applications | ❌ | ✅ | ✅ |
| Upload Dictionary | ❌ | ✅ | ✅ |
| Upload Success Rate | ❌ | ✅ | ✅ |
| Edit Dictionary | ❌ | ✅ | ✅ |
| Submit Unmapped RC | ❌ | ✅ | ✅ |
| Submit No-RC Transaction | ❌ | ✅ | ✅ |
| Create User (any role) | ❌ | ❌ | ✅ |
| Request User Registration | ✅ | ❌ | ❌ |
| Approve User Request | ❌ | ❌ | ✅ |
| View User Approval Page | ❌ | ❌ | ✅ |
| Determine User Role | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ✅ | ✅ |

## Superadmin Feature Summary

### Overview
Superadmin is the highest privilege level in the system, responsible for approving new admin user registrations.

### Key Features

1. **Role Hierarchy**
   - `superadmin` > `admin` > `user`
   - Superadmin can access all admin routes + approval routes
   - Superadmin created via migration from environment variables

2. **User Registration & Approval Workflow**
   ```
   User Request (with requestedRole) 
   → PendingUserRequest (pending, requestedRole) 
   → Superadmin Review 
   → Approve with approvedRole (superadmin determines role)
   → User Created (with approvedRole, bisa berbeda dari requestedRole)
   
   OR
   
   Superadmin Create User Directly
   → User Created immediately (superadmin determines role)
   ```

3. **Database Changes**
   - New table: `pending_user_requests` (with `requestedRole` and `approvedRole` fields)
   - Updated `users.role` ENUM: `('superadmin', 'admin', 'user')`
   - Foreign keys to track who requested/approved/rejected
   - `approvedRole` field allows superadmin to assign different role than requested

4. **API Endpoints**
   - `POST /api/auth/request-user` - Submit user request with requestedRole (public)
   - `GET /api/auth/pending-user-requests` - List requests (superadmin)
   - `POST /api/auth/approve-user-request/:id` - Approve with approvedRole (superadmin determines role)
   - `POST /api/auth/reject-user-request/:id` - Reject (superadmin)
   - `POST /api/auth/create-user` - Create user directly (superadmin only, determines role)

5. **Frontend Pages**
   - `/user-approval` - User approval dashboard (superadmin only)
     - Shows pending requests with requestedRole
     - Approve modal with role selection (superadmin determines final role)
     - Reject modal with reason
     - Request history showing requestedRole → approvedRole
   - `/create-user` - Create user directly (superadmin only)
     - Form with role selection (superadmin determines role)
     - Creates user immediately without approval

6. **Security**
   - Superadmin credentials from environment variables
   - Passwords hashed before storage
   - All approval actions logged in audit_logs
   - Role-based access control enforced

### User Creation Flow

**Option 1: Request & Approval Flow**
1. **User Request**: Anyone can submit registration request with `requestedRole` (admin/user)
2. **Pending Request**: Request stored in `pending_user_requests` with status 'pending'
3. **Superadmin Review**: Superadmin views pending requests
4. **Superadmin Decision**: 
   - **Approve**: Superadmin selects `approvedRole` (can be different from requestedRole)
   - **Reject**: Superadmin provides rejection reason
5. **User Creation**: Approved requests create user with `approvedRole` (determined by superadmin)

**Option 2: Direct Creation (Superadmin Only)**
1. **Superadmin Action**: Superadmin creates user directly via `/create-user` page
2. **Role Selection**: Superadmin selects role (superadmin/admin/user)
3. **Immediate Creation**: User created immediately without approval process

### Key Points
- ✅ **Superadmin determines final role** - Can assign different role than requested
- ✅ **Only superadmin can create users** - Either via approval or direct creation
- ✅ **All user creation logged** - Audit trail for all user creation activities
- ✅ **Flexible role assignment** - Superadmin has full control over user roles

---

**Ready for Review**: Please review this plan and provide feedback before implementation begins.
