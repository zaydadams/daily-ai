
interface WordPressPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

export const fetchWordPressPosts = async () => {
  try {
    const response = await fetch('https://writer.expert/wp-json/wp/v2/posts?per_page=9');
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    const posts: WordPressPost[] = await response.json();
    return posts;
  } catch (error) {
    console.error('Error fetching WordPress posts:', error);
    throw error;
  }
};
