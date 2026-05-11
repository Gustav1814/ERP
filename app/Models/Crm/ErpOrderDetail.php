<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ErpOrderDetail extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'erp_order_id',
        'order_seq',
        'pk_status',
        'asin',
        'location',
        'make_model',
        'model_type',
        'serial_number',
        'condition',
        'next_steps',
        'market',
        'market_order_id',
        'price',
        'fees',
        'profit',
        'notes',
    ];

    protected $casts = [
        'price' => 'float',
        'fees' => 'float',
        'profit' => 'float',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(ErpOrder::class, 'erp_order_id');
    }
}
