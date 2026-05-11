<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CrmIntakeQueue extends Model
{
    use HasFactory;

    protected $table = 'crm_intake_queue';

    protected $fillable = [
        'handoff_jti',
        'lead_id',
        'source_order_id',
        'payload_json',
        'status',
        'erp_company_id',
        'erp_order_id',
        'resolved_at',
    ];

    protected $casts = [
        'payload_json' => 'array',
        'resolved_at' => 'datetime',
    ];
}
