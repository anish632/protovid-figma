import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { frames, settings, isPremium } = await request.json();

    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
    }

    // Free tier restrictions (server-side enforcement)
    if (!isPremium) {
      if (settings.resolution !== '720p') {
        return NextResponse.json({ error: 'HD/4K requires Premium' }, { status: 403 });
      }
      if (settings.format === 'gif') {
        return NextResponse.json({ error: 'GIF export requires Premium' }, { status: 403 });
      }
    }

    // For MVP: Use client-side Canvas API approach instead of server-side FFmpeg.
    // The plugin will capture frames and we return a "ready" signal.
    // Phase 2 will add actual server-side FFmpeg encoding.
    //
    // Why: Vercel serverless has a 10s/50MB limit on Hobby.
    // Video encoding needs either:
    // - A long-running server (your OCI instance when it lands)
    // - Or client-side WebCodecs/Canvas approach
    
    return NextResponse.json({
      success: true,
      method: 'client-side',
      message: 'Use client-side encoding. Server encoding available on Pro plan.',
      frameCount: frames.length,
      settings,
    });
  } catch (error) {
    console.error('Encode video error:', error);
    return NextResponse.json(
      { error: 'Video encoding failed' },
      { status: 500 }
    );
  }
}
