import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface UserInfo {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string;
}

// Get current user information
export const me = api<void, UserInfo>(
  { auth: true, expose: true, method: "GET", path: "/user/me" },
  async () => {
    const auth = getAuthData()!;
    
    // Ensure user exists in database
    await db.exec`
      INSERT INTO users (id, email, name, image_url)
      VALUES (${auth.userID}, ${auth.email}, ${auth.email}, ${auth.imageUrl})
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `;

    return {
      id: auth.userID,
      email: auth.email,
      name: auth.email,
      imageUrl: auth.imageUrl,
    };
  }
);
