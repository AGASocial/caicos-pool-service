---
name: Caicos React Native Development
trigger: "building technician app", "react native screen", "mobile component", "expo router", "mobile app", "offline sync"
description: "Expert guidance for building Caicos technician app with React Native, Expo SDK 52, TypeScript, Zustand state management, and Supabase integration. Handles job dashboard, service forms, photo capture, offline support, and real-time synchronization."
---

# Caicos React Native Development

You are a React Native specialist building the Caicos technician app. Use this knowledge to generate production-ready code for mobile platforms.

## Technology Stack
- **Framework**: React Native + Expo SDK 52
- **Routing**: Expo Router (file-based)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand
- **UI Components**: React Native built-ins + Tamagui (optional)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Offline**: SQLite + sync queue
- **Deployment**: EAS (Expo Application Services)

## Caicos Technician App Architecture

### Screens Structure
```
app/
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (app)/
│   ├── (tabs)/
│   │   ├── dashboard.tsx      (jobs list for today)
│   │   ├── properties.tsx     (properties directory)
│   │   ├── profile.tsx        (settings/profile)
│   │   └── _layout.tsx        (tab navigation)
│   ├── job/
│   │   ├── [id].tsx           (job detail)
│   │   └── service-form/
│   │       └── [id].tsx       (service form)
│   ├── _layout.tsx
│   └── +html.tsx
└── _layout.tsx
```

### Key Features
1. **Multi-tenant Authentication** - Supabase Auth
2. **Daily Jobs Dashboard** - Real-time job list with assignment
3. **Service Form** - Chemical readings, equipment checks, task completion, photos, notes
4. **Photo Capture** - Take photos with device camera
5. **Offline Support** - Queue syncing when reconnected
6. **Properties Directory** - Browse all service locations
7. **Profile Settings** - User preferences and account

## Coding Standards

### TypeScript Patterns
```typescript
// types/index.ts
export type Job = {
  id: string;
  company_id: string;
  property_id: string;
  technician_id: string;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
};

export type ServiceReading = {
  job_id: string;
  ph_level: number;
  chlorine_level: number;
  alkalinity: number;
  calcium_hardness: number;
  salt_level: number | null;
  temperature: number;
  other_chemical?: string;
};

export type ServicePhoto = {
  id: string;
  job_id: string;
  type: 'before' | 'after' | 'issue';
  uri: string;
  uploaded_at: string;
};
```

### State Management with Zustand
```typescript
// store/useJobStore.ts
import { create } from 'zustand';

interface JobStore {
  jobs: Job[];
  currentJob: Job | null;
  setJobs: (jobs: Job[]) => void;
  setCurrentJob: (job: Job | null) => void;
  updateJobStatus: (jobId: string, status: string) => void;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  currentJob: null,
  setJobs: (jobs) => set({ jobs }),
  setCurrentJob: (job) => set({ currentJob: job }),
  updateJobStatus: (jobId, status) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, status } : j
      ),
    })),
}));
```

### Screen Component Pattern
```typescript
// app/(app)/(tabs)/dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { useJobStore } from '@/store/useJobStore';

export default function DashboardScreen() {
  const user = useAuth();
  const setJobs = useJobStore((state) => state.setJobs);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', user.id],
    queryFn: async () => {
      const response = await supabase
        .from('jobs')
        .select('*')
        .eq('technician_id', user.id)
        .eq('scheduled_date', todayDate);

      if (response.error) throw response.error;
      setJobs(response.data);
      return response.data;
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlashList
      data={jobs}
      renderItem={({ item }) => <JobCard job={item} />}
      estimatedItemSize={100}
    />
  );
}
```

### Photo Capture Pattern
```typescript
// hooks/usePhotoCapture.ts
import { CameraView } from 'expo-camera';
import { useState } from 'react';

export function usePhotoCapture() {
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);

  const capturePhoto = async (type: 'before' | 'after' | 'issue') => {
    // Camera capture logic
    const photo: ServicePhoto = {
      id: generateId(),
      job_id: currentJob.id,
      type,
      uri: photoUri,
      uploaded_at: new Date().toISOString(),
    };
    setPhotos((prev) => [...prev, photo]);
  };

  return { photos, capturePhoto };
}
```

### Offline Sync Pattern
```typescript
// store/useSyncQueue.ts
interface SyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export const useSyncQueue = create<SyncQueueStore>((set) => ({
  queue: [],
  addToQueue: (item) => set((state) => ({
    queue: [...state.queue, { ...item, id: generateId(), synced: false }],
  })),
  syncQueue: async () => {
    const { queue } = get();
    for (const item of queue.filter((q) => !q.synced)) {
      try {
        // Upload to Supabase
        await supabase.from(item.table).upsert(item.data);
        // Mark as synced
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  },
}));
```

## Authentication & Authorization

### Supabase Auth Setup
- Email/password authentication
- Session persistence with Secure Store
- Multi-tenant via company_id

### Session Management
```typescript
// hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  return user;
}
```

## Common Patterns

### Loading States
- Show activity indicator while fetching
- Keep showing last loaded data if possible (stale-while-revalidate)
- Disable form submissions during mutation

### Error Handling
```typescript
try {
  await submitServiceForm(formData);
  showToast('Service report submitted successfully!');
  navigation.goBack();
} catch (error) {
  showToast(error.message || 'Failed to submit report', 'error');
}
```

### Form Validation
```typescript
const errors = validateServiceForm(formData);
if (Object.keys(errors).length > 0) {
  showErrors(errors);
  return;
}
```

### Navigation Patterns
```typescript
// Using Expo Router
import { useRouter } from 'expo-router';

const router = useRouter();
router.push(`/job/${jobId}/service-form`);
router.back();
```

## Testing Strategy
- Unit tests for Zustand stores and hooks
- Integration tests for Supabase queries
- E2E tests for critical flows (auth → dashboard → service form → offline sync)
- Mock Supabase for testing
- Minimum 80% code coverage

---

See `references/` for detailed screen layouts, form templates, and offline sync implementation.
