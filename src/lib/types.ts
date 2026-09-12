export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number;
  stock: number | null;
  video_url: string | null;
  preview_link: string | null;
  theme: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: ProductCategory;
  product_images?: ProductImage[];
}

export interface Order {
  id: string;
  product_id: string | null;
  product_name: string;
  product_price: number;
  cost_price: number;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  groom_name: string | null;
  bride_name: string | null;
  groom_parents: string | null;
  bride_parents: string | null;
  akad_venue: string | null;
  akad_date: string | null;
  akad_time: string | null;
  reception_venue: string | null;
  reception_date: string | null;
  reception_time: string | null;
  notes: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  message: string;
  rating: number;
  photo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface StoreSettings {
  id: string;
  whatsapp_number: string;
  email: string | null;
  address: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  about_text: string | null;
  updated_at: string;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
}
