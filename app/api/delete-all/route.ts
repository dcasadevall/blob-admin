import { list, del, BlobServiceRateLimited } from '@vercel/blob';
import { setTimeout } from 'node:timers/promises';

export const dynamic = 'force-dynamic';

async function getAllBlobUrls(): Promise<string[]> {
  const urls: string[] = [];
  let cursor: string | undefined;
  do {
    const listResult = await list({ cursor, limit: 1000 });
    listResult.blobs.forEach((blob) => urls.push(blob.url));
    cursor = listResult.cursor;
  } while (cursor);
  return urls;
}

export async function GET() {
  const urls = await getAllBlobUrls();
  const total = urls.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      for (let i = 0; i < total; i++) {
        const url = urls[i];
        let retries = 0;
        const maxRetries = 3;
        let deleted = false;

        while (retries <= maxRetries && !deleted) {
          try {
            await del(url);
            deleted = true;
            const progress = {
              file: url.split('/').pop(),
              progress: i + 1,
              total,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
            );
          } catch (error) {
            retries++;
            if (retries > maxRetries) {
              const progress = {
                file: url.split('/').pop(),
                progress: i + 1,
                total,
                error: `Failed to delete after ${maxRetries} retries.`,
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
              );
              break;
            }

            let backoffDelay = 2 ** retries * 1000;
            if (
              error instanceof BlobServiceRateLimited &&
              error.retryAfter !== undefined
            ) {
              backoffDelay = error.retryAfter * 1000;
            }

            const retryMessage = {
              file: url.split('/').pop(),
              progress: i + 1,
              total,
              retrying: true,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(retryMessage)}\n\n`),
            );

            await setTimeout(backoffDelay);
          }
        }
      }

      controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
} 