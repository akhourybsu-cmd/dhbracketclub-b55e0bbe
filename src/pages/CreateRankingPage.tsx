import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { BarChart3, Plus, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import AISuggestions from '@/components/AISuggestions';
import { useEnrichRanking } from '@/hooks/useItemEnrichments';
import { notify } from '@/lib/notify';

export default function CreateRankingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<string[]>(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const { suggestions, loading: aiLoading, fetchSuggestions, removeSuggestion } = useAISuggestions();
  const { enrichRanking } = useEnrichRanking();

  const handleAddSuggestion = (text: string) => {
    removeSuggestion(text);
    const emptyIdx = items.findIndex(i => !i.trim());
    if (emptyIdx !== -1) {
      setItems(items.map((item, i) => i === emptyIdx ? text : item));
    } else if (items.length < 20) {
      setItems([...items, text]);
    }
  };

  const addItem = () => {
    if (items.length >= 20) return;
    setItems([...items, '']);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 2) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, val: string) => {
    setItems(items.map((item, i) => i === idx ? val : item));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validItems = items.map(i => i.trim()).filter(Boolean);
    if (validItems.length < 2) {
      toast.error('Add at least 2 items to rank');
      return;
    }

    setLoading(true);
    try {
      // Create competition
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert({
          type: 'ranking',
          title: topic.trim(),
          description: description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (compErr) throw compErr;

      // Create ranking
      const { data: ranking, error: rankErr } = await supabase
        .from('rankings')
        .insert({
          competition_id: comp.id,
          topic: topic.trim(),
          created_by: user.id,
          item_count: validItems.length,
        })
        .select()
        .single();
      if (rankErr) throw rankErr;

      // Create items
      const itemRows = validItems.map((label, i) => ({
        ranking_id: ranking.id,
        label,
        position: i,
      }));
      const { error: itemErr } = await supabase.from('ranking_items').insert(itemRows);
      if (itemErr) throw itemErr;

      // Log activity
      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'ranking_created',
        target_type: 'ranking',
        target_id: ranking.id,
        metadata: { topic: topic.trim() },
      });

      toast.success('Ranking created!');
      // Trigger enrichment in background (fire-and-forget)
      enrichRanking(ranking.id);

      // Broadcast new ranking to the club (server excludes the creator)
      notify({
        type: 'rankings',
        title: 'New ranking to vote on',
        message: topic.trim(),
        tag: `dh-rankings-${ranking.id}`,
        url: `/rankings/${ranking.id}`,
        senderUserId: user.id,
      });

      navigate(`/rankings/${ranking.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ranking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="member-page max-w-md mx-auto">
      <Link to="/rankings" className="back-link">
        <ArrowLeft /> Back to Rankings
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon"><BarChart3 /></div>
          <div>
            <h1 className="page-header-title">Create Ranking</h1>
            <p className="page-header-subtitle">Set up items for the crew to rank</p>
          </div>
        </div>
      </motion.div>

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="form-label">Topic</label>
            <Input
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Best Fast Food Chains"
              maxLength={100}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are we ranking?"
              maxLength={200}
              className="form-input"
            />
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="form-label mb-0">Items to Rank</label>
            <span className="text-[10px] text-muted-foreground font-mono">{items.filter(i => i.trim()).length} items</span>
          </div>
          <div className="mb-4">
            <AISuggestions
              suggestions={suggestions}
              loading={aiLoading}
              onFetch={() => fetchSuggestions(topic, 'ranking', items)}
              onAdd={handleAddSuggestion}
              disabled={!topic.trim()}
            />
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-muted-foreground/70 w-5 text-right flex-shrink-0">{idx + 1}</span>
                <Input
                  value={item}
                  onChange={e => updateItem(idx, e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  maxLength={100}
                  className="form-input flex-1"
                />
                {items.length > 2 && (
                  <button type="button" onClick={() => removeItem(idx)} className="w-11 h-11 -mr-2 rounded-xl text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center" aria-label={`Remove item ${idx + 1}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {items.length < 20 && (
            <button type="button" onClick={addItem} className="mt-3 w-full min-h-11 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors" style={{
              background: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border) / 0.3)',
            }}>
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          )}
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl font-bold btn-press" disabled={loading || !topic.trim()}>
          {loading ? 'Creating…' : 'Create Ranking'}
        </Button>
      </motion.form>
    </div>
  );
}
