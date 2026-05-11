<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    public static function record(
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        array $metadata = [],
        ?Request $request = null,
    ): void {
        try {
            $req = $request ?? request();
            $user = Auth::user();

            ActivityLog::query()->create([
                'actor_user_id' => $user?->id,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'metadata' => $metadata ?: null,
                'ip' => $req?->ip(),
                'user_agent' => substr((string) ($req?->userAgent() ?? ''), 0, 255) ?: null,
            ]);
        } catch (\Throwable $e) {
            // Never break ERP flows because logging failed.
        }
    }
}

