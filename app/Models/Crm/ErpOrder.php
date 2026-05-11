<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ErpOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'company_user_id',
        'billing_address_id',
        'pickup_address_id',
        'source_system',
        'source_lead_id',
        'source_order_id',
        'title',
        'type_of_equipment',
        'quantity',
        'estimate_value',
        'pickup_cost',
        'pickup_cost_status',
        'status',
        'qualify_status',
        'data_destruction_type',
        'message',
        'attachments_json',
        'crm_payload_json',
        'start_date',
        'pickup_date',
    ];

    protected $casts = [
        'attachments_json' => 'array',
        'crm_payload_json' => 'array',
        'estimate_value' => 'float',
        'pickup_cost' => 'float',
        'start_date' => 'date:Y-m-d',
        'pickup_date' => 'date:Y-m-d',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function companyUser(): BelongsTo
    {
        return $this->belongsTo(CompanyUser::class);
    }

    public function detailRows(): HasMany
    {
        return $this->hasMany(ErpOrderDetail::class, 'erp_order_id');
    }
}
