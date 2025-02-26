
import { supabase } from "@/lib/supabase";

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

const cleanContent = (content: GeneratedContent): GeneratedContent => {
  const cleanItem = (item: ContentItem): ContentItem => ({
    title: item.title
      .replace(/^###\s+/, '') // Remove markdown headers
      .replace(/^\*\*|\*\*$/g, '') // Remove markdown bold
      .trim(),
    description: item.description
      .replace(/^→\s*/, '') // Remove arrow if it exists
      .trim()
  });

  const ensureThreeItems = (items: ContentItem[]): ContentItem[] => {
    const cleanedItems = items
      .map(cleanItem)
      .filter(item => 
        item.title && 
        !item.title.includes('Daily Topics') && 
        !item.title.includes('Hooks') && 
        !item.title.includes('Tips')
      );

    // If we have less than 3 items, add placeholder items
    while (cleanedItems.length < 3) {
      cleanedItems.push({
        title: `Example heading ${cleanedItems.length + 1}`,
        description: `How to effectively use this heading in your content`
      });
    }

    // Return exactly 3 items
    return cleanedItems.slice(0, 3);
  };

  return {
    topics: ensureThreeItems(content.topics),
    hooks: ensureThreeItems(content.hooks),
    tips: ensureThreeItems(content.tips),
  };
};

export const fetchWordPressPosts = async (industry: string): Promise<GeneratedContent> => {
  try {
    console.log('Fetching WordPress posts for industry:', industry);
    
    // First try WordPress
    const response = await fetch('https://writer.expert/wp-json/wp/v2/posts?per_page=30');
    if (!response.ok) {
      console.error('WordPress API response not OK:', response.status);
      throw new Error('Failed to fetch posts');
    }
    
    const posts: WordPressPost[] = await response.json();
    console.log('Total WordPress posts fetched:', posts.length);
    
    const industryPosts = posts.filter(post => {
      const matchTitle = post.title.rendered.toLowerCase().includes(industry.toLowerCase());
      const matchContent = post.content.rendered.toLowerCase().includes(industry.toLowerCase());
      const matchExcerpt = post.excerpt.rendered.toLowerCase().includes(industry.toLowerCase());
      return matchTitle || matchContent || matchExcerpt;
    });
    
    console.log('Filtered posts for industry:', industryPosts.length);
    
    if (industryPosts.length >= 9) {
      console.log('Using WordPress content - found enough posts');
      const content = {
        topics: industryPosts.slice(0, 3).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, '').replace(/&amp;/g, '&'),
          description: `→ ${post.excerpt.rendered.replace(/<\/?[^>]+(>|$)/g, '').slice(0, 100)}...`
        })),
        hooks: industryPosts.slice(3, 6).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, '').replace(/&amp;/g, '&'),
          description: `→ ${post.excerpt.rendered.replace(/<\/?[^>]+(>|$)/g, '').slice(0, 100)}...`
        })),
        tips: industryPosts.slice(6, 9).map(post => ({
          title: post.title.rendered.replace(/^&#8211;\s*/, '').replace(/&amp;/g, '&'),
          description: `→ ${post.excerpt.rendered.replace(/<\/?[^>]+(>|$)/g, '').slice(0, 100)}...`
        }))
      };
      return content;
    }

    console.log('Not enough WordPress posts found, falling back to AI generation');
    // Fallback to OpenAI
    const { data, error } = await supabase.functions.invoke('generate-industry-content', {
      body: { industry }
    });

    if (error) {
      console.error('Error invoking AI function:', error);
      throw error;
    }

    // Clean the AI-generated content before returning
    return cleanContent(data as GeneratedContent);
  } catch (error) {
    console.error('Error fetching content:', error);
    throw error;
  }
};
