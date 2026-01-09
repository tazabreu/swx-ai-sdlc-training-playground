'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, type CardRequest } from '@/lib/api/client';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ClipboardList, Check, X, User, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { CREDIT_LIMITS } from '@/types';

// Get max limit for tier
function getMaxLimitForTier(tier: 'high' | 'medium' | 'low' | undefined): number {
  if (!tier) return CREDIT_LIMITS.low;
  return CREDIT_LIMITS[tier];
}

export default function RequestsPage() {
  const { token, isRegistered } = useAuth();
  const [requests, setRequests] = useState<CardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Approve dialog
  const [approveDialog, setApproveDialog] = useState<CardRequest | null>(null);
  const [creditLimit, setCreditLimit] = useState('2000');

  // Compute max limit based on selected request's tier
  const maxLimit = approveDialog ? getMaxLimitForTier(approveDialog.tierAtRequest) : CREDIT_LIMITS.low;

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<CardRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = async () => {
    if (!token || !isRegistered) return;
    setLoading(true);
    try {
      const res = await api.admin.getPendingRequests(token);
      setRequests(res.requests || []);
    } catch (err) {
      toast.error('Failed to load card requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token, isRegistered]);

  const handleApprove = async () => {
    if (!token || !approveDialog) return;
    const limit = parseFloat(creditLimit) || maxLimit;
    // Validate against max limit
    if (limit > maxLimit) {
      toast.error(`Credit limit cannot exceed $${maxLimit.toLocaleString()} for ${approveDialog.tierAtRequest || 'low'} tier`);
      return;
    }
    setProcessing(approveDialog.requestId);
    try {
      await api.admin.approveRequest(approveDialog.requestId, limit, token);
      toast.success('Card request approved!');
      setApproveDialog(null);
      setCreditLimit('2000');
      fetchRequests();
    } catch (err) {
      if (err instanceof Error && err.message.includes('policy')) {
        toast.error(err.message);
      } else {
        toast.error('Failed to approve request');
      }
    } finally {
      setProcessing(null);
    }
  };

  // Reset credit limit to max when dialog opens
  const openApproveDialog = (req: CardRequest) => {
    setApproveDialog(req);
    setCreditLimit(String(getMaxLimitForTier(req.tierAtRequest)));
  };

  const handleReject = async () => {
    if (!token || !rejectDialog) return;
    setProcessing(rejectDialog.requestId);
    try {
      await api.admin.rejectRequest(rejectDialog.requestId, rejectReason || 'Rejected by admin', token);
      toast.success('Card request rejected');
      setRejectDialog(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      toast.error('Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Card Requests</h1>
          <p className="text-xs text-muted-foreground">{requests.length} pending</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No pending requests</p>
            <p className="text-sm text-muted-foreground text-center">All requests have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.requestId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-xs truncate">{req.user?.ecosystemId || 'Unknown'}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {req.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {req.tierAtRequest || 'unknown'} tier
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Score: {req.currentScore ?? req.scoreAtRequest ?? '?'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Product: {req.productId} • {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/scores?userId=${req.user?.ecosystemId}`}
                    className="text-primary hover:underline text-xs"
                  >
                    View Score
                  </Link>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => openApproveDialog(req)}
                      disabled={processing === req.requestId}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => setRejectDialog(req)}
                      disabled={processing === req.requestId}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>Set the credit limit for this card.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tier info */}
            {approveDialog && (
              <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>
                  User tier: <Badge variant="secondary" className="ml-1">{approveDialog.tierAtRequest || 'unknown'}</Badge>
                  <span className="ml-2 text-muted-foreground">Max: ${maxLimit.toLocaleString()}</span>
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="limit">Credit Limit ($)</Label>
              <Input
                id="limit"
                type="number"
                placeholder={String(maxLimit)}
                max={maxLimit}
                min={100}
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Min: $100 | Max: ${maxLimit.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setApproveDialog(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={processing === approveDialog?.requestId}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>Provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g., Insufficient credit score"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={processing === rejectDialog?.requestId}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
