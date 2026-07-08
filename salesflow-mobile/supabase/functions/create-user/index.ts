import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Get the request body
    const { email, password, username, role } = await req.json();

    if (!email || !password || !username) {
      throw new Error("Missing required fields: email, password, username");
    }

    // 2. CHECK IF REQUESTER IS ADMIN
    // We get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized: Invalid token");
    }

    // Check role in profiles
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "Admin") {
      throw new Error("Unauthorized: Only Admins can create users");
    }

    // 3. CREATE THE USER IN AUTH
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createError) throw createError;

    // 4. UPDATE THE PROFILE ROLE
    // (The trigger handles creation, we just need to update the role if it's different from default)
    if (role && role === "Admin") {
      const { error: roleError } = await supabaseClient
        .from("profiles")
        .update({ role: "Admin" })
        .eq("id", newUser.user.id);
      
      if (roleError) throw roleError;
    }

    return new Response(JSON.stringify({ message: "User created successfully", user: newUser.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
