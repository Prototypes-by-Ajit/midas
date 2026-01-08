// Stub Supabase server client for backward compatibility
// This app now uses Clerk for authentication

export async function createClient() {
  return {
    auth: {
      exchangeCodeForSession: () => Promise.resolve({ error: null })
    }
  };
}
