import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
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
    const { email, industry, template, deliveryTime, timezone, toneName, temperature = 0.7, sendNow } = await req.json();
    
    console.log('Request received:', { email, industry, template, toneName, temperature, sendNow });

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      throw new Error('Resend API key is not configured');
    }
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      throw new Error('OpenAI API key is not configured');
    }

    // Use the provided email directly
    const recipientEmail = email;
    console.log(`Will send email to: ${recipientEmail}`);

    // If it's a sendNow request, send the email immediately
    if (sendNow) {
      console.log('Sending email immediately to:', recipientEmail);
      
      // Generate 3 distinct content options with different angles
      const contentOptions = await Promise.all([
        generateContent(industry, "current trends", template, toneName, temperature),
        generateContent(industry, "practical tips", template, toneName, temperature + 0.1), // Slightly higher temperature for variation
        generateContent(industry, "success stories", template, toneName, temperature - 0.1)  // Slightly lower temperature for variation
      ]);
      
      console.log('Content options generated:', contentOptions.map(c => c.substring(0, 50) + '...'));
      
      // Send the email with the verified sender email and the three content options
      const htmlContent = formatContentAsHtml(contentOptions, industry, template);
      
      // Send the email via Resend
      const resend = new Resend(RESEND_API_KEY);
      const emailResponse = await resend.emails.send({
        from: 'Writer Expert <shaun@writer.expert>',
        to: [recipientEmail],
        subject: `Your ${industry} Content Update - 3 Content Options`,
        html: htmlContent,
        reply_to: "shaun@writer.expert" // Also use the verified email as reply-to
      });
      
      console.log('Email sent response:', emailResponse);
      
      // Try also sending to a test email for verification
      try {
        if (recipientEmail !== "zaydadams07@gmail.com") {
          console.log('Also sending test email to: zaydadams07@gmail.com');
          await resend.emails.send({
            from: 'Writer Expert <shaun@writer.expert>',
            to: ["zaydadams07@gmail.com"],
            subject: `[TEST] ${industry} Content for ${recipientEmail}`,
            html: htmlContent,
            reply_to: "shaun@writer.expert"
          });
        }
      } catch (testEmailError) {
        console.error('Error sending test email:', testEmailError);
      }
      
      // Save to Supabase for record-keeping
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      try {
        const { error } = await supabase.from('content_history').insert({
          email: recipientEmail,
          industry: industry,
          template: template,
          content: contentOptions[0],
          sent_at: new Date().toISOString(),
          tone_name: toneName
        });
        
        if (error) {
          console.error('Error saving to content_history:', error);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        email: emailResponse,
        message: `Email sent successfully to ${recipientEmail}`,
        emailContent: contentOptions[0].substring(0, 300) + "..." // Return a preview of content for verification
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // If it's not a sendNow request, just return success (preferences were saved in the UI code)
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Successfully saved preferences"
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

// Generate content using OpenAI based on industry, template, and specific theme
async function generateContent(industry: string, contentTheme: string, template: string, toneName = 'professional', temperature = 0.7) {
  console.log(`Generating ${contentTheme} content for: ${industry}, ${template}, tone: ${toneName}, temp: ${temperature}`);
  
  // For immediate testing, just return sample content
  if (!industry || industry.trim() === '') {
    return `This is sample content for a generic industry. Please select a specific industry for better content.`;
  }
  
  // Parse template to get format and style
  let format = template;
  let style = "x-style";
  if (template.includes("-style-")) {
    [format, style] = template.split("-style-");
  }
  
  const formatPrompt = getFormatPrompt(format);
  const stylePrompt = getStylePrompt(style);
  const tonePrompt = getTonePrompt(toneName);
  
  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using the newer model
        messages: [
          {
            role: 'system',
            content: `You are a professional content creator specializing in ${industry} content. 
            Create unique, high-quality content focusing on ${contentTheme} with a ${toneName} tone.`
          },
          {
            role: 'user',
            content: `Generate an engaging and insightful post about ${contentTheme} in the ${industry} industry. 
            ${formatPrompt}
            ${stylePrompt}
            ${tonePrompt}
            Make the content unique, practical, and specific to ${industry}. 
            Avoid generic advice - include specific strategies, tools, or approaches relevant to ${industry}.`
          }
        ],
        temperature: temperature, // Use the provided temperature for variability
      }),
    });

    const data = await response.json();
    console.log('OpenAI API response status:', response.status);
    
    if (!data.choices || !data.choices[0]) {
      console.error('Unexpected OpenAI response:', data);
      return getDefaultContent(industry, contentTheme);
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Return a default sample content for testing if OpenAI fails
    return getDefaultContent(industry, contentTheme);
  }
}

// Get default content in case of failure
function getDefaultContent(industry: string, contentTheme: string) {
  if (contentTheme === "current trends") {
    return `Current Trends in ${industry}:
    
    • AI integration is transforming how companies approach customer service
    • Remote work has created new opportunities for talent acquisition
    • Data privacy regulations are reshaping marketing strategies
    • Sustainability initiatives are becoming business necessities
    • Digital transformation continues to be the top priority for industry leaders
    
    Staying ahead of these trends will position your business for long-term success.`;
  } else if (contentTheme === "practical tips") {
    return `Practical Tips for ${industry} Success:
    
    1. Invest in employee upskilling to adapt to technological changes
    2. Implement data-driven decision making across all departments
    3. Focus on customer experience as your primary differentiator
    4. Build strategic partnerships to expand your market reach
    5. Develop a clear sustainability roadmap that aligns with business goals
    
    These actionable strategies can help you navigate the competitive landscape.`;
  } else {
    return `Success Stories in ${industry}:
    
    • Company X increased conversion rates by 45% through personalized customer journeys
    • Startup Y reduced operational costs by 30% using automation tools
    • Enterprise Z improved employee retention by implementing flexible work policies
    • Small business A expanded to international markets using digital platforms
    • Mid-size company B transformed their business model to subscription-based services
    
    These real-world examples demonstrate that innovation and adaptation are key to success.`;
  }
}

// Get format-specific prompts
function getFormatPrompt(format: string) {
  switch (format) {
    case "bullet-points":
      return "Structure the content as bullet points (•) with a strong headline, 5-7 clear bullet points, and a powerful conclusion. Each bullet point should be concise and impactful.";
    case "numbered-list":
      return "Format as a numbered list with a compelling headline, 5-7 numbered points, and a summary conclusion. Each point should be substantive and actionable.";
    case "tips-format":
      return "Structure as practical tips with a clear headline, a brief introduction, and 5-7 actionable checkpoints marked with ✓. Make each tip specific and immediately applicable.";
    default:
      return "Use bullet points or a numbered list format with a strong headline, 5-7 key points, and a powerful conclusion.";
  }
}

// Get style-specific prompts
function getStylePrompt(style: string) {
  switch (style) {
    case "x-style":
      return "Keep it concise, direct, and impactful - suitable for Twitter/X.com. Be bold and thought-provoking.";
    case "linkedin-style":
      return "Use a professional tone with business insights. Include a personal angle and end with a question to encourage engagement. Add relevant hashtags.";
    case "thought-leadership":
      return "Take a bold, authoritative stance. Challenge conventional wisdom and position the content as expert insight with forward-thinking ideas.";
    case "newsletter-style":
      return "Use a conversational, personal tone as if writing directly to a friend. Include a greeting and sign-off.";
    default:
      return "Keep it concise, direct, and impactful with clear, actionable information.";
  }
}

// Get tone-specific prompts
function getTonePrompt(tone: string) {
  switch (tone) {
    case "professional":
      return "Write in a formal, authoritative, and precise manner using industry terminology appropriately. Be clear and objective.";
    case "conversational":
      return "Write as if you're having a friendly conversation, using contractions, simple language, and occasionally asking questions. Keep it warm and approachable.";
    case "enthusiastic":
      return "Show excitement and passion about the topic. Use dynamic language, exclamation marks occasionally, and highlight the positive aspects energetically.";
    case "humorous":
      return "Incorporate appropriate humor, witty observations, and light-hearted analogies. Keep it professional but entertaining.";
    default:
      // For custom tones or unspecified tones
      return "Write in a clear, engaging style that balances professionalism with approachability.";
  }
}

// Format content as HTML email with modern design and multiple content options
function formatContentAsHtml(contentOptions: string[], industry: string, template: string) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Process each content option to ensure proper formatting
  const formattedContentOptions = contentOptions.map(content => {
    // Function to convert content to appropriate HTML based on template format
    let format = "bullet-points";
    if (template.includes("-style-")) {
      [format] = template.split("-style-");
    }
    
    // Format content based on type
    if (format === "bullet-points" && !content.includes("<ul>")) {
      // Convert plain text bullet points to HTML list if needed
      const lines = content.split('\n').filter(line => line.trim());
      const bulletItems = lines.filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'));
      
      if (bulletItems.length > 0) {
        return {
          title: lines[0].replace(/^[#\s]+/, ''), // First line as title, remove any markdown headers
          content: `<ul>${bulletItems.map(item => `<li>${item.replace(/^[•\-*\s]+/, '')}</li>`).join('')}</ul>`,
          rawContent: content
        };
      }
    } else if (format === "numbered-list" && !content.includes("<ol>")) {
      // Convert plain text numbered list to HTML ordered list if needed
      const lines = content.split('\n').filter(line => line.trim());
      const numberedItems = lines.filter(line => /^\d+\./.test(line.trim()));
      
      if (numberedItems.length > 0) {
        return {
          title: lines[0].replace(/^[#\s]+/, ''),
          content: `<ol>${numberedItems.map(item => `<li>${item.replace(/^\d+\.\s*/, '')}</li>`).join('')}</ol>`,
          rawContent: content
        };
      }
    }
    
    // Default handling if no specific formatting detected
    const lines = content.split('\n').filter(line => line.trim());
    return {
      title: lines[0].replace(/^[#\s]+/, ''),
      content: content.replace(/\n/g, '<br>'),
      rawContent: content
    };
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${industry} Industry Update</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f9f9f9;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(0,0,0,0.05);
        }
        .header {
          background-color: #2c3e50;
          color: #ffffff;
          padding: 20px;
          text-align: center;
        }
        .date {
          color: #ecf0f1;
          font-size: 14px;
          margin-top: 5px;
        }
        .content {
          padding: 25px;
        }
        .option {
          margin-bottom: 30px;
          border-bottom: 1px solid #eee;
          padding-bottom: 25px;
        }
        .option:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        h1 {
          color: #ffffff;
          font-size: 24px;
          margin: 0;
          font-weight: 600;
        }
        h2 {
          color: #2c3e50;
          font-size: 20px;
          margin-top: 0;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .option-label {
          display: inline-block;
          background-color: #3498db;
          color: white;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        p {
          margin: 0 0 15px;
          font-size: 16px;
        }
        ul, ol {
          margin-left: 0;
          padding-left: 20px;
          margin-bottom: 15px;
        }
        li {
          margin-bottom: 10px;
        }
        .footer {
          background-color: #f5f5f5;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #7f8c8d;
          border-top: 1px solid #eee;
        }
        .footer p {
          margin: 5px 0;
          font-size: 12px;
        }
        .cta-button {
          display: inline-block;
          background-color: #2980b9;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: 500;
          margin-top: 10px;
          margin-bottom: 5px;
        }
        .cta-button:hover {
          background-color: #3498db;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100%;
            border-radius: 0;
          }
          .content {
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>${industry} Industry Update</h1>
          <div class="date">${formattedDate}</div>
        </div>
        
        <div class="content">
          <p>Here are three content options for your ${industry} business. Each takes a different approach:</p>
          
          ${formattedContentOptions.map((content, index) => {
            const optionLabels = ["Trends & Insights", "Practical Strategy", "Success Patterns"];
            
            return `
              <div class="option">
                <div class="option-label">Option ${index + 1}: ${optionLabels[index]}</div>
                <h2>${content.title}</h2>
                <div>${content.content}</div>
                
                <a href="#" class="cta-button">Use This Content</a>
              </div>
            `;
          }).join('')}
          
          <p>These insights are generated based on current industry trends and tailored to your preferences.</p>
        </div>
        
        <div class="footer">
          <p>You're receiving this because you subscribed to ${industry} industry updates.</p>
          <p>© ${new Date().getFullYear()} Writer Expert | <a href="#">Unsubscribe</a> | <a href="#">View in Browser</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
