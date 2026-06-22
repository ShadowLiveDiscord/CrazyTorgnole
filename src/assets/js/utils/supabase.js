const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://hqdflmckfagugvivgxec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FQWlSg5iLI50mz9OVQxyFg_4l-lqIih";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
