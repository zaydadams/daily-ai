
interface WordPressPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

const industryKeywords = {
  technology: ['tech', 'software', 'digital', 'online', 'web', 'app', 'computer', 'it', 'technology', 'startup', 'saas', 'platform'],
  healthcare: ['health', 'medical', 'patient', 'doctor', 'hospital', 'wellness', 'care', 'clinic', 'therapy', 'treatment'],
  finance: ['finance', 'bank', 'money', 'investment', 'trading', 'financial', 'business', 'market', 'stock', 'wealth'],
  education: ['education', 'school', 'learning', 'student', 'teach', 'course', 'training', 'academic', 'study', 'college'],
  retail: ['retail', 'shop', 'store', 'customer', 'product', 'sale', 'ecommerce', 'marketing', 'brand', 'consumer'],
  manufacturing: ['manufacturing', 'factory', 'production', 'industrial', 'supply', 'chain', 'quality', 'process', 'operation']
};

const matchPostToIndustry = (post: WordPressPost, industry: string): boolean => {
  const keywords = industryKeywords[industry as keyof typeof industryKeywords] || [];
  const postContent = (
    post.title.rendered.toLowerCase() + 
    ' ' + 
    post.excerpt.rendered.toLowerCase() + 
    ' ' + 
    post.content.rendered.toLowerCase()
  );
  
  return keywords.some(keyword => postContent.includes(keyword));
};

export const fetchWordPressPosts = async (selectedIndustry: string) => {
  try {
    // Fetch more posts initially to ensure we have enough after filtering
    const response = await fetch('https://writer.expert/wp-json/wp/v2/posts?per_page=30');
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    
    const posts: WordPressPost[] = await response.json();
    
    // Filter posts by industry
    const industryPosts = posts.filter(post => matchPostToIndustry(post, selectedIndustry));
    
    // If we don't have enough industry-specific posts, fill with general posts
    const finalPosts = industryPosts.length >= 9 
      ? industryPosts.slice(0, 9) 
      : [...industryPosts, ...posts.filter(post => !matchPostToIndustry(post, selectedIndustry))].slice(0, 9);

    return finalPosts;
  } catch (error) {
    console.error('Error fetching WordPress posts:', error);
    throw error;
  }
};
