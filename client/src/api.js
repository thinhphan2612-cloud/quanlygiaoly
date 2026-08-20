// Tầng dữ liệu: dùng Supabase (multi-tenant). Giữ interface get/post/put/delete
// theo path để các trang không phải sửa nhiều.
import supabaseApi from './supabaseApi';

export default supabaseApi;
