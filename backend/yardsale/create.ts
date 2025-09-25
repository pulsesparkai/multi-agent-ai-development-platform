import { api } from "encore.dev/api";
import db from "../db";
import { CreateYardSaleRequest, YardSale } from "./types";

// Creates a new yard sale listing.
export const create = api<CreateYardSaleRequest, YardSale>(
  { expose: true, method: "POST", path: "/yardsales" },
  async (req) => {
    const row = await db.queryRow<YardSale>`
      INSERT INTO yardsales (
        title, description, address, city, zip_code,
        sale_date, start_time, end_time, contact_name,
        contact_phone, contact_email, items_preview, updated_at
      ) VALUES (
        ${req.title}, ${req.description}, ${req.address}, 
        ${req.city || 'Pittsburgh'}, ${req.zipCode},
        ${req.saleDate}, ${req.startTime}, ${req.endTime}, ${req.contactName},
        ${req.contactPhone}, ${req.contactEmail}, ${req.itemsPreview}, NOW()
      )
      RETURNING 
        id, title, description, address, city, zip_code as "zipCode",
        sale_date as "saleDate", start_time as "startTime", end_time as "endTime",
        contact_name as "contactName", contact_phone as "contactPhone", 
        contact_email as "contactEmail", items_preview as "itemsPreview",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
    
    return row!;
  }
);
