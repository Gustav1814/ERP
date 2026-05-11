<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Model;

class ErpHandoffToken extends Model
{
    protected $fillable = [
        'jti',
        'lead_id',
        'issued_by_user_id',
        'expires_at',
        'consumed_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'consumed_at' => 'datetime',
    ];
}
