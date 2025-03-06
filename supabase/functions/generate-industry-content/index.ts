
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, temperature = 0.7 } = await req.json();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content creator. Generate content for the specified industry in this format: First 3 items are daily topics, next 3 are hooks, and last 3 are tips. Each should be relevant to the industry.'
          },
          {
            role: 'user',
            content: `Generate 9 items for the ${industry} industry: 3 daily topics, 3 hooks, and 3 tips. Keep each item's title under 60 characters and description under 100 characters.`
          }
        ],
        temperature: temperature, // Use the temperature parameter
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the content into structured format
    const lines = content.split('\n').filter(line => line.trim());
    const allItems = lines.map(line => {
      const [title, ...descParts] = line.replace(/^\d+\.\s*/, '').split(':');
      return {
        title: title.trim(),
        description: descParts.join(':').trim()
      };
    });

    const result = {
      topics: allItems.slice(0, 3),
      hooks: allItems.slice(3, 6),
      tips: allItems.slice(6, 9)
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
