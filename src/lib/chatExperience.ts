import { isPrivateAttachmentUrl } from '@/lib/chatAttachments';

const URL_RE = /(?:https?|lovable-private):\/\/[^\s<]+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match an @mention as a complete display name. The right-hand boundary keeps
 * a member named "Ann" from matching "@Anna" while still allowing punctuation
 * immediately after a mention.
 */
export function messageMentionsDisplayName(content: string, displayName?: string | null): boolean {
  const name = displayName?.trim();
  if (!name) return false;
  return new RegExp(`@${escapeRegExp(name)}(?=$|[\\s.,!?;:()\\[\\]{}])`, 'i').test(content);
}

/** Human-readable one-line copy for channel previews and search results. */
export function chatMessagePreview(content: string, maxLength = 140): string {
  let hadAttachment = false;
  const text = content
    .replace(URL_RE, (url) => {
      if (isPrivateAttachmentUrl(url) || /\.(?:jpe?g|png|gif|webp|avif|heic|heif)(?:\?.*)?$/i.test(url)) {
        hadAttachment = true;
        return '';
      }
      return url;
    })
    .replace(/```[a-zA-Z0-9_-]*\r?\n?/g, '')
    .replace(/```/g, '')
    .replace(/[*_~`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fallback = hadAttachment ? 'Attachment' : 'Message';
  const value = text || fallback;
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : value;
}

export function buildChatMessagePermalink(origin: string, channelId: string, messageId: string): string {
  const url = new URL('/chat', origin);
  url.searchParams.set('channel', channelId);
  url.searchParams.set('message', messageId);
  return url.toString();
}
