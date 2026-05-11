<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ActivityLogsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $userId = (int) $request->query('user_id', 0);
        $action = trim((string) $request->query('action', ''));
        $entityType = trim((string) $request->query('entity_type', ''));
        $entityId = (int) $request->query('entity_id', 0);
        $from = trim((string) $request->query('date_from', ''));
        $to = trim((string) $request->query('date_to', ''));

        $query = ActivityLog::query()->with(['actor:id,name,email']);

        if ($q !== '') {
            $query->where(function ($inner) use ($q) {
                $inner->where('action', 'like', "%{$q}%")
                    ->orWhere('entity_type', 'like', "%{$q}%");
            });
        }
        if ($userId > 0) {
            $query->where('actor_user_id', $userId);
        }
        if ($action !== '') {
            $query->where('action', $action);
        }
        if ($entityType !== '') {
            $query->where('entity_type', $entityType);
        }
        if ($entityId > 0) {
            $query->where('entity_id', $entityId);
        }

        $fromTs = $from !== '' ? Carbon::parse($from, config('app.timezone'))->startOfDay() : null;
        $toTs = $to !== '' ? Carbon::parse($to, config('app.timezone'))->endOfDay() : null;
        if ($fromTs) {
            $query->where('created_at', '>=', $fromTs);
        }
        if ($toTs) {
            $query->where('created_at', '<=', $toTs);
        }

        $items = $query
            ->latest('id')
            ->limit(500)
            ->get()
            ->map(function (ActivityLog $log) {
                return [
                    'id' => $log->id,
                    'action' => (string) $log->action,
                    'entity_type' => $log->entity_type ? (string) $log->entity_type : null,
                    'entity_id' => $log->entity_id ? (int) $log->entity_id : null,
                    'metadata' => $log->metadata,
                    'ip' => $log->ip ? (string) $log->ip : null,
                    'user_agent' => $log->user_agent ? (string) $log->user_agent : null,
                    'actor' => $log->actor ? [
                        'id' => $log->actor->id,
                        'name' => (string) $log->actor->name,
                        'email' => (string) $log->actor->email,
                    ] : null,
                    'created_at' => optional($log->created_at)->toISOString(),
                ];
            })
            ->values();

        return response()->json(['data' => $items]);
    }
}
