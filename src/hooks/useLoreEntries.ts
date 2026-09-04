import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { memberData } from '@/lib/memberData';

export type LoreEntry = {
  id: string;
  created_by: string;
  type: string;
  title: string;
  context: string;
  people_involved: string[] | null;
  tags: string[] | null;
  image_url: string | null;
  era: string | null;
  status: string;
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; display_name: string; avatar_url: string | null };
  reactions?: { reaction: string; user_id: string }[];
  contributions?: { count: number }[];
};

export type LoreReaction = 'legendary' | 'elite' | 'cursed' | 'fraud' | 'all_timer' | 'certified';

export const LORE_REACTIONS: { value: LoreReaction; label: string; emoji: string }[] = [
  { value: 'legendary', label: 'Legendary', emoji: '👑' },
  { value: 'all_timer', label: 'All-timer', emoji: '🔥' },
  { value: 'elite', label: 'Elite', emoji: '⭐' },
  { value: 'certified', label: 'Certified', emoji: '✅' },
  { value: 'cursed', label: 'Cursed', emoji: '💀' },
  { value: 'fraud', label: 'Fraud', emoji: '🚨' },
];

export function useLoreEntries(filters?: { type?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['lore-entries', filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from('lore_entries')
        .select('*, profiles:created_by(id, display_name, avatar_url), reactions:lore_reactions(reaction, user_id), contributions:lore_contributions(count)')
        .order('created_at', { ascending: false });

      if (filters?.type && filters.type !== 'all') q = q.eq('type', filters.type);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters?.search) {
        q = q.or(`title.ilike.%${filters.search}%,context.ilike.%${filters.search}%`);
      }

      const data = await memberData(q, 'Load club lore');
      return (data || []) as LoreEntry[];
    },
  });
}

export function useLoreEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['lore-entry', id],
    enabled: !!id,
    queryFn: async () => {
      const data = await memberData((supabase as any)
        .from('lore_entries')
        .select('*, profiles:created_by(id, display_name, avatar_url), reactions:lore_reactions(reaction, user_id), contributions:lore_contributions(count)')
        .eq('id', id)
        .single(), 'Load lore entry');
      return data as LoreEntry;
    },
  });
}

export function useCreateLoreEntry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<LoreEntry>) => {
      if (!user) throw new Error('Not authenticated');
      const payload = {
        created_by: user.id,
        type: input.type || 'quote',
        title: input.title!,
        context: input.context!,
        people_involved: input.people_involved || [],
        tags: input.tags || [],
        image_url: input.image_url || null,
        era: input.era || null,
        status: input.status || 'classic',
      };
      const data = await memberData((supabase as any)
        .from('lore_entries')
        .insert(payload)
        .select()
        .single(), 'Create lore entry');
      return data as LoreEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lore-entries'] });
    },
  });
}

export function useDeleteLoreEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await memberData((supabase as any).from('lore_entries').delete().eq('id', id).select('id'), 'Delete lore entry');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lore-entries'] });
    },
  });
}

export function useToggleLoreReaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ loreId, reaction, hasReacted }: { loreId: string; reaction: LoreReaction; hasReacted: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      if (hasReacted) {
        await memberData((supabase as any)
          .from('lore_reactions')
          .delete()
          .eq('lore_id', loreId)
          .eq('user_id', user.id)
          .eq('reaction', reaction)
          .select('id'), 'Remove lore reaction');
      } else {
        await memberData((supabase as any)
          .from('lore_reactions')
          .insert({ lore_id: loreId, user_id: user.id, reaction })
          .select('id'), 'Add lore reaction');
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lore-entries'] });
      queryClient.invalidateQueries({ queryKey: ['lore-entry', vars.loreId] });
    },
  });
}
