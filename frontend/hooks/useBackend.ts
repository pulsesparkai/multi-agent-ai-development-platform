import { useAuth } from "@clerk/clerk-react";
import backend from "~backend/client";

// Retry logic for rate limited requests
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || 
                         error?.message?.includes('rate limit') ||
                         error?.message?.includes('429');
      
      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Returns the backend client with authentication and retry logic
export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  
  if (!isSignedIn) return backend;
  
  return backend.with({
    auth: async () => {
      try {
        const token = await retryWithBackoff(async () => {
          return await getToken();
        });
        return token ? { authorization: `Bearer ${token}` } : {};
      } catch (error) {
        console.error('Failed to get auth token after retries:', error);
        return {};
      }
    }
  });
}
