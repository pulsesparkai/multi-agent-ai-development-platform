import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface AuthParams {
  authorization?: Header<"Authorization">;
  session?: Cookie<"session">;
}

export interface AuthData {
  userID: string;
  imageUrl: string;
  email: string | null;
}

const AUTHORIZED_PARTIES = [
  "https://multi-agent-ai-development-platform-d3ac6ek82vji7q8c7gmg.lp.dev",
  "https://*.lp.dev",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173", // Vite dev server
  "https://staging-*.lp.dev",
];

export const auth = authHandler<AuthParams, AuthData>(
  async (data) => {
    const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
    if (!token) {
      throw APIError.unauthenticated("missing token");
    }

    try {
      // Token verification options
      const verifyOptions: any = {
        secretKey: clerkSecretKey(),
        // Always include authorized parties but be more permissive
        authorizedParties: AUTHORIZED_PARTIES,
        skipJwksCache: true, // Helps with development
      };
      
      const verifiedToken = await verifyToken(token, verifyOptions);

      if (!verifiedToken.sub) {
        throw new Error("Token missing subject");
      }

      const user = await clerkClient.users.getUser(verifiedToken.sub);
      return {
        userID: user.id,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0]?.emailAddress ?? null,
      };
    } catch (err) {
      console.error("Auth error:", {
        error: err instanceof Error ? err.message : "Unknown error",
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 10) + "..." : "none"
      });
      throw APIError.unauthenticated("invalid token", err as Error);
    }
  }
);

export const gw = new Gateway({ authHandler: auth });
