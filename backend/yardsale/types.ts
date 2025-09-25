export interface YardSale {
  id: number;
  title: string;
  description?: string;
  address: string;
  city: string;
  zipCode?: string;
  saleDate: Date;
  startTime?: string;
  endTime?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  itemsPreview?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateYardSaleRequest {
  title: string;
  description?: string;
  address: string;
  city?: string;
  zipCode?: string;
  saleDate: Date;
  startTime?: string;
  endTime?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  itemsPreview?: string;
}

export interface ListYardSalesRequest {
  limit?: number;
  offset?: number;
  search?: string;
  zipCode?: string;
  upcoming?: boolean;
}

export interface ListYardSalesResponse {
  yardsales: YardSale[];
  total: number;
}
