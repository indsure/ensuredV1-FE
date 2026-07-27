import { supabase } from './supabase';

/**
 * Get a valid authentication session, refreshing if necessary
 * @throws Error if not authenticated or refresh fails
 */
export async function getValidSession() {
  // Try to get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error('Authentication error: ' + error.message);
  }
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Check if token is about to expire (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiresAt - now;
  
  if (timeUntilExpiry < 300) {
    // Token expires soon, refresh it
    console.log('[Auth] Token expiring soon, refreshing...');
    const { data: { session: newSession }, error: refreshError } = 
      await supabase.auth.refreshSession();
    
    if (refreshError || !newSession) {
      throw new Error('Session expired - please log in again');
    }
    
    console.log('[Auth] Token refreshed successfully');
    return newSession;
  }
  
  return session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

/**
 * Get authorization header for API requests
 */
export async function getAuthHeader(): Promise<{ Authorization: string }> {
  const session = await getValidSession();
  return {
    Authorization: `Bearer ${session.access_token}`
  };
}
