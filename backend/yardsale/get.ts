import { api, APIError } from "encore.dev/api";
import db from "../db";
import { YardSale } from "./types";

interface GetParams {
  id: number;
}

// Retrieves a specific yard sale by ID.
export const get = api<GetParams, YardSale>(
  { expose: true, method: "GET", path: "/yardsales/:id" },
  async (params) => {
    const row = await db.queryRow<YardSale>`
      SELECT 
        id, title, description, address, city, zip_code as "zipCode",
        sale_date as "saleDate", start_time as "startTime", end_time as "endTime",
        contact_name as "contactName", contact_phone as "contactPhone", 
        contact_email as "contactEmail", items_preview as "itemsPreview",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM yardsales 
      WHERE id = ${params.id}
    `;
    
    if (!row) {
      throw APIError.notFound("yard sale not found");
    }
    
    return row;
  }
);
