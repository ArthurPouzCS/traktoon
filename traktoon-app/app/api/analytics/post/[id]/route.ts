import { NextResponse } from 'next/server';
import {
  getPost,
  fetchAndUpdateMetrics,
  analyzePost,
  getPostVerdict,
  deletePost,
} from '@/lib/analytics';

/**
 * GET /api/analytics/post/[id]
 * 
 * Get detailed analytics for a specific post
 * Query params:
 *   - refresh: 'true' to fetch fresh metrics
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if we should refresh metrics
    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get('refresh') === 'true';
    
    let post = getPost(id);
    
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }
    
    if (shouldRefresh) {
      post = await fetchAndUpdateMetrics(id) || post;
    }
    
    const comparison = analyzePost(id);
    const verdict = getPostVerdict(id);
    
    return NextResponse.json({
      success: true,
      data: {
        post,
        comparison,
        verdict,
      },
    });
    
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch post analytics' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analytics/post/[id]
 * 
 * Remove a post from tracking
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const deleted = deletePost(id);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Post removed from tracking',
    });
    
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

