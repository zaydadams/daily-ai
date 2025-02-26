
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
    const { industry } = await req.json();

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
            content: 'You are a content strategy expert. For each section (topics, hooks, tips), generate exactly 3 items. Each item should have a clear heading and a description of how to use that heading effectively.'
          },
          {
            role: 'user',
            content: `Generate 9 content items for the ${industry} industry, organized as follows:
            
3 DAILY TOPICS: Generate 3 topic headings with descriptions showing how to use each topic effectively.
Example format:
Title: "Share a personal milestone"
Description: "Celebrate and invite others to join in your success"

3 DAILY HOOKS: Generate 3 hook headings with descriptions showing how to use each hook effectively.
Example format:
Title: "The minimalist approach to productivity"
Description: "Present a streamlined method that simplifies complex processes"

3 DAILY TIPS: Generate 3 tip headings with descriptions showing how to use each tip effectively.
Example format:
Title: "Use storytelling techniques"
Description: "Engage your audience with a beginning, middle, and end"

Make sure each section has exactly 3 items, each with a clear heading and practical description of how to use it.`
          }
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the content into structured format
    const sections = content.split(/3 DAILY (?:TOPICS|HOOKS|TIPS):/i);
    const parsedSections = sections.slice(1).map(section => {
      const items = section.trim().split('\n').filter(line => line.trim());
      return items.map(item => {
        const [title, description] = item.split(/Description:|→/).map(s => s.trim());
        return {
          title: title.replace(/^Title:\s*/, '').trim(),
          description: description ? description : 'How to effectively use this in your content'
        };
      });
    });

    const result = {
      topics: parsedSections[0]?.slice(0, 3) || [],
      hooks: parsedSections[1]?.slice(0, 3) || [],
      tips: parsedSections[2]?.slice(0, 3) || [],
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
