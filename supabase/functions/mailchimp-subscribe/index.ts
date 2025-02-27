import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const MAILCHIMP_API_KEY = Deno.env.get('MAILCHIMP_API_KEY');
const MAILCHIMP_SERVER = Deno.env.get('MAILCHIMP_SERVER_PREFIX') || 'us5';
const AUDIENCE_ID = Deno.env.get('MAILCHIMP_AUDIENCE_ID') || '3b805ae71e1e5a445851b86c889f94c7';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, industry, template, deliveryTime, timezone } = await req.json();
    
    console.log('Request received:', { email, industry, template });

    if (!MAILCHIMP_API_KEY) {
      console.error('MAILCHIMP_API_KEY is not set');
      throw new Error('Mailchimp API key is not configured');
    }
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      throw new Error('OpenAI API key is not configured');
    }

    // Generate content based on industry
    const content = await generateContent(industry, template);
    
    // Add member to Mailchimp list
    const mailchimpResponse = await addToMailchimp(email, industry, template, content);
    
    // Save to Supabase for record-keeping
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supabase.from('content_history').insert({
      email: email,
      industry: industry,
      template: template,
      content: content,
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ 
      success: true, 
      mailchimp: mailchimpResponse,
      message: "Successfully subscribed to content updates"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in mailchimp-subscribe function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || "Unknown error occurred" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Generate content using OpenAI based on industry and template
async function generateContent(industry: string, template: string) {
  console.log('Generating content for:', industry, template);
  
  // Parse template to get format and style
  let format = template;
  let style = "x-style";
  if (template.includes("-style-")) {
    [format, style] = template.split("-style-");
  }
  
  const formatPrompt = getFormatPrompt(format);
  const stylePrompt = getStylePrompt(style);
  
  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional content creator specializing in ${industry} content. 
          Create three separate posts about ${industry} following the guidelines below.`
        },
        {
          role: 'user',
          content: `Generate 3 engaging posts for the ${industry} industry. 
          ${formatPrompt}
          ${stylePrompt}
          Make each post stand out with unique insights.`
        }
      ],
    }),
  });

  const data = await response.json();
  
  if (!data.choices || !data.choices[0]) {
    console.error('Unexpected OpenAI response:', data);
    throw new Error('Failed to generate content');
  }
  
  return data.choices[0].message.content;
}

// Get format-specific prompts
function getFormatPrompt(format: string) {
  switch (format) {
    case "bullet-points":
      return "Use a bullet point format with a strong headline, 4-5 bullet points, and a powerful conclusion.";
    case "numbered-list":
      return "Use a numbered list format with a compelling headline, 5 numbered points, and a summary conclusion.";
    case "tips-format":
      return "Format as a tip with a clear headline, a brief explanation, and 4-5 actionable checkpoints marked with ✓.";
    default:
      return "Use a bullet point format with a strong headline, 4-5 bullet points, and a powerful conclusion.";
  }
}

// Get style-specific prompts
function getStylePrompt(style: string) {
  switch (style) {
    case "x-style":
      return "Keep it concise, direct, and impactful - suitable for Twitter/X.com with about 280 characters.";
    case "linkedin-style":
      return "Use a professional tone with business insights. Include a personal angle and end with a question to encourage engagement. Add relevant hashtags.";
    case "thought-leadership":
      return "Take a bold, authoritative stance. Challenge conventional wisdom and position the content as expert insight.";
    case "newsletter-style":
      return "Use a conversational, personal tone as if writing directly to a friend. Include a greeting and sign-off.";
    default:
      return "Keep it concise, direct, and impactful.";
  }
}

// Add member to Mailchimp and send content
async function addToMailchimp(email: string, industry: string, template: string, content: string) {
  console.log('Adding to Mailchimp:', email);
  
  try {
    // First check if member exists
    const checkUrl = `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members/${MD5(email)}`;
    
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
        'Content-Type': 'application/json',
      }
    });
    
    const checkData = await checkResponse.json();
    const memberExists = checkResponse.status === 200;
    
    // Prepare the campaign data
    const campaignTitle = `${industry} Content Update`;
    const campaignSubject = `Your ${industry} Content for Today`;
    
    // Create a campaign first
    const campaignResponse = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'regular',
        recipients: {
          list_id: AUDIENCE_ID,
          segment_opts: {
            saved_segment_id: 0,
            match: 'all',
            conditions: [{
              field: 'EMAIL',
              op: 'is',
              value: email
            }]
          }
        },
        settings: {
          subject_line: campaignSubject,
          title: campaignTitle,
          from_name: 'Content Generator',
          reply_to: 'noreply@contentgenerator.app',
        }
      })
    });
    
    const campaignData = await campaignResponse.json();
    
    if (!campaignData.id) {
      console.error('Failed to create campaign:', campaignData);
      throw new Error('Failed to create Mailchimp campaign');
    }
    
    // Set campaign content
    const htmlContent = formatContentAsHtml(content, industry, template);
    
    const contentResponse = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${campaignData.id}/content`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent
      })
    });
    
    const contentData = await contentResponse.json();
    
    // Send the campaign
    const sendResponse = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${campaignData.id}/actions/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (sendResponse.status !== 204) {
      const sendData = await sendResponse.json();
      console.error('Failed to send campaign:', sendData);
      throw new Error('Failed to send Mailchimp campaign');
    }
    
    return { 
      success: true, 
      campaign_id: campaignData.id,
      message: `Campaign ${campaignData.id} created and sent to ${email}`
    };
  } catch (error) {
    console.error('Mailchimp API error:', error);
    
    // If we can't use Mailchimp, try to at least add the user to the list
    try {
      const fallbackResponse = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: {
            INDUSTRY: industry,
            TEMPLATE: template
          }
        })
      });
      
      const fallbackData = await fallbackResponse.json();
      return { 
        success: true, 
        fallback: true,
        message: "Added to list but content delivery failed. Will try again later."
      };
    } catch (fallbackError) {
      console.error('Fallback Mailchimp error:', fallbackError);
      throw new Error('Failed to add to Mailchimp: ' + (error.message || 'Unknown error'));
    }
  }
}

// Format content as HTML email
function formatContentAsHtml(content: string, industry: string, template: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Your ${industry} Content</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2b6fe5; }
        h2 { color: #444; margin-top: 30px; }
        ul, ol { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
        .content-block { background: #f9f9f9; border-left: 4px solid #2b6fe5; padding: 15px; margin: 25px 0; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Your ${industry} Content</h1>
      <p>Here are today's custom content pieces for your ${industry} business:</p>
      
      <div class="content-block">
        ${content.replace(/\n/g, '<br>')}
      </div>
      
      <div class="footer">
        <p>This content was generated based on your preferences.</p>
        <p>Template: ${template}</p>
        <p>Industry: ${industry}</p>
        <p>&copy; ${new Date().getFullYear()} Content Generator</p>
      </div>
    </body>
    </html>
  `;
}

// MD5 hash function for Mailchimp subscriber id
function MD5(input: string): string {
  const str = unescape(encodeURIComponent(input.toLowerCase()));
  const hexArray = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'a', 'b', 'c', 'd', 'e', 'f'
  ];

  function rotateLeft(lValue: number, iShiftBits: number): number {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }

  function addUnsigned(lX: number, lY: number): number {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    } else {
      return lResult ^ lX8 ^ lY8;
    }
  }

  function F(x: number, y: number, z: number): number { return (x & y) | ((~x) & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & (~z)); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | (~z)); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str: string): number[] {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] || 0) | (str.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }

  function wordToHex(lValue: number): string {
    let wordToHexValue = '',
        wordToHexValue_temp = '';

    for (let lCount = 0; lCount <= 3; lCount++) {
      wordToHexValue_temp = (lValue >>> (lCount * 8)) & 255
      wordToHexValue = wordToHexValue + hexArray[(wordToHexValue_temp >>> 4) & 0x0F] + hexArray[wordToHexValue_temp & 0x0F];
    }
    return wordToHexValue;
  }

  const x = convertToWordArray(str);
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a;
    const BB = b;
    const CC = c;
    const DD = d;
    a = FF(a, b, c, d, x[k + 0], 7, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], 23, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], 6, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], 15, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  return temp.toLowerCase();
}
