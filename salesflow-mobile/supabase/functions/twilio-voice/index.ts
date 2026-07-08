import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import twilio from 'npm:twilio@^4.8.0'

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWILIO_TWIML_APP_SID,
  TWILIO_AUTH_TOKEN,
} = Deno.env.toObject()

serve(async (req) => {
  const { pathname } = new URL(req.url)

  // 1. ACCESS TOKEN GENERATION
  if (pathname === '/get-twilio-token') {
    const { identity } = await req.json()
    
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    })

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    )
    token.addGrant(voiceGrant)

    return new Response(JSON.stringify({ token: token.toJwt() }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. TWIML VOICE RESPONSE (CALLED BY TWILIO)
  if (pathname === '/voice-response') {
    const formData = await req.formData()
    const To = formData.get('To')

    const response = new twilio.twiml.VoiceResponse()
    
    // START AUTOMATIC RECORDING
    const dial = response.dial({
      record: 'record-from-answer',
      recordingStatusCallback: '/recording-status', // Optional endpoint to update DB
    })

    if (To) {
      dial.number(To)
    } else {
      response.say('Invalid number provided.')
    }

    return new Response(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  return new Response('Not Found', { status: 404 })
})
