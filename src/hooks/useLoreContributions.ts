import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { memberData } from '@/lib/memberData';

export type LoreContribution = {
  id: string;
  lore_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; display_name: string; avatar_url: string | null };
};

export function useLoreContributions(loreId: string | undefined) {
  return useQuery({
    queryKey: ['lore-contributions', loreId],
    enabled: !!loreId,
    queryFn: async () => {
      const data = await memberData((supabase as any)
        .from('lore_contributions')
        .select('*, profiles:user_id(id, display_name, avatar_url)')
        .eq('lore_id', loreId)
        .order('created_at', { ascending: true }), 'Load lore contributions');
      return (data || []) as LoreContribution[];
    },
  });
}

export function useAddLoreContribution() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ loreId, content }: { loreId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      const data = await memberData((supabase as any)
        .from('lore_contributions')
        .insert({ lore_id: loreId, user_id: user.id, content })
        .select('*, profiles:user_id(id, display_name, avatar_url)')
        .single(), 'Add lore contribution');

      // Notify lore author (if not self)
      try {
        const { data: lore } = await (supabase as any)
          .from('lore_entries')
          .select('user_id, title')
          .eq('id', loreId)
          .single();
        if (lore?.user_id && lore.user_id !== user.id) {
          const { notify } = await import('@/lib/notify');
          const senderName = (user.user_metadata as any)?.display_name || 'Someone';
          const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
          notify({
            type: 'lore',
            title: `${senderName} added to "${lore.title || 'your lore'}"`,
            message: preview,
            tag: `dh-lore-${loreId}`,
            url: `/lore/${loreId}`,
            senderUserId: user.id,
            targetUserId: lore.user_id,
          });
        }
      } catch { /* ignore */ }

      return data as LoreContribution;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lore-contributions', vars.loreId] });
      queryClient.invalidateQueries({ queryKey: ['lore-entries'] });
    },
  });
}

export function useUpdateLoreContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; loreId: string; content: string }) => {
      await memberData((supabase as any)
        .from('lore_contributions')
        .update({ content })
        .eq('id', id)
        .select('id'), 'Update lore contribution');
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lore-contributions', vars.loreId] });
    },
  });
}

export function useDeleteLoreContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; loreId: string }) => {
      await memberData((supabase as any)
        .from('lore_contributions')
        .delete()
        .eq('id', id)
        .select('id'), 'Delete lore contribution');
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lore-contributions', vars.loreId] });
      queryClient.invalidateQueries({ queryKey: ['lore-entries'] });
    },
  });
}
