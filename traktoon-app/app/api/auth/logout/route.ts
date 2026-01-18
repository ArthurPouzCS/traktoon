import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[Auth] Logout error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Déconnexion réussie',
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}
