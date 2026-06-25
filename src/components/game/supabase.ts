import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hjrcpbjdemlwfwxmqjjy.supabase.co";
const supabaseKey =
  "sb_publishable_DDe4JWvi6wb3PJ64OkTqVQ_1Rby1vJM";

export const supabase = createClient(supabaseUrl, supabaseKey);
