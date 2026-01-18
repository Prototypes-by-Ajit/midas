import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Storage bucket name
export const STORAGE_BUCKET = 'Multiagent_Skincancer_RAG'

// Types for document metadata
export interface Document {
  id: string
  name: string
  storage_path: string
  size: number
  uploaded_by: string
  uploaded_at: string
  status: 'pending' | 'processed' | 'failed'
  lesion_class?: string
  tags?: string[]
}
