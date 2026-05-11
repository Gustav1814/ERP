<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Crm\ImportCommitRequest;
use App\Models\Crm\CrmIntakeQueue;
use App\Services\Crm\CrmOrderIngestService;
use App\Services\Crm\HandoffTokenService;
use Throwable;

class ImportCommitController extends Controller
{
    public function __construct(
        private readonly HandoffTokenService $handoffTokenService,
        private readonly CrmOrderIngestService $ingestService
    ) {
    }

    public function store(ImportCommitRequest $request)
    {
        try {
            $leadId = null;
            $orderId = null;
            $queueId = $request->input('queue_id');
            if ($queueId) {
                $queue = CrmIntakeQueue::query()->findOrFail((int) $queueId);
                $leadId = (int) $queue->lead_id;
                $orderId = (string) $queue->source_order_id;
            } else {
                $handoff = (string) $request->input('handoff');
                $tokenPayload = $this->handoffTokenService->validateAndConsume($handoff);
                $leadId = (int) data_get($tokenPayload, 'lead_ref.lead_id');
                $orderId = (string) data_get($tokenPayload, 'lead_ref.order_id');
            }

            $payload = array_merge($request->validated(), [
                'source' => [
                    'system' => 'hb-leads-crm',
                    'lead_id' => $leadId,
                    'order_id' => $orderId,
                ],
            ]);

            $result = $this->ingestService->ingest($payload);
            if ($queueId) {
                CrmIntakeQueue::query()->where('id', $queueId)->update([
                    'status' => 'resolved',
                    'erp_company_id' => $result['erp_company_id'] ?? null,
                    'erp_order_id' => $result['erp_order_id'] ?? null,
                    'resolved_at' => now(),
                ]);
            }

            return response()->json($result, 201);
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
