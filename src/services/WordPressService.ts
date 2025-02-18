
import { createClient } from '@supabase/supabase-js';

interface WordPressPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

interface ContentItem {
  title: string;
  description: string;
}

interface GeneratedContent {
  topics: ContentItem[];
  hooks: ContentItem[];
  tips: ContentItem[];
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export const fetchWordPressPosts = async (industry: string): Promise<GeneratedContent> => {
  try {
    // First try WordPress
    const response = await fetch('https://writer.expert/wp-json/wp/v2/posts?per_page=30');
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    
    const posts: WordPressPost[] = await response.json();
    const industryPosts = posts.filter(post => 
      post.title.rendered.toLowerCase().includes(industry.toLowerCase()) ||
      post.content.rendered.toLowerCase().includes(industry.toLowerCase()) ||
      post.excerpt.rendered.toLowerCase().includes(industry.toLowerCase())
    );
    
    if (industryPosts.length >= 9) {
      return {
        topics: industryPosts.slice(0, 3).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, ''),
          description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
        })),
        hooks: industryPosts.slice(3, 6).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, ''),
          description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
        })),
        tips: industryPosts.slice(6, 9).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, ''),
          description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
        }))
      };
    }

    // Fallback to OpenAI
    const { data } = await supabase.functions.invoke('generate-industry-content', {
      body: { industry }
    });

    return data as GeneratedContent;
  } catch (error) {
    console.error('Error fetching content:', error);
    throw error;
  }
};
