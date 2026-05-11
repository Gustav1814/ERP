<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpOrderIdempotency extends Model
{
    use HasFactory;

    protected $table = 'erp_order_idempotency';

    protected $fillable = [
        'key',
        'erp_order_id',
        'response_json',
    ];

    protected $casts = [
        'response_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(ErpOrder::class, 'erp_order_id');
    }
}
