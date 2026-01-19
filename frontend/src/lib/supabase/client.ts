import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  const globalClient = globalThis as typeof globalThis & {
    __supabaseClient?: SupabaseClient
  }

  if (!globalClient.__supabaseClient) {
    globalClient.__supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  }

  return globalClient.__supabaseClient
}

export const createClient = getSupabaseClient
export const supabase = getSupabaseClient()
