'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'next/navigation';
import { api, ApiClientError, type Score } from '@/lib/api/client';
import { DEFAULT_USER_ID } from '@/lib/auth/mock';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, TrendingUp, Edit2, Trash2, AlertTriangle, UserPlus, Zap } from 'lucide-react';

// Score tier presets for quick testing
const SCORE_PRESETS = [
  { label: 'Platinum (auto-approve)', score: 750, reason: 'Set to Platinum tier for auto-approval testing' },
  { label: 'Gold', score: 650, reason: 'Set to Gold tier' },
  { label: 'Silver', score: 550, reason: 'Set to Silver tier' },
  { label: 'Bronze (manual review)', score: 450, reason: 'Set to Bronze tier for manual review testing' },
  { label: 'Low (rejection)', score: 300, reason: 'Set to low score for rejection testing' },
];

export default function ScoresPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();

  // Score lookup
  const [ecosystemId, setEcosystemId] = useState(searchParams.get('userId') || DEFAULT_USER_ID);
  const [score, setScore] = useState<Score | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  // Adjust dialog
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [newScore, setNewScore] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Cleanup state
  const [cleanupToken, setCleanupToken] = useState<string | null>(null);
  const [cleanupExpires, setCleanupExpires] = useState<string | null>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Lookup user on initial load if userId in query
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && token) {
      setEcosystemId(userId);
      lookupScore(userId);
    }
  }, [searchParams, token]);

  const lookupScore = async (id?: string, autoCreate = false) => {
    const lookupId = id || ecosystemId;
    if (!token || !lookupId) return;

    setLoadingScore(true);
    setUserNotFound(false);
    try {
      const res = await api.admin.getUserScore(lookupId, token);
      setScore(res.score);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        if (autoCreate) {
          // Try to create the user first, then lookup again
          try {
            await api.users.ensureExists(lookupId, 'user');
            toast.success(`Created user ${lookupId}`);
            // Retry lookup
            const res = await api.admin.getUserScore(lookupId, token);
            setScore(res.score);
            return;
          } catch {
            toast.error('Failed to create user');
          }
        }
        setUserNotFound(true);
        setScore(null);
      } else {
        toast.error('Failed to load score');
        setScore(null);
      }
    } finally {
      setLoadingScore(false);
    }
  };

  const handleCreateAndLookup = async () => {
    await lookupScore(ecosystemId, true);
  };

  const handleAdjustScore = async () => {
    if (!token || !ecosystemId || !newScore) return;

    setAdjusting(true);
    try {
      const res = await api.admin.adjustScore(
        ecosystemId,
        { score: parseInt(newScore, 10), reason: adjustReason || 'Admin adjustment' },
        token
      );
      setScore(res.score);
      toast.success('Score updated successfully!');
      setAdjustDialogOpen(false);
      setNewScore('');
      setAdjustReason('');
    } catch (err) {
      toast.error('Failed to adjust score');
    } finally {
      setAdjusting(false);
    }
  };

  const handleRequestCleanup = async () => {
    if (!token) return;

    setCleaningUp(true);
    try {
      const res = await api.admin.requestCleanup(token);
      setCleanupToken(res.confirmationToken);
      setCleanupExpires(res.expiresAt);
      setCleanupDialogOpen(true);
      toast.info('Cleanup requested. Please confirm within 60 seconds.');
    } catch (err) {
      toast.error('Failed to request cleanup');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleConfirmCleanup = async () => {
    if (!token || !cleanupToken) return;

    setCleaningUp(true);
    try {
      const res = await api.admin.confirmCleanup(cleanupToken, token);
      toast.success(
        `Cleanup complete! Deleted: ${JSON.stringify(res.deletedCounts)} (duration: ${res.duration})`
      );
      setCleanupDialogOpen(false);
      setCleanupToken(null);
      setCleanupExpires(null);
      setScore(null);
    } catch (err) {
      toast.error('Failed to confirm cleanup. Token may have expired.');
    } finally {
      setCleaningUp(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return 'bg-gradient-to-r from-slate-400 to-slate-600';
      case 'gold':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 'silver':
        return 'bg-gradient-to-r from-gray-300 to-gray-500';
      default:
        return 'bg-gradient-to-r from-amber-600 to-amber-800';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Admin Tools</h1>
        <p className="text-xs text-muted-foreground">Manage scores and cleanup data</p>
      </div>

      {/* Score Lookup */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Lookup User Score</span>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="user-123"
              value={ecosystemId}
              onChange={(e) => setEcosystemId(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={() => lookupScore()} disabled={loadingScore || !ecosystemId}>
              {loadingScore ? 'Loading...' : 'Lookup'}
            </Button>
          </div>

          {/* User not found - offer to create */}
          {userNotFound && !score && (
            <div className="pt-2 border-t">
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>{ecosystemId}</strong> doesn&apos;t exist yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Users must be created before you can view/adjust their score. Click below to create this user.
                </p>
                <Button size="sm" variant="outline" onClick={handleCreateAndLookup} disabled={loadingScore}>
                  <UserPlus className="h-3 w-3 mr-1" />
                  {loadingScore ? 'Creating...' : `Create ${ecosystemId}`}
                </Button>
              </div>
            </div>
          )}

          {score && (
            <div className="pt-2 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{score.ecosystemId}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold">{score.score}</span>
                      <Badge className={`${getTierColor(score.tier)} text-white text-[10px]`}>{score.tier}</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setNewScore(score.score.toString());
                    setAdjustDialogOpen(true);
                  }}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Adjust
                </Button>
              </div>

              {/* Quick presets */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Quick presets
                </div>
                <div className="flex flex-wrap gap-1">
                  {SCORE_PRESETS.map((preset) => (
                    <Button
                      key={preset.score}
                      size="sm"
                      variant={score.score === preset.score ? 'default' : 'outline'}
                      className="h-6 text-[10px] px-2"
                      disabled={adjusting}
                      onClick={async () => {
                        if (!token) return;
                        setAdjusting(true);
                        try {
                          const res = await api.admin.adjustScore(
                            ecosystemId,
                            { score: preset.score, reason: preset.reason },
                            token
                          );
                          setScore(res.score);
                          toast.success(`Score set to ${preset.score} (${preset.label})`);
                        } catch {
                          toast.error('Failed to adjust score');
                        } finally {
                          setAdjusting(false);
                        }
                      }}
                    >
                      {preset.label.split(' ')[0]} ({preset.score})
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Cleanup */}
      <Card className="border-destructive/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-sm text-destructive">Danger Zone</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Reset all data in the ecosystem. This action cannot be undone. A confirmation token will be required.
          </p>

          <Button variant="destructive" size="sm" onClick={handleRequestCleanup} disabled={cleaningUp}>
            <Trash2 className="h-4 w-4 mr-2" />
            {cleaningUp ? 'Processing...' : 'Request Cleanup'}
          </Button>
        </CardContent>
      </Card>

      {/* Adjust Score Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adjust Score</DialogTitle>
            <DialogDescription>
              Set a new score for {ecosystemId}. Current: {score?.score}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newScore">New Score (0-850)</Label>
              <Input
                id="newScore"
                type="number"
                min="0"
                max="850"
                placeholder="750"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustReason">Reason</Label>
              <Input
                id="adjustReason"
                placeholder="e.g., Manual correction"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdjustScore} disabled={adjusting || !newScore}>
              {adjusting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleanup Confirmation Dialog */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Cleanup
            </DialogTitle>
            <DialogDescription>
              This will delete ALL data in the ecosystem. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-destructive/10 rounded-lg p-3 text-sm">
              <p className="font-mono text-xs text-muted-foreground mb-1">Confirmation Token:</p>
              <p className="font-mono text-xs break-all">{cleanupToken?.slice(0, 20)}...</p>
              {cleanupExpires && (
                <p className="text-xs text-muted-foreground mt-2">
                  Expires: {new Date(cleanupExpires).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCleanupDialogOpen(false);
                setCleanupToken(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmCleanup} disabled={cleaningUp}>
              {cleaningUp ? 'Deleting...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
