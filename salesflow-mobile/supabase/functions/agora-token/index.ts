import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-access-token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { channelName, uid, clientPhone } = await req.json();

    const appId = Deno.env.get("agora_app_id") || Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("agora_app_certificate") || Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: "Missing Agora credentials (App ID or Certificate)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid || 0,
      role,
      privilegeExpiredTs
    );

    // Agora Cloud Recording Flow (Acquire + Start)
    let recordingResourceId = null;
    let recordingSid = null;

    try {
      const restKey = Deno.env.get("agora_rest_key") || Deno.env.get("AGORA_REST_KEY");
      const restSecret = Deno.env.get("agora_rest_secret") || Deno.env.get("AGORA_REST_SECRET");
      const s3Bucket = Deno.env.get("s3_bucket") || Deno.env.get("S3_BUCKET");
      const s3AccessKey = Deno.env.get("s3_access_key") || Deno.env.get("S3_ACCESS_KEY");
      const s3SecretKey = Deno.env.get("s3_secret_key") || Deno.env.get("S3_SECRET_KEY");
      const s3RegionStr = Deno.env.get("s3_region") || Deno.env.get("S3_REGION") || "1";

      if (restKey && restSecret && s3Bucket) {
        const auth = btoa(`${restKey}:${restSecret}`);
        const s3Endpoint = Deno.env.get("s3_endpoint") || Deno.env.get("S3_ENDPOINT");
        
        // 1. Acquire Resource ID
        const acquireResponse = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`,
          },
          body: JSON.stringify({
            cname: channelName,
            uid: "999", // Recorder UID
            clientRequest: { resourceExpiredHour: 24 },
          }),
        });
        const acquireData = await acquireResponse.json();
        recordingResourceId = acquireData.resourceId;

        if (recordingResourceId) {
          // 2. Start Recording
          const startResponse = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${recordingResourceId}/mode/mix/start`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${auth}`,
            },
            body: JSON.stringify({
              cname: channelName,
              uid: "999", // Recorder UID
              clientRequest: {
                token: RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, 999, role, privilegeExpiredTs),
                recordingConfig: {
                  maxIdleTime: 30,
                  streamTypes: 0, // Audio only
                  audioProfile: 1,
                  subscribeUidGroup: 0,
                },
                storageConfig: {
                  vendor: 11, // S3-compatible (Supabase)
                  region: 0,
                  bucket: s3Bucket,
                  accessKey: s3AccessKey,
                  secretKey: s3SecretKey,
                  fileNamePrefix: [`calls`, `${channelName}`],
                  extensionParams: {
                    endpoint: s3Endpoint || "https://korgtxyzpznaondfiytk.supabase.co/storage/v1/s3",
                  }
                },
              },
            }),
          });
          const startData = await startResponse.json();
          recordingSid = startData.sid;
        }
      }
    } catch (e) {
      console.error("[AgoraRecording] Error starting recording:", e);
    }
    
    return new Response(
      JSON.stringify({
        appId,
        token,
        channelName,
        uid: uid || 0,
        recordingSid,
        recordingResourceId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
