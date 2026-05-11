<?php

namespace App\Services\Crm;

use RuntimeException;

class HandoffTokenService
{
    public function validateAndConsume(string $token): array
    {
        [$payloadB64, $signature] = explode('.', $token) + [null, null];
        if (! $payloadB64 || ! $signature) {
            throw new RuntimeException('Invalid handoff token format.');
        }

        $secret = (string) config('services.crm_handoff.secret');
        if ($secret === '') {
            throw new RuntimeException('CRM_ERP_HANDOFF_SECRET is not configured.');
        }

        $expected = hash_hmac('sha256', $payloadB64, $secret);
        if (! hash_equals($expected, $signature)) {
            throw new RuntimeException('Invalid handoff token signature.');
        }

        $payload = json_decode(base64_decode(strtr($payloadB64, '-_', '+/')), true);
        if (! is_array($payload)) {
            throw new RuntimeException('Invalid handoff token payload.');
        }

        $this->assertClaims($payload);

        return $payload;
    }

    private function assertClaims(array $payload): void
    {
        $iss = (string) ($payload['iss'] ?? '');
        $aud = (string) ($payload['aud'] ?? '');
        $sub = (string) ($payload['sub'] ?? '');
        $iat = (int) ($payload['iat'] ?? 0);
        $exp = (int) ($payload['exp'] ?? 0);
        $now = now()->timestamp;
        $jti = (string) ($payload['jti'] ?? '');
        $maxTtl = (int) config('services.crm_handoff.max_ttl_seconds', 900);

        if ($iss !== (string) config('services.crm_handoff.issuer', 'hb-leads-crm')) {
            throw new RuntimeException('Invalid token issuer.');
        }
        if ($aud !== (string) config('services.crm_handoff.audience', 'new_erp')) {
            throw new RuntimeException('Invalid token audience.');
        }
        if ($sub !== (string) config('services.crm_handoff.subject', 'erp_import_handoff')) {
            throw new RuntimeException('Invalid token subject.');
        }
        if ($jti !== (string) config('services.crm_handoff.static_jti', 'erp-static-handoff-token')) {
            throw new RuntimeException('Invalid token jti.');
        }
        if ($iat <= 0 || $exp <= 0 || $now < $iat || $now > $exp) {
            throw new RuntimeException('Token expired or not active yet.');
        }
        if (($exp - $iat) > $maxTtl) {
            throw new RuntimeException('Token TTL exceeds maximum allowed window.');
        }
    }
}
