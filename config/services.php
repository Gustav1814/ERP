<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'crm_handoff' => [
        'secret' => env('CRM_ERP_HANDOFF_SECRET'),
        'issuer' => env('CRM_ERP_HANDOFF_ISSUER', 'hb-leads-crm'),
        'audience' => env('CRM_ERP_HANDOFF_AUDIENCE', 'new_erp'),
        'subject' => env('CRM_ERP_HANDOFF_SUBJECT', 'erp_import_handoff'),
        'max_ttl_seconds' => env('CRM_ERP_HANDOFF_MAX_TTL_SECONDS', 900),
        'static_jti' => env('CRM_ERP_HANDOFF_STATIC_JTI', 'erp-static-handoff-token'),
    ],

    'crm_source' => [
        'base_url' => env('CRM_SOURCE_BASE_URL', 'http://127.0.0.1:8000'),
        'secret' => env('CRM_ERP_HANDOFF_SECRET'),
        'timeout_seconds' => (int) env('CRM_SOURCE_TIMEOUT_SECONDS', 8),
    ],

];
