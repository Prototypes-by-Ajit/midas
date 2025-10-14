# MIDAS Authentication Migration Plan: Clerk Integration

## Current State Analysis

### Existing System (Supabase)
- **Authentication**: Email/Password + Google OAuth
- **User Management**: Supabase Auth with custom user profiles
- **Data Storage**: User-specific data stored in localStorage with user ID keys
- **Forgot Password**: Currently redirects to `/forgot-password` page
- **User Context**: Custom React context managing user state

### Issues to Address
1. ❌ Forgot password redirects to separate page instead of magic link
2. ❌ LocalStorage-based user data (not scalable)
3. ❌ No proper user management dashboard
4. ❌ Limited authentication providers
5. ❌ Manual user profile management

---

## Migration Plan to Clerk

### Phase 1: Setup & Configuration

#### 1.1 Install Clerk Dependencies
```bash
npm install @clerk/nextjs @clerk/themes
```

#### 1.2 Environment Configuration
```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

#### 1.3 Clerk Provider Setup
```tsx
// src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#your-brand-color',
        }
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### Phase 2: Authentication Implementation

#### 2.1 Replace Login Page with Clerk Components
```tsx
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-primary hover:bg-primary/90',
            footerActionLink: 'text-primary hover:text-primary/90'
          }
        }}
        routing="path"
        path="/sign-in"
        redirectUrl="/dashboard"
        signUpUrl="/sign-up"
        forgotPasswordUrl="/forgot-password"
      />
    </div>
  )
}
```

#### 2.2 Sign Up Page
```tsx
// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignUp 
        routing="path"
        path="/sign-up"
        redirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </div>
  )
}
```

#### 2.3 Magic Link Forgot Password Implementation
```tsx
// Clerk handles this automatically with magic links
// No separate page needed - integrated into sign-in form
```

### Phase 3: User Context Migration

#### 3.1 New Clerk User Context
```tsx
// src/contexts/user-context.tsx
"use client"

import { useUser as useClerkUser, useAuth } from '@clerk/nextjs'
import { createContext, useContext, useEffect, useState } from 'react'

interface MidasUserProfile {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string
  avatar?: string
  createdAt: Date
  role: 'user' | 'admin' | 'clinician'
  organization?: string
  verified: boolean
}

interface UserContextType {
  user: MidasUserProfile | null
  loading: boolean
  isSignedIn: boolean
  signOut: () => Promise<void>
  updateProfile: (data: Partial<MidasUserProfile>) => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useClerkUser()
  const { signOut: clerkSignOut } = useAuth()
  const [user, setUser] = useState<MidasUserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && clerkUser) {
        const midasUser: MidasUserProfile = {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          name: clerkUser.fullName || `${clerkUser.firstName} ${clerkUser.lastName}`,
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          avatar: clerkUser.imageUrl,
          createdAt: clerkUser.createdAt!,
          role: (clerkUser.publicMetadata?.role as any) || 'user',
          organization: clerkUser.publicMetadata?.organization as string,
          verified: clerkUser.emailAddresses[0]?.verification.status === 'verified'
        }
        setUser(midasUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, clerkUser])

  const signOut = async () => {
    await clerkSignOut()
    setUser(null)
  }

  const updateProfile = async (data: Partial<MidasUserProfile>) => {
    if (!clerkUser) return
    
    // Update user metadata
    await clerkUser.update({
      firstName: data.firstName,
      lastName: data.lastName,
    })

    // Update public metadata for role/organization
    await clerkUser.updatePublicMetadata({
      role: data.role,
      organization: data.organization,
    })
  }

  return (
    <UserContext.Provider value={{
      user,
      loading,
      isSignedIn: !!user,
      signOut,
      updateProfile
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
```

### Phase 4: Database Integration for User-Specific Data

#### 4.1 Database Schema Design
```sql
-- Users table (managed by Clerk, but we can extend)
CREATE TABLE user_profiles (
  id VARCHAR PRIMARY KEY, -- Clerk user ID
  email VARCHAR UNIQUE NOT NULL,
  role VARCHAR DEFAULT 'user',
  organization VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Analysis results table
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES user_profiles(id),
  image_name VARCHAR NOT NULL,
  image_url VARCHAR,
  confidence DECIMAL,
  diagnosis VARCHAR,
  risk_level VARCHAR CHECK (risk_level IN ('low', 'medium', 'high')),
  recommendations JSONB,
  detected_features JSONB,
  processing_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User statistics (computed/cached)
CREATE TABLE user_statistics (
  user_id VARCHAR PRIMARY KEY REFERENCES user_profiles(id),
  total_analyses INTEGER DEFAULT 0,
  avg_accuracy DECIMAL DEFAULT 0,
  risk_distribution JSONB DEFAULT '{"low": 0, "medium": 0, "high": 0}',
  recent_analyses INTEGER DEFAULT 0,
  monthly_analyses INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Analysis reports
CREATE TABLE analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES user_profiles(id),
  title VARCHAR NOT NULL,
  analysis_ids JSONB, -- Array of analysis IDs
  summary JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.2 API Routes for User Data
```tsx
// src/app/api/user/profile/route.ts
import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Fetch user profile from database
  // Return user-specific data
}

export async function PUT(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Update user profile
}
```

```tsx
// src/app/api/analytics/route.ts
import { auth } from '@clerk/nextjs'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Fetch user-specific analytics from database
  // Return statistics, analysis history, reports
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Add new analysis result
  // Update statistics
}
```

#### 4.3 Updated Analytics Context with Database
```tsx
// src/contexts/analytics-context.tsx
"use client"

import { useUser } from './user-context'
import { useEffect, useState } from 'react'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn } = useUser()
  const [statistics, setStatistics] = useState<UserStatistics>(defaultStats)
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([])
  const [reports, setReports] = useState<AnalysisReport[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch user data from API instead of localStorage
  useEffect(() => {
    if (isSignedIn && user) {
      fetchUserAnalytics()
    }
  }, [isSignedIn, user])

  const fetchUserAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics')
      const data = await response.json()
      
      setStatistics(data.statistics)
      setAnalysisHistory(data.analysisHistory)
      setReports(data.reports)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const addAnalysisResult = async (result: Omit<AnalysisResult, 'id' | 'user_id' | 'analysis_date'>) => {
    if (!user) return

    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      })

      if (response.ok) {
        await fetchUserAnalytics() // Refresh data
      }
    } catch (error) {
      console.error('Error adding analysis result:', error)
    }
  }

  // ... rest of the implementation
}
```

### Phase 5: Route Protection

#### 5.1 Middleware for Protected Routes
```tsx
// src/middleware.ts
import { authMiddleware } from '@clerk/nextjs'

export default authMiddleware({
  publicRoutes: [
    '/',
    '/learn-more',
    '/aboutus', 
    '/contact',
    '/terms',
    '/privacy',
    '/docs',
    '/sign-in',
    '/sign-up'
  ],
  ignoredRoutes: [
    '/api/webhooks/(.*)',
  ],
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

#### 5.2 Protected Dashboard Layout
```tsx
// src/app/dashboard/layout.tsx
import { auth } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <UserProvider>
      <AnalyticsProvider>
        <LoadingProvider>
          {/* Existing layout */}
          {children}
        </LoadingProvider>
      </AnalyticsProvider>
    </UserProvider>
  )
}
```

### Phase 6: Enhanced Features

#### 6.1 User Management Dashboard
```tsx
// src/app/dashboard/account/page.tsx
import { UserProfile } from '@clerk/nextjs'

export default function AccountPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Account Settings</h1>
      <UserProfile 
        routing="hash"
        appearance={{
          elements: {
            card: 'shadow-lg',
          }
        }}
      />
    </div>
  )
}
```

#### 6.2 Organization Management (for clinics/hospitals)
```tsx
// src/app/dashboard/organization/page.tsx
import { OrganizationProfile } from '@clerk/nextjs'

export default function OrganizationPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Organization Settings</h1>
      <OrganizationProfile routing="hash" />
    </div>
  )
}
```

### Phase 7: Migration Strategy

#### 7.1 Data Migration Plan
1. **Export existing user data** from Supabase
2. **Create mapping** between Supabase user IDs and Clerk user IDs
3. **Import analysis history** into new database with Clerk user IDs
4. **Maintain backward compatibility** during transition period

#### 7.2 Gradual Migration Approach
1. **Week 1**: Set up Clerk alongside existing Supabase (dual authentication)
2. **Week 2**: Migrate user registration to Clerk, keep Supabase for existing users
3. **Week 3**: Migrate existing users to Clerk with email invitations
4. **Week 4**: Remove Supabase authentication, full Clerk implementation

---

## Benefits of Clerk Migration

### ✅ Authentication Improvements
- **Magic link password reset** (built-in)
- **Multiple OAuth providers** (Google, GitHub, Microsoft, etc.)
- **Multi-factor authentication** support
- **Session management** with automatic refresh
- **Email verification** workflows

### ✅ User Experience
- **Professional UI components** with consistent styling
- **Mobile-responsive** authentication forms
- **Customizable appearance** to match MIDAS branding
- **Internationalization** support

### ✅ Security & Compliance
- **SOC 2 Type II** certified
- **GDPR compliance** built-in
- **Rate limiting** and bot protection
- **Audit logs** for user activities
- **Advanced security features**

### ✅ Developer Experience
- **Zero configuration** for basic setup
- **Comprehensive documentation**
- **TypeScript support** out of the box
- **Webhook support** for user events
- **Analytics dashboard**

### ✅ Scalability
- **Database-backed user data** instead of localStorage
- **Real-time user management**
- **Organization/team support** for clinics
- **Role-based access control**
- **API-first architecture**

---

## Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|--------|
| **Phase 1** | 1-2 days | Clerk setup, environment configuration |
| **Phase 2** | 2-3 days | Authentication components, login/signup pages |
| **Phase 3** | 2-3 days | User context migration, profile management |
| **Phase 4** | 3-5 days | Database setup, API routes, data migration |
| **Phase 5** | 1-2 days | Route protection, middleware setup |
| **Phase 6** | 2-3 days | Enhanced features, organization management |
| **Phase 7** | 1-2 weeks | Gradual migration, testing, deployment |

**Total Estimated Time: 2-3 weeks**

---

## Next Steps

1. ✅ **Approve this plan** and gather any additional requirements
2. 🔄 **Set up Clerk account** and obtain API keys
3. 🔄 **Begin Phase 1** implementation with basic setup
4. 🔄 **Create development branch** for Clerk migration
5. 🔄 **Set up staging environment** for testing

Would you like me to proceed with implementing this migration plan?