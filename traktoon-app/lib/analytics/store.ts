/**
 * Analytics Store
 * Persists tracked posts and metrics to a JSON file
 * 
 * Note: For production, replace with a proper database
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { TrackedPost, Channel, MetricsSnapshot, PlatformMetrics } from './types';

// ============================================================
// CONFIGURATION
// ============================================================

const DATA_DIR = join(process.cwd(), 'data');
const POSTS_FILE = join(DATA_DIR, 'tracked-posts.json');

// ============================================================
// INTERNAL STORAGE
// ============================================================

interface StoreData {
  posts: TrackedPost[];
  lastUpdated: string;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load data from file
 */
function loadData(): StoreData {
  ensureDataDir();
  
  if (!existsSync(POSTS_FILE)) {
    return { posts: [], lastUpdated: new Date().toISOString() };
  }
  
  try {
    const raw = readFileSync(POSTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.error('[Store] Failed to load data, starting fresh');
    return { posts: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Save data to file
 */
function saveData(data: StoreData): void {
  ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a new tracked post
 */
export function addPost(post: Omit<TrackedPost, 'id'>): TrackedPost {
  const data = loadData();
  
  const newPost: TrackedPost = {
    ...post,
    id: generateId(),
  };
  
  data.posts.push(newPost);
  saveData(data);
  
  console.log('[Store] Added post:', newPost.id, '-', newPost.channel);
  return newPost;
}

/**
 * Get a post by ID
 */
export function getPost(id: string): TrackedPost | undefined {
  const data = loadData();
  return data.posts.find(p => p.id === id);
}

/**
 * Get a post by platform ID (e.g., tweet ID)
 */
export function getPostByPlatformId(platformPostId: string): TrackedPost | undefined {
  const data = loadData();
  return data.posts.find(p => p.platformPostId === platformPostId);
}

/**
 * Get all posts
 */
export function getAllPosts(): TrackedPost[] {
  const data = loadData();
  return data.posts;
}

/**
 * Get posts by channel
 */
export function getPostsByChannel(channel: Channel): TrackedPost[] {
  const data = loadData();
  return data.posts.filter(p => p.channel === channel);
}

/**
 * Get posts by campaign
 */
export function getPostsByCampaign(campaign: string): TrackedPost[] {
  const data = loadData();
  return data.posts.filter(p => p.campaign === campaign);
}

/**
 * Update a post's metrics
 */
export function updatePostMetrics(
  id: string,
  metrics: PlatformMetrics,
  addToHistory: boolean = true
): TrackedPost | undefined {
  const data = loadData();
  const index = data.posts.findIndex(p => p.id === id);
  
  if (index === -1) {
    console.error('[Store] Post not found:', id);
    return undefined;
  }
  
  const post = data.posts[index];
  
  // Update current metrics
  post.metrics = metrics;
  post.lastFetchedAt = new Date().toISOString();
  post.status = 'analyzed';
  
  // Calculate performance metrics
  if (metrics.impressions > 0) {
    post.performance = {
      engagementRate: (metrics.engagements / metrics.impressions) * 100,
      clickThroughRate: (metrics.clicks / metrics.impressions) * 100,
      viralityScore: (metrics.shares / metrics.impressions) * 100,
      interactionRate: (metrics.comments / metrics.impressions) * 100,
    };
  }
  
  // Add to history if requested
  if (addToHistory) {
    const snapshot: MetricsSnapshot = {
      timestamp: new Date().toISOString(),
      metrics,
    };
    
    if (!post.metricsHistory) {
      post.metricsHistory = [];
    }
    post.metricsHistory.push(snapshot);
  }
  
  data.posts[index] = post;
  saveData(data);
  
  console.log('[Store] Updated metrics for post:', id);
  return post;
}

/**
 * Update post status
 */
export function updatePostStatus(id: string, status: TrackedPost['status']): void {
  const data = loadData();
  const index = data.posts.findIndex(p => p.id === id);
  
  if (index !== -1) {
    data.posts[index].status = status;
    saveData(data);
  }
}

/**
 * Delete a post
 */
export function deletePost(id: string): boolean {
  const data = loadData();
  const initialLength = data.posts.length;
  data.posts = data.posts.filter(p => p.id !== id);
  
  if (data.posts.length < initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

/**
 * Clear all posts (for testing)
 */
export function clearAll(): void {
  saveData({ posts: [], lastUpdated: new Date().toISOString() });
}

/**
 * Get store statistics
 */
export function getStats() {
  const data = loadData();
  const posts = data.posts;
  
  const byChannel = posts.reduce((acc, post) => {
    acc[post.channel] = (acc[post.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const analyzed = posts.filter(p => p.status === 'analyzed').length;
  
  return {
    totalPosts: posts.length,
    byChannel,
    analyzed,
    pending: posts.length - analyzed,
    lastUpdated: data.lastUpdated,
  };
}

