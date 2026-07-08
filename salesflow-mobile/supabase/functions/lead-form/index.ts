import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get('id');

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Missing project ID' }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  if (req.method === 'GET') {
    try {
      const { data: project } = await supabase
        .from('lead_projects')
        .select('project_name, custom_fields, purpose_options')
        .eq('id', projectId)
        .single();
        
      return new Response(JSON.stringify({ 
        projectName: project?.project_name || 'Project Lead Form',
        customFields: project?.custom_fields || [],
        purposeOptions: project?.purpose_options || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { name, phone, purpose, custom_responses } = body;

      if (!name || !phone) {
        return new Response(JSON.stringify({ error: 'Name and Phone are required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { error } = await supabase
        .from('lead_applicants')
        .insert([{ 
          project_id: projectId, 
          name, 
          phone, 
          purpose,
          custom_responses: custom_responses || {}
        }]);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
