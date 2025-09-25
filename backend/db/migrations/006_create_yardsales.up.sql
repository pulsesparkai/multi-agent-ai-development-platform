CREATE TABLE yardsales (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Pittsburgh',
  zip_code TEXT,
  sale_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  items_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_yardsales_date ON yardsales(sale_date);
CREATE INDEX idx_yardsales_city ON yardsales(city);
CREATE INDEX idx_yardsales_zip ON yardsales(zip_code);
