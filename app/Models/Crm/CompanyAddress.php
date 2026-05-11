<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CompanyAddress extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'kind',
        'line1',
        'line2',
        'city',
        'state',
        'zip',
        'country',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            CompanyUser::class,
            'company_user_pickup_addresses',
            'company_address_id',
            'company_user_id'
        )->withTimestamps();
    }
}
