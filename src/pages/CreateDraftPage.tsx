import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bookmark, ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CreateDraftPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [numRounds, setNumRounds] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Create competition
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert({
          type: 'draft',
          title: topic.trim(),
          description: description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (compErr) throw compErr;

      // Create draft — creator is first participant
      const trimmedCtx = aiContext.trim();
      const { data: draft, error: draftErr } = await supabase
        .from('drafts')
        .insert({
          competition_id: comp.id,
          topic: topic.trim(),
          created_by: user.id,
          num_rounds: numRounds,
          status: 'setup',
          ai_context: trimmedCtx ? trimmedCtx : null,
        } as any)
        .select()
        .single();
      if (draftErr) throw draftErr;

      // Add creator as first participant
      const { error: partErr } = await supabase.from('draft_participants').insert({
        draft_id: draft.id,
        user_id: user.id,
        pick_order: 1,
      });
      if (partErr) throw partErr;

      // Activity feed
      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'draft_created',
        target_type: 'draft',
        target_id: draft.id,
        metadata: { topic: topic.trim() },
      });

      toast.success('Draft created!');
      navigate(`/drafts/${draft.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-6 da-ledger-page">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/drafts" className="da-back" aria-label="Back to Drafts">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header mb-0 flex-1"
        >
          <div className="da-page-icon">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="page-header-title dl-display">Create Draft</h1>
            <p className="page-header-subtitle">Set up a snake draft for the crew</p>
          </div>
        </motion.div>
      </div>

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
        <div className="da-glass da-ledger-section p-5 space-y-5">
          <div>
            <label className="form-label">Topic</label>
            <Input
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Best Fast Food Items"
              maxLength={100}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are we drafting?"
              maxLength={200}
              className="form-input"
            />
          </div>
          {/* AI Judging Context — elevated into a gold "smart-assist" panel so
              it reads as the field that steers how the AI report judges picks,
              distinct from the plain topic/description inputs. */}
          <div
            className="rounded-xl p-3.5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.07), transparent 72%)', border: '1px solid hsl(var(--gold) / 0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md" style={{ background: 'hsl(var(--gold) / 0.16)' }}>
                <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: 'hsl(var(--gold))' }}>AI Judging Context</span>
              <span className="text-[10px] font-medium text-muted-foreground/60 normal-case tracking-normal">optional</span>
            </div>
            <Textarea
              value={aiContext}
              onChange={e => setAiContext(e.target.value)}
              placeholder={'e.g. "Best Villains of All Time — include movies, TV, video games, comics, anime, books, and mythology. Don\u2019t limit to movie villains."'}
              maxLength={1000}
              rows={4}
              className="form-input min-h-[96px] resize-none text-[13px] leading-snug"
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-snug">
              Tell the AI what this category includes or excludes so the report judges picks the way you intended. {aiContext.length}/1000
            </p>
          </div>
          <div>
            <label className="form-label flex items-baseline justify-between">
              <span>Rounds</span>
              <span className="text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">{numRounds} picks each</span>
            </label>
            <div className="flex gap-2">
              {[3, 5, 7, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumRounds(n)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all btn-press ${
                    numRounds === n ? 'shadow-md' : 'text-muted-foreground'
                  }`}
                  style={
                    numRounds === n
                      ? {
                          background: 'hsl(var(--primary))',
                          color: 'hsl(var(--primary-foreground))',
                          boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.12)',
                        }
                      : { background: 'hsl(var(--muted) / 0.6)', border: '1px solid hsl(var(--gold) / 0.18)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="w-full h-12 rounded-lg font-black uppercase tracking-[0.14em] text-[13px] btn-press transition-all disabled:cursor-not-allowed"
          style={{
             color: loading || !topic.trim() ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            background: loading || !topic.trim()
              ? 'hsl(var(--muted) / 0.6)'
               : 'hsl(var(--primary))',
            border: loading || !topic.trim()
              ? '1px solid hsl(var(--border))'
               : '1px solid hsl(var(--primary) / 0.65)',
            boxShadow: loading || !topic.trim()
              ? 'none'
               : '0 6px 18px hsl(var(--background) / 0.55), inset 0 1px 0 hsl(var(--foreground) / 0.12)',
            opacity: loading || !topic.trim() ? 0.9 : 1,
          }}
        >
          {loading ? 'Creating…' : 'Create Draft'}
        </button>
      </motion.form>
    </div>
  );
}
