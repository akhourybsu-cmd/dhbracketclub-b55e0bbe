// Admin-only panel listing pending message reports. Surfaces inside
// ClubSettingsPage when the chat asset is installed. Backed by the
// message_reports table (RLS allows admins to read all + update).

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Flag, Check, X, Loader2, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { chatToast as toast } from '@/lib/chatToast';

interface ReportRow {
  id: string;
  message_id: string;
  reporter_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  // Optional joins (filled in fetch below)
  message?: { id: string; content: string; user_id: string; channel_id: string; created_at: string; profiles?: { display_name: string | null } | null };
  reporter?: { display_name: string | null };
}

interface MessageReportsPanelProps {
  installed: boolean;
  isAdmin: boolean;
}

export function MessageReportsPanel({ installed, isAdmin }: MessageReportsPanelProps) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('message_reports')
      .select(`
        id, message_id, reporter_id, reason, status, created_at,
        message:messages!message_reports_message_id_fkey ( id, content, user_id, channel_id, created_at, profiles:user_id ( display_name ) ),
        reporter:profiles!message_reports_reporter_id_fkey ( display_name )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setReports(data as ReportRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!installed || !isAdmin) return;
    fetchReports();
  }, [installed, isAdmin, fetchReports]);

  // Realtime: refetch the queue on any insert/update so admin sees new
  // reports + status flips from other admin sessions without manual refresh.
  useEffect(() => {
    if (!installed || !isAdmin) return;
    const ch = supabase
      .channel('message-reports-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reports' }, () => {
        fetchReports();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reports' }, () => {
        fetchReports();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [installed, isAdmin, fetchReports]);

  const handleAction = async (id: string, status: 'reviewed' | 'dismissed') => {
    setActingId(id);
    const prev = reports;
    setReports(rs => rs.filter(r => r.id !== id)); // optimistic
    const { error } = await (supabase as any)
      .from('message_reports')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    setActingId(null);
    if (error) {
      setReports(prev); // rollback
      toast.error('Couldn\'t update report.');
    } else {
      toast.success(status === 'reviewed' ? 'Marked as reviewed' : 'Dismissed');
    }
  };

  if (!installed || !isAdmin) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="glass-card p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
          <Flag className="w-3 h-3" /> Message Reports
          {reports.length > 0 && (
            <span className="ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive">
              {reports.length}
            </span>
          )}
        </h2>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="text-[10px] font-bold text-muted-foreground/60 hover:text-foreground/80 transition-colors"
          aria-label="Refresh"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && reports.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70 py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/65 py-3">No pending reports. Everything's quiet.</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => {
            const snippet = (r.message?.content || '').slice(0, 160);
            const authorName = r.message?.profiles?.display_name || 'Unknown';
            const reporterName = r.reporter?.display_name || 'A member';
            const acting = actingId === r.id;
            return (
              <div
                key={r.id}
                className="rounded-xl border border-border/20 bg-muted/15 p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground/75">
                      <span className="font-bold text-foreground/85">{reporterName}</span> reported{' '}
                      <span className="font-bold text-foreground/85">{authorName}</span> ·{' '}
                      <span title={format(new Date(r.created_at), 'PPp')}>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </p>
                    {snippet && (
                      <p className="mt-1 text-[12px] text-foreground/85 leading-snug whitespace-pre-wrap break-words">
                        {snippet}{(r.message?.content?.length || 0) > 160 ? '…' : ''}
                      </p>
                    )}
                    {!r.message && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground/55">Message no longer available.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction(r.id, 'reviewed')}
                    className="flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 bg-primary/12 text-primary hover:bg-primary/18 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" /> Reviewed
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction(r.id, 'dismissed')}
                    className="flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 bg-muted/40 text-foreground/70 hover:bg-muted/55 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
