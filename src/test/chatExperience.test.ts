import { buildChatMessagePermalink, chatMessagePreview, countUnreadChatChannels, messageMentionsDisplayName } from '@/lib/chatExperience';
import { buildPickemShareMessage, getPickemShareTarget, isPickemShareMessage } from '@/lib/pickemShare';

describe('chat experience helpers', () => {
  it('matches complete display-name mentions case-insensitively', () => {
    expect(messageMentionsDisplayName('Hey @Alex Smith, take a look', 'Alex Smith')).toBe(true);
    expect(messageMentionsDisplayName('hey @alex smith!', 'Alex Smith')).toBe(true);
    expect(messageMentionsDisplayName('Hey @Alex Smithers', 'Alex Smith')).toBe(false);
    expect(messageMentionsDisplayName('No mention here', 'Alex Smith')).toBe(false);
  });

  it('turns attachment-only messages into a useful preview', () => {
    expect(chatMessagePreview('lovable-private://chat-attachments-private/user/file.pdf#n=notes.pdf')).toBe('Attachment');
    expect(chatMessagePreview('**Launch update**\nhttps://example.com')).toBe('Launch update https://example.com');
  });

  it('builds a stable deep link for a message', () => {
    expect(buildChatMessagePermalink('https://dh.example', 'channel-1', 'message-2'))
      .toBe('https://dh.example/chat?channel=channel-1&message=message-2');
  });

  it('counts unread chat channels only when another member sent the unread message', () => {
    const reads = new Map([['read-channel', '2026-09-23T02:30:00.000Z']]);
    expect(countUnreadChatChannels([
      { channel_id: 'own-only', user_id: 'me', created_at: '2026-09-23T03:00:00.000Z' },
      { channel_id: 'unread-channel', user_id: 'other', created_at: '2026-09-23T02:50:00.000Z' },
      { channel_id: 'unread-channel', user_id: 'other-2', created_at: '2026-09-23T02:40:00.000Z' },
      { channel_id: 'read-channel', user_id: 'other', created_at: '2026-09-23T02:00:00.000Z' },
    ], reads, 'me')).toBe(1);
  });

  it('keeps an older unread message from someone else visible after the user replies', () => {
    expect(countUnreadChatChannels([
      { channel_id: 'general', user_id: 'me', created_at: '2026-09-23T03:00:00.000Z' },
      { channel_id: 'general', user_id: 'other', created_at: '2026-09-23T02:59:00.000Z' },
    ], new Map(), 'me')).toBe(1);
  });

  it('builds and validates a weekly Pick’em share without trusting card text', () => {
    const weekId = '123e4567-e89b-42d3-a456-426614174000';
    const content = buildPickemShareMessage({
      origin: 'https://dryhorse.app',
      weekId,
      weekNumber: 3,
      weekLabel: 'Week 3',
      pickedCount: 16,
      totalGames: 16,
    });
    expect(isPickemShareMessage(content)).toBe(true);
    expect(getPickemShareTarget(content.match(/https?:\/\/[^\s]+/)?.[0] ?? '')).toEqual({ weekId, weekNumber: 3 });
    expect(getPickemShareTarget('https://dryhorse.app/pickem/week/3?weekId=not-a-real-id')).toBeNull();
  });
});
