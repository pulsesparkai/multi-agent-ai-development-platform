import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import { ListYardSalesRequest, ListYardSalesResponse, YardSale } from "./types";

interface ListParams {
  limit?: Query<number>;
  offset?: Query<number>;
  search?: Query<string>;
  zipCode?: Query<string>;
  upcoming?: Query<boolean>;
}

// Retrieves yard sale listings with optional filtering.
export const list = api<ListParams, ListYardSalesResponse>(
  { expose: true, method: "GET", path: "/yardsales" },
  async (params) => {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    let whereClause = "WHERE 1=1";
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (params.upcoming) {
      whereClause += ` AND sale_date >= CURRENT_DATE`;
    }
    
    if (params.search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR items_preview ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }
    
    if (params.zipCode) {
      whereClause += ` AND zip_code = $${paramIndex}`;
      queryParams.push(params.zipCode);
      paramIndex++;
    }
    
    const countQuery = `SELECT COUNT(*) as count FROM yardsales ${whereClause}`;
    const countResult = await db.rawQueryRow<{count: number}>(countQuery, ...queryParams);
    const total = countResult?.count || 0;
    
    const dataQuery = `
      SELECT 
        id, title, description, address, city, zip_code as "zipCode",
        sale_date as "saleDate", start_time as "startTime", end_time as "endTime",
        contact_name as "contactName", contact_phone as "contactPhone", 
        contact_email as "contactEmail", items_preview as "itemsPreview",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM yardsales 
      ${whereClause}
      ORDER BY sale_date ASC, start_time ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const yardsales = await db.rawQueryAll<YardSale>(
      dataQuery, 
      ...queryParams, 
      limit, 
      offset
    );
    
    return { yardsales, total };
  }
);
