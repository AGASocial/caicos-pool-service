import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if the URL is valid before creating the client
const isValidSupabaseUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith('.supabase.co') && urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'set' : 'missing',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'set' : 'missing'
  })
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

if (!isValidSupabaseUrl(supabaseUrl)) {
  console.error('Invalid Supabase URL:', supabaseUrl);
  throw new Error('Invalid Supabase URL. Please check your NEXT_PUBLIC_SUPABASE_URL in .env.local')
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
)

export type Database = {
  public: {
    Tables: {
      billing_plans: {
        Row: {
          id: string
          name: string
          currency: string
          amount_cents: number
          interval: string
          features: Record<string, unknown>
          provider_price_map: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          currency: string
          amount_cents: number
          interval: string
          features?: Record<string, unknown>
          provider_price_map?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          currency?: string
          amount_cents?: number
          interval?: string
          features?: Record<string, unknown>
          provider_price_map?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      billing_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: string
          provider: string
          provider_subscription_id: string
          provider_customer_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status: string
          provider: string
          provider_subscription_id: string
          provider_customer_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          status?: string
          provider?: string
          provider_subscription_id?: string
          provider_customer_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      billing_payment_methods: {
        Row: {
          id: string
          user_id: string
          provider: string
          provider_customer_id: string
          token: string
          brand: string | null
          last4: string | null
          exp_month: number | null
          exp_year: number | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: string
          provider_customer_id: string
          token: string
          brand?: string | null
          last4?: string | null
          exp_month?: number | null
          exp_year?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          provider_customer_id?: string
          token?: string
          brand?: string | null
          last4?: string | null
          exp_month?: number | null
          exp_year?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      billing_invoices: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          provider: string
          provider_invoice_id: string
          amount_cents: number
          currency: string
          status: string
          issued_at: string
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          provider: string
          provider_invoice_id: string
          amount_cents: number
          currency: string
          status: string
          issued_at: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          provider?: string
          provider_invoice_id?: string
          amount_cents?: number
          currency?: string
          status?: string
          issued_at?: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      billing_webhook_events: {
        Row: {
          id: string
          provider: string
          type: string
          provider_event_id: string | null
          raw: Record<string, unknown>
          received_at: string
          handled: boolean
          handled_at: string | null
          error: string | null
        }
        Insert: {
          id?: string
          provider: string
          type: string
          provider_event_id?: string | null
          raw: Record<string, unknown>
          received_at?: string
          handled?: boolean
          handled_at?: string | null
          error?: string | null
        }
        Update: {
          id?: string
          provider?: string
          type?: string
          provider_event_id?: string | null
          raw?: Record<string, unknown>
          received_at?: string
          handled?: boolean
          handled_at?: string | null
          error?: string | null
        }
      }
    }
  }
}