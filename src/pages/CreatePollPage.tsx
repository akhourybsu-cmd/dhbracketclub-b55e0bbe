import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import AISuggestions from '@/components/AISuggestions';

export default function CreatePollPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const { suggestions, loading: aiLoading, fetchSuggestions, removeSuggestion } = useAISuggestions();

  const handleAddSuggestion = (text: string) => {
    removeSuggestion(text);
    const emptyIdx = options.findIndex(o => !o.trim());
    if (emptyIdx !== -1) {
      setOptions(options.map((o, i) => i === emptyIdx ? text : o));
    } else if (options.length < 10) {
      setOptions([...options, text]);
    }
  };

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, val: string) => {
    setOptions(options.map((o, i) => (i === idx ? val : o)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast.error('Add at least 2 options');
      return;
    }

    setLoading(true);
    try {
      // Create competition
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert({
          type: 'poll',
          title: question.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      if (compErr) throw compErr;

      // Create poll
      const { data: poll, error: pollErr } = await supabase
        .from('polls')
        .insert({
          competition_id: comp.id,
          question: question.trim(),
          created_by: user.id,
          poll_type: 'single',
        })
        .select()
        .single();
      if (pollErr) throw pollErr;

      // Create options
      const optionRows = validOptions.map((label, i) => ({
        poll_id: poll.id,
        label,
        position: i,
      }));
      const { error: optErr } = await supabase.from('poll_options').insert(optionRows);
      if (optErr) throw optErr;

      // Activity feed
      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'poll_created',
        target_type: 'poll',
        target_id: poll.id,
        metadata: { question: question.trim() },
      });

      // Fire-and-forget push notification
      supabase.functions.invoke('send-push-notification', {
        body: {
          type: 'poll',
          title: '📊 New Poll',
          message: question.trim(),
          url: `/polls/${poll.id}`,
          sender_user_id: user.id,
        },
      }).catch(() => {});

      toast.success('Poll created!');
      navigate(`/polls/${poll.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="member-page max-w-md mx-auto">
      <Link to="/polls" className="back-link">
        <ArrowLeft /> Back to Polls
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--warning) / 0.2), hsl(var(--warning) / 0.05))',
          }}>
            <MessageCircle className="w-5 h-5" style={{ color: 'hsl(var(--warning))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Create Poll</h1>
            <p className="page-header-subtitle">Quick vote for the crew</p>
          </div>
        </div>
      </motion.div>

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="form-label">Question</label>
            <Input
              required
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. Where are we going Friday?"
              maxLength={200}
              className="form-input"
            />
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="form-label mb-0">Options</label>
            <span className="text-[10px] text-muted-foreground font-mono">{options.filter(o => o.trim()).length} options</span>
          </div>
          <div className="mb-4">
            <AISuggestions
              suggestions={suggestions}
              loading={aiLoading}
              onFetch={() => fetchSuggestions(question, 'poll', options)}
              onAdd={handleAddSuggestion}
              disabled={!question.trim()}
            />
          </div>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{
                  borderColor: 'hsl(var(--warning) / 0.3)',
                }} />
                <Input
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={100}
                  className="form-input flex-1"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(idx)} className="w-11 h-11 -mr-2 rounded-xl text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center" aria-label={`Remove option ${idx + 1}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button type="button" onClick={addOption} className="mt-3 w-full min-h-11 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors" style={{
              background: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border) / 0.3)',
            }}>
              <Plus className="w-3.5 h-3.5" /> Add Option
            </button>
          )}
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl font-bold btn-press" disabled={loading || !question.trim()}>
          {loading ? 'Creating…' : 'Create Poll'}
        </Button>
      </motion.form>
    </div>
  );
}
